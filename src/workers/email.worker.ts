import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { sendEmail } from '@/lib/mailgun';
import { EmailJobData } from '@/lib/bullmq';
import { PrismaClient, EmailStatus } from '@prisma/client';

const prisma = new PrismaClient();
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

async function processEmailJob(job: Job<EmailJobData>) {
  const { to, subject, text, html, template, templateData, from, replyTo, attachments } = job.data;
  
  let emailLogId: string | null = null;
  let templateId: string | null = null;
  let finalSubject = subject;
  let finalHtml = html;
  let finalText = text;
  let finalFrom = from;

  try {
    // If using a template, fetch it from the database
    if (template) {
      const emailTemplate = await prisma.emailTemplate.findUnique({
        where: { templateKey: template, isActive: true },
      });

      if (emailTemplate) {
        templateId = emailTemplate.templateId;
        
        // Process template variables
        if (templateData && emailTemplate.htmlContent) {
          finalHtml = processTemplateVariables(emailTemplate.htmlContent, templateData);
          finalSubject = processTemplateVariables(emailTemplate.subject, templateData);
          
          if (emailTemplate.textContent) {
            finalText = processTemplateVariables(emailTemplate.textContent, templateData);
          }
        } else {
          finalHtml = emailTemplate.htmlContent;
          finalSubject = emailTemplate.subject;
          finalText = emailTemplate.textContent || undefined;
        }

        // Use template's from settings if not overridden
        if (!from && emailTemplate.fromEmail) {
          finalFrom = emailTemplate.fromName 
            ? `${emailTemplate.fromName} <${emailTemplate.fromEmail}>`
            : emailTemplate.fromEmail;
        }
      }
    }

    // Create email log entry
    const emailLog = await prisma.emailLog.create({
      data: {
        templateId,
        to: Array.isArray(to) ? to.join(', ') : to,
        from: finalFrom || `${process.env.MAILGUN_FROM_NAME || 'IT Learning Platform'} <${process.env.MAILGUN_FROM_EMAIL}>`,
        subject: finalSubject,
        status: EmailStatus.PENDING,
        metadata: job.data as any,
      },
    });
    emailLogId = emailLog.logId;

    // Send email via Mailgun
    const result = await sendEmail({
      to,
      subject: finalSubject,
      text: finalText,
      html: finalHtml,
      from: finalFrom,
      replyTo,
      attachments: attachments?.map(att => ({
        filename: att.filename,
        data: Buffer.from(att.content),
        contentType: att.contentType,
      })),
    });

    // Update log with success
    await prisma.emailLog.update({
      where: { logId: emailLogId },
      data: {
        status: EmailStatus.SENT,
        messageId: result.id,
      },
    });

    console.log(`Email sent successfully: ${result.id}`);
    return { success: true, messageId: result.id };
  } catch (error) {
    console.error('Email sending failed:', error);
    
    // Update log with failure
    if (emailLogId) {
      await prisma.emailLog.update({
        where: { logId: emailLogId },
        data: {
          status: EmailStatus.FAILED,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }

    throw error;
  }
}

function processTemplateVariables(template: string, data: Record<string, any>): string {
  let processed = template;
  
  // Add global variables that are always available
  const globalVariables = {
    siteName: process.env.SITE_NAME || process.env.MAILGUN_FROM_NAME || 'IT Learning Platform',
    siteUrl: process.env.SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://localhost:3000',
    currentYear: new Date().getFullYear().toString(),
    supportEmail: process.env.MAILGUN_FROM_EMAIL || 'support@yourdomain.com',
    ...data, // User-provided data takes precedence
  };
  
  // Replace {{variable}} with data values
  Object.entries(globalVariables).forEach(([key, value]) => {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    processed = processed.replace(regex, String(value));
  });
  
  return processed;
}

// Create the worker
export const emailWorker = new Worker('email', processEmailJob, {
  connection: connection.duplicate(),
  concurrency: 5,
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 100 },
});

emailWorker.on('completed', (job) => {
  console.log(`Email job ${job.id} completed`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`Email job ${job?.id} failed:`, err);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down email worker...');
  await emailWorker.close();
  await prisma.$disconnect();
  process.exit(0);
});