import formData from 'form-data';
import Mailgun from 'mailgun.js';

const mailgun = new Mailgun(formData);

// Initialize client lazily to ensure env vars are loaded
let mgClient: any;

function getMgClient() {
  if (!mgClient) {
    const apiKey = process.env.MAILGUN_API_KEY;
    if (!apiKey) {
      throw new Error('MAILGUN_API_KEY is not configured');
    }
    
    // Debug logging
    console.log('Mailgun initialization:', {
      apiKeyLength: apiKey.length,
      apiKeyPrefix: apiKey.substring(0, 10) + '...',
      domain: process.env.MAILGUN_DOMAIN,
    });
    
    // Check if using EU region
    const isEU = process.env.MAILGUN_REGION?.toUpperCase() === 'EU';
    const apiUrl = isEU ? 'https://api.eu.mailgun.net' : 'https://api.mailgun.net';
    
    console.log('Using Mailgun API URL:', apiUrl, '(Region:', process.env.MAILGUN_REGION || 'US', ')');
    
    mgClient = mailgun.client({
      username: 'api',
      key: apiKey,
      url: apiUrl,
    });
  }
  return mgClient;
}

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
    const mg = getMgClient();
    console.log('Sending email with domain:', domain);
    console.log('Message data:', {
      ...messageData,
      html: messageData.html ? '[HTML content]' : undefined,
      text: messageData.text ? '[Text content]' : undefined,
    });
    
    const result = await mg.messages.create(domain, messageData);
    return result;
  } catch (error: any) {
    console.error('Failed to send email:', error);
    if (error.status === 401) {
      console.error('Authentication failed. Please check:');
      console.error('1. API key is correct');
      console.error('2. Domain is verified in Mailgun');
      console.error('3. API key has permissions for this domain');
      console.error('4. You are using the correct region (US vs EU)');
    }
    throw error;
  }
}

export async function validateEmail(email: string): Promise<boolean> {
  try {
    const mg = getMgClient();
    const result = await mg.validate.get(email);
    return result.is_valid || false;
  } catch (error) {
    console.error('Email validation failed:', error);
    return false;
  }
}