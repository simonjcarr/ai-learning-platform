import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

const emailTemplates = [
  {
    templateKey: "welcome_email",
    templateName: "Welcome Email",
    description: "Sent to new users when they sign up",
    subject: "Welcome to {{siteName}}, {{firstName}}!",
    htmlContent: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f8f9fa; }
    .button { display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to {{siteName}}!</h1>
    </div>
    <div class="content">
      <h2>Hi {{firstName}},</h2>
      <p>Thank you for joining our community of IT learners! We're excited to have you on board.</p>
      <p>Here's what you can do to get started:</p>
      <ul>
        <li>Browse our extensive library of IT articles and tutorials</li>
        <li>Engage with interactive examples and quizzes</li>
        <li>Join discussions with other learners</li>
        <li>Track your learning progress</li>
      </ul>
      <center>
        <a href="{{siteUrl}}/dashboard" class="button">Go to Dashboard</a>
      </center>
      <p>If you have any questions, feel free to reach out to our support team at {{supportEmail}}.</p>
      <p>Happy learning!</p>
    </div>
    <div class="footer">
      <p>&copy; {{currentYear}} {{siteName}}. All rights reserved.</p>
      <p>This email was sent to {{email}}</p>
    </div>
  </div>
</body>
</html>`,
    textContent: `Hi {{firstName}},

Welcome to {{siteName}}!

Thank you for joining our community of IT learners! We're excited to have you on board.

Here's what you can do to get started:
- Browse our extensive library of IT articles and tutorials
- Engage with interactive examples and quizzes
- Join discussions with other learners
- Track your learning progress

Visit your dashboard: {{siteUrl}}/dashboard

If you have any questions, feel free to reach out to our support team at {{supportEmail}}.

Happy learning!

{{siteName}}

This email was sent to {{email}}`,
    variables: [
      { name: "firstName", description: "User's first name", defaultValue: "User" },
      { name: "lastName", description: "User's last name", defaultValue: "" },
      { name: "email", description: "User's email address" },
      { name: "userId", description: "User's ID" },
      { name: "siteName", description: "Name of the website (global)", defaultValue: "IT Learning Platform" },
      { name: "siteUrl", description: "URL of the website (global)" },
      { name: "supportEmail", description: "Support email address (global)" },
      { name: "currentYear", description: "Current year (global)" },
    ],
  },
  {
    templateKey: "comment_notification",
    templateName: "New Comment Notification",
    description: "Sent when someone replies to a user's comment",
    subject: "{{commenterName}} replied to your comment",
    htmlContent: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f8f9fa; }
    .comment-box { background-color: white; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0; }
    .button { display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>New Comment Reply</h1>
    </div>
    <div class="content">
      <p><strong>{{commenterName}}</strong> replied to your comment on "<strong>{{articleTitle}}</strong>":</p>
      <div class="comment-box">
        {{commentContent}}
      </div>
      <center>
        <a href="{{articleUrl}}" class="button">View Comment</a>
      </center>
    </div>
  </div>
</body>
</html>`,
    textContent: `{{commenterName}} replied to your comment on "{{articleTitle}}":

{{commentContent}}

View the comment: {{articleUrl}}`,
    variables: [
      { name: "commenterName", description: "Name of the person who commented" },
      { name: "articleTitle", description: "Title of the article" },
      { name: "articleUrl", description: "URL to the article" },
      { name: "commentContent", description: "Content of the comment" },
    ],
  },
  {
    templateKey: "article_flagged",
    templateName: "Article Flagged Notification",
    description: "Sent to admins when an article is flagged",
    subject: "Article Flagged for Review: {{articleTitle}}",
    htmlContent: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #dc2626; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f8f9fa; }
    .alert-box { background-color: #fee2e2; border: 1px solid #dc2626; padding: 15px; margin: 20px 0; border-radius: 5px; }
    .button { display: inline-block; padding: 12px 24px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Content Flagged for Review</h1>
    </div>
    <div class="content">
      <div class="alert-box">
        <p><strong>Article:</strong> {{articleTitle}}</p>
        <p><strong>Flagged by:</strong> {{flaggedBy}}</p>
        <p><strong>Reason:</strong> {{flagReason}}</p>
      </div>
      <p>Please review this content and take appropriate action.</p>
      <center>
        <a href="{{adminUrl}}" class="button">Review in Admin Panel</a>
      </center>
    </div>
  </div>
</body>
</html>`,
    textContent: `Content Flagged for Review

Article: {{articleTitle}}
Flagged by: {{flaggedBy}}
Reason: {{flagReason}}

Please review this content and take appropriate action.

Review in Admin Panel: {{adminUrl}}`,
    variables: [
      { name: "articleTitle", description: "Title of the flagged article" },
      { name: "flaggedBy", description: "User who flagged the content" },
      { name: "flagReason", description: "Reason for flagging" },
      { name: "adminUrl", description: "URL to admin panel" },
    ],
  },
  {
    templateKey: "subscription_confirmation",
    templateName: "Subscription Confirmation",
    description: "Sent after successful subscription payment",
    subject: "Subscription Confirmed - {{tier}} Plan",
    htmlContent: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #059669; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f8f9fa; }
    .success-box { background-color: #d1fae5; border: 1px solid #059669; padding: 15px; margin: 20px 0; border-radius: 5px; }
    .button { display: inline-block; padding: 12px 24px; background-color: #059669; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Subscription Confirmed!</h1>
    </div>
    <div class="content">
      <p>Hi {{firstName}},</p>
      <div class="success-box">
        <p><strong>Your {{tier}} subscription is now active!</strong></p>
        <p>Amount paid: ${{amount}}/month</p>
      </div>
      <p>Thank you for upgrading your account. You now have access to all {{tier}} features.</p>
      <center>
        <a href="{{billingPortalUrl}}" class="button">Manage Subscription</a>
      </center>
    </div>
  </div>
</body>
</html>`,
    textContent: `Hi {{firstName}},

Your {{tier}} subscription is now active!
Amount paid: ${{amount}}/month

Thank you for upgrading your account. You now have access to all {{tier}} features.

Manage your subscription: {{billingPortalUrl}}`,
    variables: [
      { name: "firstName", description: "User's first name" },
      { name: "tier", description: "Subscription tier name" },
      { name: "amount", description: "Monthly amount in dollars" },
      { name: "billingPortalUrl", description: "URL to billing portal" },
    ],
  },
  {
    templateKey: "suggestion_approved",
    templateName: "Suggestion Approved",
    description: "Sent when a user's article suggestion is approved",
    subject: "Your suggestion for '{{articleTitle}}' was approved!",
    htmlContent: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #059669; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f8f9fa; }
    .celebrate-box { background-color: #fef3c7; border: 1px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 5px; text-align: center; }
    .button { display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Suggestion Approved! 🎉</h1>
    </div>
    <div class="content">
      <p>Hi {{firstName}},</p>
      <p>Great news! Your suggestion for the article "<strong>{{articleTitle}}</strong>" has been approved and applied.</p>
      <div class="celebrate-box">
        <p>Thank you for contributing to our learning community!</p>
        <p>Your contribution helps make our content better for everyone.</p>
      </div>
      <center>
        <a href="{{articleUrl}}" class="button">View Updated Article</a>
      </center>
    </div>
  </div>
</body>
</html>`,
    textContent: `Hi {{firstName}},

Great news! Your suggestion for the article "{{articleTitle}}" has been approved and applied.

Thank you for contributing to our learning community! Your contribution helps make our content better for everyone.

View the updated article: {{articleUrl}}`,
    variables: [
      { name: "firstName", description: "User's first name" },
      { name: "articleTitle", description: "Title of the article" },
      { name: "articleUrl", description: "URL to the article" },
    ],
  },
];

async function seedEmailTemplates() {
  console.log("Seeding email templates...");

  for (const template of emailTemplates) {
    try {
      const existing = await prisma.emailTemplate.findUnique({
        where: { templateKey: template.templateKey },
      });

      if (existing) {
        console.log(`Template '${template.templateKey}' already exists, skipping...`);
        continue;
      }

      await prisma.emailTemplate.create({
        data: {
          ...template,
          variables: template.variables as any,
        },
      });

      console.log(`Created template: ${template.templateKey}`);
    } catch (error) {
      console.error(`Error creating template ${template.templateKey}:`, error);
    }
  }

  console.log("Email templates seeding complete!");
}

seedEmailTemplates()
  .catch((error) => {
    console.error("Error seeding email templates:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });