import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
// Also load from .env if it exists
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Log to verify env vars are loaded
console.log('Environment check:', {
  MAILGUN_API_KEY: process.env.MAILGUN_API_KEY ? 'Set' : 'Not set',
  MAILGUN_DOMAIN: process.env.MAILGUN_DOMAIN || 'Not set',
  REDIS_URL: process.env.REDIS_URL || 'Not set',
});

import './email.worker';
import './sitemap.worker';

console.log('Email and sitemap workers started and listening for jobs...');