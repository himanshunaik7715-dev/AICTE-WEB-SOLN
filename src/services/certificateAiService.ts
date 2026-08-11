import { GoogleGenAI } from '@google/genai';

export interface ClassificationResult {
  category: string; // 'CAT-01' through 'CAT-15' or 'unrecognized'
  title: string | null;
  reason: string;
}

const SYSTEM_INSTRUCTION = `You are reading a student's certificate PDF for a college certificate verification portal. The file's name did not follow the required naming convention, so you need to read the document itself and extract the correct category and title so it can be filed correctly.

Output a single JSON object and nothing else — no markdown formatting, no code fences, no commentary before or after it. It must be valid JSON that can be parsed directly by an automated pipeline.

Return exactly these fields:

category — pick the single best match from this fixed list. Never invent a new category:
CAT-01: Literacy & Education Drive
CAT-02: Sports & Physical Fitness Support
CAT-03: Rural Development & Swachh Bharat
CAT-04: Disaster Relief & Healthcare Assistance
CAT-05: Environmental Protection & Energy Saving
CAT-06: Innovation, Hackathons & Competitions
CAT-07: Blood Donation & Health Awareness
CAT-08: NGO Volunteering & Community Care
CAT-09: Technical Event Organizing & Leadership
CAT-10: NSS / NCC / Cultural Activity
CAT-11: Digital Literacy & Cyber Security Training
CAT-12: Skill Development & Entrepreneurship
CAT-13: Women Empowerment & Social Equity
CAT-14: Student Body & Club Leadership
CAT-15: Industry Visits & Community Research
Use the code only (e.g. "CAT-06"), not the full name.

title — a short, clean title for the certificate/achievement (max 8 words), derived from the document content, not the filename.
reason — one short sentence explaining why you chose this category.

If the document is not actually a certificate (e.g. it's a resume, a blank page, or unreadable), set category to "unrecognized", title to null, and explain why in reason. Do not guess a category if the document genuinely doesn't support one — "unrecognized" results are routed to a human for manual review, so it's always safe to use it when unsure.`;

export async function classifyCertificatePdf(input: {
  fileData?: string; // base64 string
  mimeType?: string; // e.g. application/pdf, image/png
  fileName?: string;
  fileText?: string;
}): Promise<ClassificationResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const parts: any[] = [];

  if (input.fileData) {
    parts.push({
      inlineData: {
        mimeType: input.mimeType || 'application/pdf',
        data: input.fileData,
      },
    });
  }

  let textPrompt = 'Please analyze this certificate document and output the category, title, and reason in JSON format.';
  if (input.fileName) {
    textPrompt += ` File name: "${input.fileName}".`;
  }
  if (input.fileText) {
    textPrompt += ` Extracted text content:\n${input.fileText}`;
  }

  parts.push({ text: textPrompt });

  const response = await ai.models.generateContent({
    model: 'gemini-3.6-flash',
    contents: { parts },
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.15,
      responseMimeType: 'application/json',
    },
  });

  const rawText = response.text || '';
  const cleanedText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

  try {
    const parsed = JSON.parse(cleanedText);
    return {
      category: parsed.category || 'unrecognized',
      title: parsed.title ?? null,
      reason: parsed.reason || 'No explanation provided.',
    };
  } catch (err) {
    console.warn('Failed to parse Gemini classification JSON response:', rawText, err);
    return {
      category: 'unrecognized',
      title: null,
      reason: 'Failed to parse AI response into structured JSON format.',
    };
  }
}
