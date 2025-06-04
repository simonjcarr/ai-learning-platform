# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AI-powered IT learning platform built with Next.js that dynamically generates educational content. The platform features:

- **Authentication**: Clerk-based mandatory authentication for all routes
- **AI Content Generation**: Multi-provider AI service (OpenAI, Google Gemini, Anthropic Claude) for dynamic article generation
- **Interactive Learning**: Generated quizzes and examples with AI-powered marking
- **Database**: PostgreSQL with Prisma ORM, complex schema with 20+ models
- **Background Jobs**: BullMQ with Redis for email processing
- **Payments**: Stripe integration for subscription management
- **Email**: Mailgun integration with template system

## Development Commands

```bash
# Development (with Turbopack)
npm run dev

# Development with background workers
npm run dev:all    # Starts Next.js + Email Worker
npm run dev:email  # Alternative command for dev with email worker

# Database operations
npm run db:generate    # Generate Prisma client
npm run db:migrate     # Run database migrations (development)
npm run db:migrate:prod # Deploy migrations (production)
npm run db:push        # Push schema changes (development)
npm run db:studio      # Open Prisma Studio
npm run db:setup       # Generate client + run migrations

# Build and production
npm run build
npm run start
npm run start:all  # Production with email worker

# Linting and code quality
npm run lint  # ESLint

# Background workers
npm run worker:email  # Start email worker manually

# Stripe setup (run once)
npm run stripe:setup    # Create Stripe products
npm run stripe:portal   # Setup customer portal

# Utility scripts
npm run delete-user     # Delete user script
npm run update-role     # Update user role script
```

## Architecture Overview

### Core Application Structure

- **Next.js App Router**: All routes in `src/app/` with extensive API routes in `src/app/api/`
- **Database Layer**: Prisma with complex relational schema supporting users, articles, categories, AI interactions, subscriptions
- **AI Service**: Centralized AI abstraction (`src/lib/ai-service.ts`) supporting multiple providers with cost tracking
- **Authentication**: Clerk middleware (`src/middleware.ts`) protecting routes, webhook sync for user management
- **Background Jobs**: BullMQ workers for email processing

### Key Architectural Patterns

**Multi-Provider AI Service**: The `ai-service.ts` uses a database-driven approach where AI models are stored in the database with encrypted API keys. Different interaction types (article generation, search suggestions, etc.) can use different models.

**Content Generation Flow**:
1. User searches → AI suggests articles/categories
2. Articles created with placeholder content  
3. AI generates full content when accessed
4. Interactive examples generated on-demand
5. AI-powered chat and suggestion validation

**Subscription Management**: Stripe webhooks update user subscription status, role-based access control (USER/EDITOR/MODERATOR/ADMIN), subscription tiers affect AI usage limits.

**Email System**: Template-based emails with variable substitution, BullMQ queuing, Mailgun delivery, comprehensive logging.

### Database Schema Highlights

- **Users**: Clerk integration with local user data, subscription tracking, role-based permissions
- **Articles**: Content generation tracking, change history, flagging system, categories/tags many-to-many
- **AI Tracking**: Complete cost tracking for all AI interactions by model/user/type
- **Interactive Examples**: Three question types with AI-powered marking
- **Suggestions**: User-submitted article improvements with AI validation
- **Email Templates**: Dynamic template system with logging and delivery tracking

### Important Files

- `src/lib/ai-service.ts`: Multi-provider AI abstraction with cost tracking
- `src/lib/prisma.ts`: Database client setup
- `src/lib/auth.ts`: Authentication utilities  
- `src/workers/email.worker.ts`: Background email processing
- `prisma/schema.prisma`: Complete database schema
- `src/middleware.ts`: Route protection with Clerk

## Testing and Code Quality

- Run `npm run lint` before committing changes
- Database changes require migrations: `npm run db:migrate`
- Test AI integrations thoroughly as they involve external API costs
- Use `npm run db:studio` to inspect database state during development

## Environment Setup

Critical environment variables (see README.md):
- Database: `DATABASE_URL`
- Clerk: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`
- AI providers: `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `ANTHROPIC_API_KEY`
- Stripe: Keys for subscription management
- Email: Mailgun configuration
- Redis: For BullMQ job queue

## Development Notes

- AI models are managed in the database - use admin interface to add/configure models
- Article content generation is expensive - test with minimal examples
- Background email worker required for full functionality
- Webhook endpoints need proper secret validation
- Database has complex foreign key relationships - be careful with deletions
- Cost tracking is comprehensive - monitor AI usage in production
- After making any changes always run `npm run build` and fix any errors you find.
- Don't change, add or delete anything that is not directly related to the task given to you
- Components should be as small as possible, where possible break down the task into smaller components. Keep related components together in well named folders

## Database
When making changes to the database schema, it should be done in a way that avoids requiring a database reset.
when migrating data, always do it in a way that prevents tables being truncated. This is important for both development and when we merge changes into production.