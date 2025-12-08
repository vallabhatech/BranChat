#!/usr/bin/env ts-node

import { config } from '../config/environment';
import { logger } from '../utils/logger';

console.log('🔧 Validating configuration...\n');

try {
  // Test configuration loading
  console.log('✅ Environment:', config.env);
  console.log('✅ Port:', config.port);
  console.log('✅ CORS Origin:', config.cors.origin);
  console.log('✅ Guest Mode:', config.guest.allowed ? 'Enabled' : 'Disabled');
  console.log('✅ Log Level:', config.logging.level);
  console.log('✅ Rate Limit:', `${config.rateLimit.maxRequests} requests per ${config.rateLimit.windowMs}ms`);
  
  // Test logger
  logger.info('Logger test successful');
  
  console.log('\n🎉 Configuration validation successful!');
  console.log('\nNext steps:');
  console.log('1. Copy .env.example to .env and fill in your actual values');
  console.log('2. Set up MongoDB and Elastic Search');
  console.log('3. Add your Gemini API key');
  console.log('4. Run: npm run dev');
  
} catch (error) {
  console.error('❌ Configuration validation failed:', error);
  process.exit(1);
}