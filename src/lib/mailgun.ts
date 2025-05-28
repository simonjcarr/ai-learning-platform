import formData from 'form-data';
import Mailgun from 'mailgun.js';

const mailgun = new Mailgun(formData);

const mg = mailgun.client({
  username: 'api',
  key: process.env.MAILGUN_API_KEY || '',
});

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    data: Buffer | string;
    contentType?: string;
  }>;
}

export async function sendEmail(options: SendEmailOptions) {
  const { to, subject, text, html, from, replyTo, attachments } = options;

  const domain = process.env.MAILGUN_DOMAIN;
  if (!domain) {
    throw new Error('MAILGUN_DOMAIN is not configured');
  }

  if (!process.env.MAILGUN_API_KEY) {
    throw new Error('MAILGUN_API_KEY is not configured');
  }

  const defaultFrom = `${process.env.MAILGUN_FROM_NAME || 'IT Learning Platform'} <${process.env.MAILGUN_FROM_EMAIL || 'noreply@' + domain}>`;

  const messageData: any = {
    from: from || defaultFrom,
    to: Array.isArray(to) ? to.join(', ') : to,
    subject,
    text,
    html,
  };

  if (replyTo) {
    messageData['h:Reply-To'] = replyTo;
  }

  if (attachments && attachments.length > 0) {
    messageData.attachment = attachments.map((att) => ({
      filename: att.filename,
      data: att.data,
      contentType: att.contentType,
    }));
  }

  try {
    const result = await mg.messages.create(domain, messageData);
    return result;
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
}

export async function validateEmail(email: string): Promise<boolean> {
  try {
    const result = await mg.validate.get(email);
    return result.is_valid || false;
  } catch (error) {
    console.error('Email validation failed:', error);
    return false;
  }
}