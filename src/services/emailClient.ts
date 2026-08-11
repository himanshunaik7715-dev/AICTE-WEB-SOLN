/**
 * Client-Side Email Service
 * Dispatches transactional email requests to the server-side Resend email queue (/api/email/send).
 */

export interface SendEmailClientParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  idempotencyKey?: string;
  templateType?: 'welcome' | 'submission_status' | 'tgm_approval' | 'verification_code' | 'general';
  metadata?: Record<string, any>;
}

export async function sendEmailViaServer(params: SendEmailClientParams): Promise<{
  success: boolean;
  jobId?: string;
  status?: string;
  message?: string;
}> {
  try {
    const response = await fetch('/api/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.warn('Server email request warning:', errData);
      return { success: false, message: errData.error || 'Failed to dispatch email' };
    }

    const data = await response.json();
    return data;
  } catch (err: any) {
    console.warn('Network error dispatching email via server:', err?.message || err);
    return { success: false, message: 'Network error contacting email service' };
  }
}

/**
 * Send Welcome Email on Registration
 */
export async function sendWelcomeEmail(data: {
  email: string;
  name: string;
  role: string;
}): Promise<void> {
  const roleTitle =
    data.role === 'superadmin'
      ? 'Principal & Super Admin'
      : data.role === 'admin'
      ? 'Teacher Guardian Mentor (TGM)'
      : data.role === 'cr'
      ? 'Class Representative (CR)'
      : 'Student';

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px;">
      <div style="background-color: #312e81; padding: 16px 20px; border-radius: 8px; text-align: center;">
        <h2 style="color: #ffffff; margin: 0; font-size: 20px;">Thakur College of Engineering & Technology</h2>
        <p style="color: #c7d2fe; margin: 4px 0 0 0; font-size: 12px;">AICTE Activity Diary & Portfolio Portal</p>
      </div>

      <div style="padding: 20px 0;">
        <h3 style="color: #1e293b; margin-top: 0;">Welcome to TCET AICTE Portal, ${data.name}!</h3>
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">
          Your account has been successfully initialized on the TCET AICTE Activity Points Portal.
        </p>
        
        <div style="background-color: #f8fafc; border-left: 4px solid #4f46e5; padding: 12px 16px; border-radius: 4px; margin: 16px 0;">
          <p style="margin: 0; font-size: 13px; color: #334155;"><strong>Email:</strong> ${data.email}</p>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #334155;"><strong>Assigned Role:</strong> ${roleTitle}</p>
        </div>

        <p style="color: #64748b; font-size: 13px;">
          You can now log in, submit activity certificates, track Stage-1 & Stage-2 approvals, and generate your official 28-page TCET Activity Diary PDF.
        </p>
      </div>

      <div style="border-t: 1px solid #f1f5f9; padding-top: 16px; text-align: center; color: #94a3b8; font-size: 11px;">
        Thakur College of Engineering & Technology (Autonomous Institute Affiliated to University of Mumbai)
      </div>
    </div>
  `;

  await sendEmailViaServer({
    to: data.email,
    subject: `Welcome to TCET AICTE Portal - ${data.name}`,
    html,
    templateType: 'welcome',
    idempotencyKey: `welcome_${data.email.trim().toLowerCase()}`,
  });
}

/**
 * Send Notification Email for Activity Certificate Status Change (Stage-1 Check / Stage-2 Approval / Rejection)
 */
export async function sendSubmissionStatusNotification(data: {
  studentEmail: string;
  studentName: string;
  activityName: string;
  points: number;
  status: 'pending_cr' | 'pending_admin' | 'approved' | 'rejected' | 'resubmission_requested';
  remarks?: string;
  updatedBy: string;
  submissionId: string;
}): Promise<void> {
  let statusBadge = '';
  let statusTitle = '';

  if (data.status === 'pending_admin') {
    statusBadge = '<span style="background-color: #e0e7ff; color: #3730a3; padding: 4px 10px; border-radius: 9999px; font-weight: bold; font-size: 12px;">Stage-1 Checked (CR ✓)</span>';
    statusTitle = 'Stage-1 Verification Complete (CR Checked)';
  } else if (data.status === 'approved') {
    statusBadge = '<span style="background-color: #dcfce7; color: #166534; padding: 4px 10px; border-radius: 9999px; font-weight: bold; font-size: 12px;">Stage-2 Approved (TGM Approved ✓✓)</span>';
    statusTitle = 'AICTE Activity Points Awarded!';
  } else if (data.status === 'rejected') {
    statusBadge = '<span style="background-color: #fee2e2; color: #991b1b; padding: 4px 10px; border-radius: 9999px; font-weight: bold; font-size: 12px;">Rejected</span>';
    statusTitle = 'AICTE Activity Certificate Update';
  } else if (data.status === 'resubmission_requested') {
    statusBadge = '<span style="background-color: #fef3c7; color: #92400e; padding: 4px 10px; border-radius: 9999px; font-weight: bold; font-size: 12px;">Resubmission Requested</span>';
    statusTitle = 'Resubmission Requested for AICTE Activity';
  }

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px;">
      <div style="background-color: #1e1b4b; padding: 16px 20px; border-radius: 8px; text-align: center;">
        <h2 style="color: #ffffff; margin: 0; font-size: 20px;">TCET AICTE Activity Portal</h2>
        <p style="color: #a5b4fc; margin: 4px 0 0 0; font-size: 12px;">Certificate Status Update</p>
      </div>

      <div style="padding: 20px 0;">
        <p style="color: #334155; font-size: 14px;">Dear <strong>${data.studentName}</strong>,</p>
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">
          Your AICTE Activity submission status has been updated:
        </p>

        <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <div style="margin-bottom: 12px;">${statusBadge}</div>
          <p style="margin: 4px 0; font-size: 13px; color: #1e293b;"><strong>Activity Name:</strong> ${data.activityName}</p>
          <p style="margin: 4px 0; font-size: 13px; color: #1e293b;"><strong>Claimed Points:</strong> ${data.points} Points</p>
          <p style="margin: 4px 0; font-size: 13px; color: #1e293b;"><strong>Updated By:</strong> ${data.updatedBy}</p>
          ${data.remarks ? `<p style="margin: 8px 0 0 0; font-size: 13px; color: #475569; background: #ffffff; padding: 8px; border-radius: 4px; border: 1px italic #e2e8f0;"><strong>Remarks:</strong> ${data.remarks}</p>` : ''}
        </div>

        <p style="color: #64748b; font-size: 13px;">
          Log into your student dashboard to review your progress towards the 100 AICTE Activity Points requirement.
        </p>
      </div>

      <div style="border-t: 1px solid #f1f5f9; padding-top: 16px; text-align: center; color: #94a3b8; font-size: 11px;">
        TCET AICTE Activity Points System • Submission ID: ${data.submissionId}
      </div>
    </div>
  `;

  await sendEmailViaServer({
    to: data.studentEmail,
    subject: `[TCET AICTE] ${statusTitle}: ${data.activityName}`,
    html,
    templateType: 'submission_status',
    idempotencyKey: `sub_status_${data.submissionId}_${data.status}_${Date.now()}`,
  });
}

/**
 * Send Notification Email for TGM / Admin Whitelist Approval / Rejection
 */
export async function sendTgmApprovalNotification(data: {
  tgmEmail: string;
  tgmName: string;
  status: 'approved' | 'rejected';
  approvedBy: string;
}): Promise<void> {
  const isApproved = data.status === 'approved';

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px;">
      <div style="background-color: ${isApproved ? '#065f46' : '#991b1b'}; padding: 16px 20px; border-radius: 8px; text-align: center;">
        <h2 style="color: #ffffff; margin: 0; font-size: 20px;">TCET AICTE Management Portal</h2>
        <p style="color: #e2e8f0; margin: 4px 0 0 0; font-size: 12px;">TGM Faculty Access Request Update</p>
      </div>

      <div style="padding: 20px 0;">
        <p style="color: #334155; font-size: 14px;">Respected <strong>${data.tgmName}</strong>,</p>
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">
          Your Teacher Guardian Mentor (TGM) / Admin Whitelist access request has been <strong>${data.status.toUpperCase()}</strong> by <strong>${data.approvedBy}</strong>.
        </p>

        ${
          isApproved
            ? `<div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 14px; border-radius: 8px; margin: 16px 0; font-size: 13px;">
                ✓ You now have full Stage-2 Verification & Admin Portal authority to approve student AICTE activity points and access department analytics.
               </div>`
            : `<div style="background-color: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 14px; border-radius: 8px; margin: 16px 0; font-size: 13px;">
                Your request was not authorized at this time. Please contact the Principal / Super Admin Office for details.
               </div>`
        }
      </div>

      <div style="border-t: 1px solid #f1f5f9; padding-top: 16px; text-align: center; color: #94a3b8; font-size: 11px;">
        Thakur College of Engineering & Technology Institutional Office
      </div>
    </div>
  `;

  await sendEmailViaServer({
    to: data.tgmEmail,
    subject: `[TCET Portal] TGM Access Request ${isApproved ? 'Approved ✓' : 'Notice'}`,
    html,
    templateType: 'tgm_approval',
    idempotencyKey: `tgm_approval_${data.tgmEmail.trim().toLowerCase()}_${data.status}`,
  });
}

/**
 * Dispatch 6-digit email verification code via Resend
 */
export async function sendVerificationCodeResend(
  email: string,
  name?: string
): Promise<{ success: boolean; message?: string; codeHint?: string }> {
  try {
    const res = await fetch('/api/auth/send-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), name }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to send verification code via Resend Email Service');
    }
    return data;
  } catch (err: any) {
    console.error('Error sending verification code:', err);
    throw err;
  }
}

/**
 * Verify 6-digit code sent via Resend
 */
export async function verifyEmailCodeResend(
  email: string,
  code: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch('/api/auth/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Invalid or expired verification code');
    }
    return data;
  } catch (err: any) {
    console.error('Error verifying code:', err);
    throw err;
  }
}

/**
 * Check if an email has been verified via Resend Service
 */
export async function checkEmailVerificationStatus(email: string): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/check-verification-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
    const data = await res.json();
    return Boolean(data.verified);
  } catch (err) {
    return false;
  }
}

