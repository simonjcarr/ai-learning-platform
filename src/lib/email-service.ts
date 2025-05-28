import { addEmailToQueue } from "./bullmq";

export interface SendTemplateEmailOptions {
  to: string | string[];
  templateKey: string;
  variables?: Record<string, any>;
  replyTo?: string;
}

export async function sendTemplateEmail(options: SendTemplateEmailOptions) {
  const { to, templateKey, variables, replyTo } = options;

  try {
    const job = await addEmailToQueue({
      to,
      subject: "", // Will be filled by template
      template: templateKey,
      templateData: variables,
      replyTo,
    });

    return { success: true, jobId: job.id };
  } catch (error) {
    console.error("Failed to queue email:", error);
    throw error;
  }
}

// Predefined email sending functions for common scenarios
export const emails = {
  // User welcome email
  async sendWelcomeEmail(userId: string, email: string, firstName?: string, lastName?: string) {
    return sendTemplateEmail({
      to: email,
      templateKey: "welcome_email",
      variables: {
        firstName: firstName || "User",
        lastName: lastName || "",
        email,
        userId,
      },
    });
  },

  // Comment notification
  async sendCommentNotification(
    recipientEmail: string,
    commenterName: string,
    articleTitle: string,
    articleSlug: string,
    commentContent: string
  ) {
    return sendTemplateEmail({
      to: recipientEmail,
      templateKey: "comment_notification",
      variables: {
        commenterName,
        articleTitle,
        articleUrl: `${process.env.NEXT_PUBLIC_APP_URL}/articles/${articleSlug}`,
        commentContent,
      },
    });
  },

  // Article flagged notification
  async sendArticleFlaggedNotification(
    adminEmails: string[],
    articleTitle: string,
    flaggedBy: string,
    flagReason: string
  ) {
    return sendTemplateEmail({
      to: adminEmails,
      templateKey: "article_flagged",
      variables: {
        articleTitle,
        flaggedBy,
        flagReason,
        adminUrl: `${process.env.NEXT_PUBLIC_APP_URL}/admin/flagged`,
      },
    });
  },

  // Subscription confirmation
  async sendSubscriptionConfirmation(
    email: string,
    firstName: string,
    tier: string,
    amount: number
  ) {
    return sendTemplateEmail({
      to: email,
      templateKey: "subscription_confirmation",
      variables: {
        firstName,
        tier,
        amount: (amount / 100).toFixed(2), // Convert from cents
        billingPortalUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/subscription/portal`,
      },
    });
  },

  // Article suggestion approved
  async sendSuggestionApproved(
    email: string,
    firstName: string,
    articleTitle: string,
    articleSlug: string
  ) {
    return sendTemplateEmail({
      to: email,
      templateKey: "suggestion_approved",
      variables: {
        firstName,
        articleTitle,
        articleUrl: `${process.env.NEXT_PUBLIC_APP_URL}/articles/${articleSlug}`,
      },
    });
  },

  // Achievement unlocked
  async sendAchievementUnlocked(
    email: string,
    firstName: string,
    achievementName: string,
    achievementDescription: string
  ) {
    return sendTemplateEmail({
      to: email,
      templateKey: "achievement_unlocked",
      variables: {
        firstName,
        achievementName,
        achievementDescription,
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/achievements`,
      },
    });
  },
};