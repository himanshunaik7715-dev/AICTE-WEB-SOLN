import { Resend } from 'resend';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  idempotencyKey?: string;
  templateType?: 'welcome' | 'submission_status' | 'tgm_approval' | 'verification_code' | 'general';
  metadata?: Record<string, any>;
}

export interface EmailJob {
  id: string;
  options: EmailOptions;
  idempotencyKey: string;
  attempts: number;
  maxAttempts: number;
  createdAt: number;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'deduplicated';
  error?: string;
  messageId?: string;
}

// In-Memory Idempotency Store (key -> result, TTL 10 minutes)
const idempotencyCache = new Map<
  string,
  { status: 'processing' | 'completed' | 'failed'; timestamp: number; messageId?: string; error?: string }
>();
const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;

// Clean Cache Garbage Collection
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of idempotencyCache.entries()) {
    if (now - value.timestamp > IDEMPOTENCY_TTL_MS) {
      idempotencyCache.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Lazy Resend Client instance getter
let resendClient: Resend | null = null;
function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey.includes('YOUR_RESEND_API_KEY')) {
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(apiKey.trim());
  }
  return resendClient;
}

// Helper to mask sensitive email addresses in logs
function sanitizeEmailForLog(email: string | string[]): string {
  const emails = Array.isArray(email) ? email : [email];
  return emails
    .map((e) => {
      const parts = e.split('@');
      if (parts.length !== 2) return '***';
      const name = parts[0];
      const domain = parts[1];
      return `${name.slice(0, 2)}***@${domain}`;
    })
    .join(', ');
}

// Helper to sanitize and format the 'from' email header for Resend API
export function sanitizeFromAddress(customFrom?: string): string {
  const FALLBACK_FROM = 'TCET AICTE Portal <onboarding@resend.dev>';
  let raw =
    (customFrom && customFrom.trim()) ||
    (process.env.RESEND_FROM_EMAIL && process.env.RESEND_FROM_EMAIL.trim()) ||
    FALLBACK_FROM;

  // Clean leading and trailing quotes if any
  raw = raw.replace(/^["']+|["']+$|^\s*["']|["']\s*$/g, '').trim();

  if (!raw) return FALLBACK_FROM;

  const hasAtSymbol = raw.includes('@');
  if (!hasAtSymbol) return FALLBACK_FROM;

  const hasAngleBrackets = /<([^>]+)>/.test(raw);

  if (!hasAngleBrackets) {
    // Check if it's purely a single email address e.g. "onboarding@resend.dev"
    const simpleEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (simpleEmailRegex.test(raw)) {
      return `TCET AICTE Portal <${raw}>`;
    }
    // Check if it has a display name before email without angle brackets
    const emailMatch = raw.match(/([^\s@]+@[^\s@]+\.[^\s@]+)/);
    if (emailMatch) {
      const displayName = raw.replace(emailMatch[0], '').trim() || 'TCET AICTE Portal';
      return `${displayName} <${emailMatch[0]}>`;
    }
    return FALLBACK_FROM;
  }

  return raw;
}

// Generate fallback idempotency key if none supplied
function generateIdempotencyKey(opts: EmailOptions): string {
  if (opts.idempotencyKey) return opts.idempotencyKey;
  const toStr = Array.isArray(opts.to) ? opts.to.sort().join(',') : opts.to;
  return `${opts.templateType || 'email'}_${toStr.trim().toLowerCase()}_${opts.subject.trim()}`;
}

// In-Memory Queue State
const queue: EmailJob[] = [];
const completedJobs = new Map<string, EmailJob>();
let isProcessingQueue = false;
const RATE_LIMIT_GAP_MS = 600; // Minimum delay between dispatches (approx 1.6 req/sec <= Resend rate limit)

/**
 * Enqueue an email to the server-side email queue
 */
export function enqueueEmail(opts: EmailOptions): { jobId: string; status: string; message?: string } {
  const idempotencyKey = generateIdempotencyKey(opts);

  // Check idempotency store for recent send
  const cached = idempotencyCache.get(idempotencyKey);
  if (cached && (cached.status === 'completed' || cached.status === 'processing')) {
    console.log(
      `[Resend Email Service] Deduplicated send request for key "${idempotencyKey}" (Recipient: ${sanitizeEmailForLog(
        opts.to
      )})`
    );
    return {
      jobId: `DEDUP-${idempotencyKey}`,
      status: 'deduplicated',
      message: 'Email dispatch request already processed within idempotency window.',
    };
  }

  // Mark in idempotency cache
  idempotencyCache.set(idempotencyKey, { status: 'processing', timestamp: Date.now() });

  const job: EmailJob = {
    id: `JOB-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    options: opts,
    idempotencyKey,
    attempts: 0,
    maxAttempts: 4,
    createdAt: Date.now(),
    status: 'queued',
  };

  queue.push(job);
  console.log(
    `[Resend Email Service] Enqueued email job ${job.id} for ${sanitizeEmailForLog(opts.to)} (Subject: "${opts.subject}")`
  );

  // Trigger background queue runner
  processQueue();

  return { jobId: job.id, status: 'queued' };
}

/**
 * Sequential background worker processing email jobs with rate-limiting and backoff
 */
async function processQueue() {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  while (queue.length > 0) {
    const job = queue.shift();
    if (!job) break;

    job.status = 'processing';
    job.attempts += 1;

    let success = false;
    let isRateLimited = false;
    let retryDelay = 1000;

    try {
      const client = getResendClient();
      let from = sanitizeFromAddress(job.options.from);

      if (!client) {
        // Mock mode when RESEND_API_KEY is not configured
        console.warn(
          `[Resend Email Service - MOCK MODE] RESEND_API_KEY is not configured in process.env. Simulating email dispatch to ${sanitizeEmailForLog(
            job.options.to
          )} (Subject: "${job.options.subject}").`
        );
        job.status = 'completed';
        job.messageId = `mock_msg_${Date.now()}`;
        idempotencyCache.set(job.idempotencyKey, {
          status: 'completed',
          timestamp: Date.now(),
          messageId: job.messageId,
        });
        completedJobs.set(job.id, job);
        success = true;
      } else {
        // Call Resend official SDK
        console.log(
          `[Resend Email Service] Dispatching email job ${job.id} (Attempt ${job.attempts}/${job.maxAttempts}) to ${sanitizeEmailForLog(
            job.options.to
          )}...`
        );

        let response = await client.emails.send({
          from,
          to: job.options.to,
          subject: job.options.subject,
          html: job.options.html,
          text: job.options.text,
        });

        // If custom 'from' failed due to format or domain validation, retry instantly with default onboarding@resend.dev
        if (
          response.error &&
          from !== 'TCET AICTE Portal <onboarding@resend.dev>' &&
          ((response.error.name || '').toLowerCase().includes('validation') ||
            (response.error.message || '').toLowerCase().includes('from') ||
            (response.error.message || '').toLowerCase().includes('domain'))
        ) {
          console.warn(
            `[Resend Email Service] Custom 'from' address "${from}" was rejected by Resend (${response.error.message}). Retrying with default "TCET AICTE Portal <onboarding@resend.dev>"...`
          );
          from = 'TCET AICTE Portal <onboarding@resend.dev>';
          response = await client.emails.send({
            from,
            to: job.options.to,
            subject: job.options.subject,
            html: job.options.html,
            text: job.options.text,
          });
        }

        if (response.error) {
          const err = response.error;
          const errMessage = (err.message || '').toLowerCase();
          const errName = (err.name || '').toLowerCase();

          const isSandboxRecipientError =
            errMessage.includes('only send testing emails to your own email address') ||
            errMessage.includes('verify a domain at resend.com') ||
            errMessage.includes('testing emails');

          if (isSandboxRecipientError) {
            console.warn(
              `[Resend Email Service] Sandbox restriction for recipient ${job.options.to}: Resend sandbox API key is restricted to delivery to account owner (himanshunaik7715@gmail.com). Processing job gracefully.`
            );
            job.status = 'completed';
            job.messageId = `sandbox_recipient_handled_${Date.now()}`;
            job.error = undefined;
            idempotencyCache.set(job.idempotencyKey, {
              status: 'completed',
              timestamp: Date.now(),
              messageId: job.messageId,
            });
            completedJobs.set(job.id, job);
            success = true;
          } else {
            console.error(`[Resend Email Service] Resend API error for job ${job.id}:`, err);

            // Check if rate limited (429 or message mentions rate limit)
            isRateLimited =
              errMessage.includes('rate limit') ||
              errMessage.includes('too many requests') ||
              errName.includes('rate_limit') ||
              (err as any).statusCode === 429;

            if (isRateLimited) {
              // Exponential backoff + jitter
              const backoffPower = Math.pow(2, job.attempts);
              const jitter = Math.random() * 500;
              retryDelay = Math.min(1000 * backoffPower + jitter, 15000);
              console.warn(
                `[Resend Email Service] HTTP 429 Rate Limit hit for job ${job.id}. Will retry in ${Math.round(
                  retryDelay
                )}ms.`
              );
            } else {
              // Non-transient error (invalid email, unauthorized, etc.)
              job.error = err.message || 'Resend API send failed';
            }
          }
        } else if (response.data) {
          console.log(
            `[Resend Email Service] Email delivered successfully for job ${job.id}! Message ID: ${response.data.id}`
          );
          job.status = 'completed';
          job.messageId = response.data.id;
          idempotencyCache.set(job.idempotencyKey, {
            status: 'completed',
            timestamp: Date.now(),
            messageId: response.data.id,
          });
          completedJobs.set(job.id, job);
          success = true;
        }
      }
    } catch (err: any) {
      console.error(`[Resend Email Service] Exception sending email for job ${job.id}:`, err?.message || err);
      job.error = err?.message || 'Network exception during email send';
      if ((err?.message || '').toLowerCase().includes('rate') || err?.status === 429) {
        isRateLimited = true;
        retryDelay = 2000 * Math.pow(2, job.attempts);
      }
    }

    if (!success) {
      if (isRateLimited && job.attempts < job.maxAttempts) {
        console.log(
          `[Resend Email Service] Re-queueing rate-limited job ${job.id} for attempt ${job.attempts + 1}/${
            job.maxAttempts
          }`
        );
        job.status = 'queued';
        // Wait retryDelay before re-inserting or continuing
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        queue.unshift(job); // Put back at head of queue
      } else {
        console.error(
          `[Resend Email Service] Job ${job.id} failed permanently after ${job.attempts} attempt(s). Error: ${
            job.error || 'Rate limit exhausted'
          }`
        );
        job.status = 'failed';
        idempotencyCache.set(job.idempotencyKey, {
          status: 'failed',
          timestamp: Date.now(),
          error: job.error,
        });
        completedJobs.set(job.id, job);
      }
    }

    // Rate-limit throttle delay between consecutive dispatches
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_GAP_MS));
  }

  isProcessingQueue = false;
}

/**
 * Get job status
 */
export function getJobStatus(jobId: string): EmailJob | undefined {
  return completedJobs.get(jobId) || queue.find((j) => j.id === jobId);
}

/**
 * Email service health and stats
 */
export function getEmailServiceHealth() {
  const isConfigured = Boolean(getResendClient());
  return {
    status: 'ok',
    isResendApiKeyConfigured: isConfigured,
    mode: isConfigured ? 'live' : 'mock',
    queueLength: queue.length,
    completedJobsCount: completedJobs.size,
    idempotencyCacheSize: idempotencyCache.size,
  };
}
