# Email Template Variables

This document lists all variables available in email templates. Variables are used with the syntax `{{variableName}}` in email templates.

## Global Variables (Available in ALL emails)

These variables are automatically added to every email:

| Variable | Description | Example |
|----------|-------------|---------|
| `{{siteName}}` | Name of the website | IT Learning Platform |
| `{{siteUrl}}` | Base URL of the website | https://yourdomain.com |
| `{{supportEmail}}` | Support email address | support@yourdomain.com |
| `{{currentYear}}` | Current year | 2024 |

**Configuration**: Set in environment variables:
- `SITE_NAME` → `{{siteName}}`
- `SITE_URL` or `NEXT_PUBLIC_APP_URL` → `{{siteUrl}}`
- `MAILGUN_FROM_EMAIL` → `{{supportEmail}}`

## User Variables

### Basic User Info
| Variable | Description | Available In |
|----------|-------------|--------------|
| `{{firstName}}` | User's first name | All user-specific emails |
| `{{lastName}}` | User's last name | All user-specific emails |
| `{{email}}` | User's email address | All user-specific emails |
| `{{userId}}` | Clerk User ID | Welcome email |
| `{{username}}` | User's username | Comment notifications |

## Template-Specific Variables

### Welcome Email (`welcome_email`)
- `{{firstName}}` - User's first name
- `{{lastName}}` - User's last name  
- `{{email}}` - User's email address
- `{{userId}}` - Clerk user ID

### Comment Notification (`comment_notification`)
- `{{commenterName}}` - Name of person who commented
- `{{articleTitle}}` - Title of the article
- `{{articleUrl}}` - Full URL to the article
- `{{commentContent}}` - Content of the comment

### Subscription Confirmation (`subscription_confirmation`)
- `{{firstName}}` - User's first name
- `{{tier}}` - Subscription tier (STANDARD, MAX)
- `{{amount}}` - Monthly amount in dollars (e.g., "14.00")
- `{{billingPortalUrl}}` - URL to Stripe billing portal

### Suggestion Approved (`suggestion_approved`)
- `{{firstName}}` - User's first name
- `{{articleTitle}}` - Title of the article
- `{{articleUrl}}` - Full URL to the updated article

### Achievement Unlocked (`achievement_unlocked`)
- `{{firstName}}` - User's first name
- `{{achievementName}}` - Name of the achievement (e.g., "Bronze Contributor")
- `{{achievementDescription}}` - Description of what they achieved
- `{{dashboardUrl}}` - URL to achievements dashboard

### Article Flagged (`article_flagged`)
- `{{articleTitle}}` - Title of the flagged article
- `{{flaggedBy}}` - Name of person who flagged the content
- `{{flagReason}}` - Reason provided for flagging
- `{{adminUrl}}` - URL to admin flagged content panel

## URL Variables

These provide ready-to-use URLs for different parts of the site:

| Variable | Description | Example |
|----------|-------------|---------|
| `{{siteUrl}}/dashboard` | User dashboard | https://yourdomain.com/dashboard |
| `{{siteUrl}}/articles/{{articleSlug}}` | Specific article | https://yourdomain.com/articles/linux-basics |
| `{{billingPortalUrl}}` | Stripe billing portal | https://yourdomain.com/api/subscription/portal |
| `{{adminUrl}}` | Admin flagged content | https://yourdomain.com/admin/flagged |
| `{{dashboardUrl}}` | Achievements page | https://yourdomain.com/dashboard/achievements |

## Usage Examples

### In HTML Templates:
```html
<h1>Welcome to {{siteName}}, {{firstName}}!</h1>
<p>Visit your dashboard: <a href="{{siteUrl}}/dashboard">{{siteUrl}}/dashboard</a></p>
<p>Need help? Contact us at {{supportEmail}}</p>
<footer>&copy; {{currentYear}} {{siteName}}. All rights reserved.</footer>
```

### In Text Templates:
```text
Welcome to {{siteName}}, {{firstName}}!

Visit your dashboard: {{siteUrl}}/dashboard

Need help? Contact us at {{supportEmail}}

© {{currentYear}} {{siteName}}. All rights reserved.
```

### In Subject Lines:
```text
Welcome to {{siteName}}, {{firstName}}!
{{commenterName}} replied to your comment
Your {{tier}} subscription is confirmed
```

## Adding New Variables

To add new variables to specific email types:

1. **Update the email service function** in `/src/lib/email-service.ts`
2. **Update the template variables documentation** in the database
3. **Update this documentation**

Example:
```typescript
// In email-service.ts
await emails.sendWelcomeEmail(userId, email, firstName, lastName, {
  customVariable: "Custom Value"
});
```

## Environment Variable Mapping

| Environment Variable | Email Variable | Default Value |
|---------------------|----------------|---------------|
| `SITE_NAME` | `{{siteName}}` | "IT Learning Platform" |
| `SITE_URL` | `{{siteUrl}}` | `NEXT_PUBLIC_APP_URL` |
| `MAILGUN_FROM_EMAIL` | `{{supportEmail}}` | "support@yourdomain.com" |
| `MAILGUN_FROM_NAME` | `{{siteName}}` (fallback) | "IT Learning Platform" |

## Notes

- All variables are processed as strings
- Missing variables will remain as `{{variableName}}` in the output
- Global variables are added automatically to every email
- User-specific variables are only available when user data is provided
- Variables are case-sensitive: `{{firstName}}` ≠ `{{firstname}}`