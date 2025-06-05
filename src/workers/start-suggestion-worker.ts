#!/usr/bin/env node

// Load environment variables
import 'dotenv/config';

// Start the suggestion worker
import './suggestion.worker';

console.log('🚀 Starting suggestion worker...');