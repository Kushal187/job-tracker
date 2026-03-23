import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { requireAuthenticatedUser } from '@/lib/auth';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { getGmailEnv } from '@/lib/env';

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request);
  if ('response' in auth) return auth.response;

  // Try user's DB config first, fall back to env vars
  const supabase = getSupabaseAdminClient();
  const { data: emailConfig } = await supabase
    .from('email_config')
    .select('gmail_email, gmail_app_password')
    .eq('user_id', auth.user.id)
    .single();

  const gmailCreds = emailConfig?.gmail_email && emailConfig?.gmail_app_password
    ? { email: emailConfig.gmail_email, appPassword: emailConfig.gmail_app_password }
    : getGmailEnv();

  if (!gmailCreds) {
    return NextResponse.json(
      { error: 'Email not configured. Go to the Settings tab and add your Gmail credentials.' },
      { status: 503 }
    );
  }

  let recruiterIds: string[];
  let subject: string;
  let emailBody: string;
  let templateId: string | undefined;
  let resumeBuffer: Buffer | null = null;
  let resumeFilename = 'resume.pdf';

  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    recruiterIds = JSON.parse(formData.get('recruiterIds') as string || '[]');
    subject = formData.get('subject') as string || '';
    emailBody = formData.get('emailBody') as string || '';
    templateId = formData.get('templateId') as string | undefined;

    const resumeFile = formData.get('resume') as File | null;
    if (resumeFile && resumeFile.size > 0) {
      const arrayBuffer = await resumeFile.arrayBuffer();
      resumeBuffer = Buffer.from(arrayBuffer);
      resumeFilename = resumeFile.name || 'resume.pdf';
    }
  } else {
    const body = await request.json();
    recruiterIds = body.recruiterIds || [];
    subject = body.subject || '';
    emailBody = body.body || '';
    templateId = body.templateId;
  }

  if (!recruiterIds || recruiterIds.length === 0) {
    return NextResponse.json({ error: 'recruiterIds array is required' }, { status: 400 });
  }

  if (!subject || !emailBody) {
    return NextResponse.json({ error: 'subject and body are required' }, { status: 400 });
  }

  const { data: recruiters, error: fetchError } = await supabase
    .from('recruiters')
    .select('*')
    .eq('user_id', auth.user.id)
    .in('id', recruiterIds);

  if (fetchError || !recruiters) {
    return NextResponse.json({ error: 'Failed to fetch recruiters' }, { status: 500 });
  }

  if (recruiters.length === 0) {
    return NextResponse.json({ error: 'No matching recruiters found' }, { status: 404 });
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailCreds.email,
      pass: gmailCreds.appPassword
    }
  });

  const results: Array<{ recruiterId: string; email: string; status: string; error?: string }> = [];

  const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` || request.headers.get('origin') || 'http://localhost:3000';
  const appUrl = rawAppUrl.replace(/\/+$/, '');

  for (const recruiter of recruiters) {
    const personalizedSubject = replacePlaceholders(subject, recruiter);
    const personalizedBody = replacePlaceholders(emailBody, recruiter);

    // Create log entry first to get the ID for the tracking pixel
    const { data: logEntry, error: logError } = await supabase.from('email_logs').insert({
      user_id: auth.user.id,
      recruiter_id: recruiter.id,
      template_id: templateId || null,
      subject: personalizedSubject,
      body: personalizedBody,
      status: 'pending'
    }).select('id').single();

    if (logError || !logEntry) {
      results.push({ recruiterId: recruiter.id, email: recruiter.email, status: 'failed', error: 'Failed to create log entry' });
      continue;
    }

    // Build HTML with tracking pixel
    const trackingPixel = `<img src="${appUrl}/api/track/${logEntry.id}/pixel.png" width="1" height="1" style="display:none" alt="" />`;
    const htmlBody = personalizedBody.replace(/\n/g, '<br/>') + trackingPixel;

    const mailOptions: nodemailer.SendMailOptions = {
      from: gmailCreds.email,
      to: recruiter.email,
      subject: personalizedSubject,
      html: htmlBody
    };

    if (resumeBuffer) {
      mailOptions.attachments = [
        {
          filename: resumeFilename,
          content: resumeBuffer,
          contentType: 'application/pdf'
        }
      ];
    }

    try {
      await transporter.sendMail(mailOptions);

      await supabase.from('email_logs').update({ status: 'sent' }).eq('id', logEntry.id);
      results.push({ recruiterId: recruiter.id, email: recruiter.email, status: 'sent' });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      await supabase.from('email_logs').update({ status: 'failed', error_message: errorMessage }).eq('id', logEntry.id);
      results.push({ recruiterId: recruiter.id, email: recruiter.email, status: 'failed', error: errorMessage });
    }
  }

  const sent = results.filter((r) => r.status === 'sent').length;
  const failed = results.filter((r) => r.status === 'failed').length;

  return NextResponse.json({ sent, failed, results });
}

function replacePlaceholders(
  text: string,
  recruiter: { name: string; email: string; company: string; title: string }
): string {
  return text
    .replace(/\{\{name\}\}/g, recruiter.name)
    .replace(/\{\{firstName\}\}/g, recruiter.name.split(' ')[0])
    .replace(/\{\{email\}\}/g, recruiter.email)
    .replace(/\{\{company\}\}/g, recruiter.company)
    .replace(/\{\{title\}\}/g, recruiter.title);
}
