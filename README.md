# IT Learning Platform

An AI-powered IT learning platform that generates dynamic content based on user searches. Features include AI-generated articles, interactive examples, and mandatory authentication.

## Features

- 🔐 **Mandatory Authentication** - Clerk authentication for user management
- 🤖 **AI-Powered Content** - Dynamic article and example generation
- 🔍 **Smart Search** - Enhanced search with AI suggestions
- 📝 **Interactive Examples** - Multiple choice, text input, and command-line questions
- 🎨 **Markdown Rendering** - Beautiful article display with syntax highlighting
- 🔄 **Multi-AI Provider Support** - Switch between OpenAI, Google Gemini, or Anthropic Claude

## Prerequisites

1. **Node.js** (v18 or higher)
2. **PostgreSQL Database**
3. **Clerk Account** - Sign up at [Clerk](https://clerk.com/) for authentication
4. **AI Provider API Key** - Choose your AI provider:
   - **OpenAI** - Sign up at [OpenAI](https://openai.com/) and get your API key
   - **Google Gemini** - Get an API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
   - **Anthropic Claude** - Get an API key from [Anthropic Console](https://console.anthropic.com/)

## Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd it-learning-platform
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Required environment variables:
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/it_learning_platform"

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
CLERK_WEBHOOK_SECRET="whsec_..."

# AI Configuration
AI_PROVIDER="openai"  # Options: openai, google, anthropic
AI_MODEL="gpt-4-0125-preview"  # See .env.example for model options

# API Keys (only need the one for your chosen provider)
OPENAI_API_KEY="sk-..."
GOOGLE_API_KEY="..."
ANTHROPIC_API_KEY="sk-ant-..."
```

### 4. Set up the database

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# (Optional) Open Prisma Studio to view your database
npm run db:studio
```

### 5. Configure Clerk Webhook

1. Go to your [Clerk Dashboard](https://dashboard.clerk.com/)
2. Navigate to Webhooks
3. Create a new webhook endpoint pointing to: `https://your-domain.com/api/webhook/clerk`
4. Select the `user.created` and `user.updated` events
5. Copy the webhook secret and add it to your `.env.local` as `CLERK_WEBHOOK_SECRET`

### 6. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## AI Provider Configuration

The platform supports multiple AI providers. You can switch between them by changing the environment variables:

### OpenAI (Default)
```env
AI_PROVIDER="openai"
AI_MODEL="gpt-4-0125-preview"  # or "gpt-4", "gpt-3.5-turbo"
OPENAI_API_KEY="your-key"
```

### Google Gemini
```env
AI_PROVIDER="google"
AI_MODEL="gemini-2.5-flash"  # or "gemini-pro"
GOOGLE_API_KEY="your-key"
```

### Anthropic Claude
```env
AI_PROVIDER="anthropic"
AI_MODEL="claude-3-opus"  # or "claude-3-sonnet", "claude-3-haiku"
ANTHROPIC_API_KEY="your-key"
```

## Project Structure

```
src/
├── app/                    # Next.js app router pages
│   ├── api/               # API routes
│   ├── articles/          # Article pages
│   ├── categories/        # Category listing
│   ├── dashboard/         # User dashboard
│   └── search/            # Search page
├── components/            # React components
├── lib/                   # Utility functions and services
│   ├── ai-service.ts     # AI provider abstraction
│   ├── prisma.ts         # Database client
│   └── utils.ts          # Helper functions
└── middleware.ts          # Clerk authentication middleware
```

## Key Features Explained

### Dynamic Content Generation
- Articles are generated on-demand when users visit them
- Content is cached in the database to minimize AI API calls
- Threshold system prevents duplicate content generation

### Interactive Examples
- Three types: Multiple choice, text input, and command-line
- AI-powered marking with constructive feedback
- Examples are generated based on article content

### Search Enhancement
- Local database search combined with AI suggestions
- Smart thresholds to avoid excessive AI calls
- Duplicate prevention for similar articles

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run db:generate` - Generate Prisma client
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Prisma Studio
- `npm run db:push` - Push schema changes (development)

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import the project on [Vercel](https://vercel.com)
3. Add all environment variables
4. Deploy

### Other Platforms

The application can be deployed to any platform that supports Next.js. Make sure to:
1. Set all environment variables
2. Run database migrations
3. Configure the Clerk webhook URL

## Troubleshooting

### Foreign Key Constraint Errors
If you see foreign key errors, ensure users are properly synced between Clerk and your database. The webhook should handle this automatically.

### AI Generation Fails
- Check your API key is valid
- Ensure you have credits/quota with your AI provider
- Check the console logs for specific error messages

### Multiple Choice Options Not Displaying
Run the fix script if you have existing data:
```bash
npx tsx scripts/fix-example-options.ts
```

## License

[Your License Here]