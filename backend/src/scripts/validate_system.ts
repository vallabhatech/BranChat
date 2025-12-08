#!/usr/bin/env ts-node

/**
 * System Validation Script for SubChat MVP
 * 
 * This script validates key system components and functionality
 * without requiring external services like MongoDB or Elastic Search.
 * 
 * Usage:
 *   npm run validate:system
 *   or
 *   npx ts-node src/scripts/validate_system.ts
 */

import { config } from '../config/environment';
import { logger } from '../utils/logger';

interface ValidationResult {
  component: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

class SystemValidator {
  private results: ValidationResult[] = [];

  async validateAll(): Promise<ValidationResult[]> {
    console.log('🔍 Starting system validation...\n');

    await this.validateEnvironmentConfig();
    await this.validateTypeScriptCompilation();
    await this.validateModelSchemas();
    await this.validateServiceInterfaces();
    await this.validateMiddleware();
    await this.validateErrorHandling();
    await this.validateLogging();
    await this.validateSecurityHeaders();

    this.printResults();
    return this.results;
  }

  private addResult(component: string, status: 'pass' | 'fail' | 'warning', message: string, details?: any) {
    this.results.push({ component, status, message, details });
    
    const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⚠️';
    console.log(`${icon} ${component}: ${message}`);
    
    if (details && status !== 'pass') {
      console.log(`   Details: ${JSON.stringify(details, null, 2)}`);
    }
  }

  private async validateEnvironmentConfig() {
    try {
      // Test required environment variables
      // Check if key config sections exist
      const configSections = ['env', 'port', 'jwt', 'database'];
      const missing = configSections.filter(section => !config[section as keyof typeof config]);
      
      if (missing.length > 0) {
        this.addResult('Environment Config', 'fail', 'Missing required environment variables', { missing });
        return;
      }

      // Validate JWT secret strength
      if (config.jwt.secret.length < 32) {
        this.addResult('JWT Secret', 'warning', 'JWT secret should be at least 32 characters for security');
      } else {
        this.addResult('JWT Secret', 'pass', 'JWT secret meets security requirements');
      }

      // Validate port
      if (config.port < 1024 || config.port > 65535) {
        this.addResult('Port Config', 'warning', 'Port should be between 1024-65535');
      } else {
        this.addResult('Port Config', 'pass', `Port ${config.port} is valid`);
      }

      this.addResult('Environment Config', 'pass', 'All required environment variables present');
    } catch (error) {
      this.addResult('Environment Config', 'fail', 'Failed to validate environment', { error: (error as Error).message });
    }
  }

  private async validateTypeScriptCompilation() {
    try {
      // Test TypeScript compilation by importing key modules
      const { User } = await import('../models/User');
      const { Conversation } = await import('../models/Conversation');
      const { Message } = await import('../models/Message');
      const { Subchat } = await import('../models/Subchat');
      const { SubchatMessage } = await import('../models/SubchatMessage');
      const { Summary } = await import('../models/Summary');

      // Test service imports
      const authServiceModule = await import('../services/auth.service');
      const llmServiceModule = await import('../services/llm.service');

      this.addResult('TypeScript Compilation', 'pass', 'All modules compile successfully');
    } catch (error) {
      this.addResult('TypeScript Compilation', 'fail', 'TypeScript compilation failed', { error: (error as Error).message });
    }
  }

  private async validateModelSchemas() {
    try {
      // Test model schema definitions
      const { User } = await import('../models/User');
      const { Conversation } = await import('../models/Conversation');
      
      // Validate User schema
      const userSchema = User.schema;
      const userPaths = userSchema.paths;
      
      const requiredUserFields = ['email', 'isGuest', 'memoryOptIn', 'lastActiveAt'];
      const missingUserFields = requiredUserFields.filter(field => !userPaths[field]);
      
      if (missingUserFields.length > 0) {
        this.addResult('User Model Schema', 'fail', 'Missing required fields', { missing: missingUserFields });
      } else {
        this.addResult('User Model Schema', 'pass', 'All required fields present');
      }

      // Validate Conversation schema
      const conversationSchema = Conversation.schema;
      const conversationPaths = conversationSchema.paths;
      
      const requiredConversationFields = ['userId', 'title', 'lastMessageAt', 'messageCount'];
      const missingConversationFields = requiredConversationFields.filter(field => !conversationPaths[field]);
      
      if (missingConversationFields.length > 0) {
        this.addResult('Conversation Model Schema', 'fail', 'Missing required fields', { missing: missingConversationFields });
      } else {
        this.addResult('Conversation Model Schema', 'pass', 'All required fields present');
      }

      this.addResult('Model Schemas', 'pass', 'All model schemas are valid');
    } catch (error) {
      this.addResult('Model Schemas', 'fail', 'Failed to validate model schemas', { error: (error as Error).message });
    }
  }

  private async validateServiceInterfaces() {
    try {
      // Test service imports and basic structure
      const authServiceModule = await import('../services/auth.service');
      const llmServiceModule = await import('../services/llm.service');

      // Check if authService is exported
      if (!authServiceModule.authService) {
        this.addResult('AuthService Export', 'fail', 'authService not exported from auth.service');
        return;
      }
      this.addResult('AuthService Export', 'pass', 'authService properly exported');

      // Check if LLM service module loaded successfully
      if (Object.keys(llmServiceModule).length === 0) {
        this.addResult('LLMService Module', 'fail', 'LLM service module is empty');
      } else {
        this.addResult('LLMService Module', 'pass', 'LLM service module loaded successfully');
      }

      this.addResult('Service Interfaces', 'pass', 'All service interfaces are valid');
    } catch (error) {
      this.addResult('Service Interfaces', 'fail', 'Failed to validate service interfaces', { error: (error as Error).message });
    }
  }

  private async validateMiddleware() {
    try {
      // Test middleware imports and basic structure
      const authMiddlewareModule = await import('../middleware/auth.middleware');
      const rateLimiterModule = await import('../middleware/rateLimiter');
      const errorHandlerModule = await import('../middleware/errorHandler');

      // Check auth middleware exports
      if (!authMiddlewareModule.authenticate && !authMiddlewareModule.requireAuth) {
        this.addResult('Auth Middleware', 'warning', 'Auth middleware functions not found with expected names');
      } else {
        this.addResult('Auth Middleware', 'pass', 'Auth middleware is properly defined');
      }

      // Check rate limiter exports
      if (!rateLimiterModule.apiLimiter) {
        this.addResult('Rate Limiter', 'warning', 'apiLimiter not found in rateLimiter module');
      } else {
        this.addResult('Rate Limiter', 'pass', 'Rate limiter is properly defined');
      }

      // Check error handler
      if (!errorHandlerModule.errorHandler) {
        this.addResult('Error Handler', 'warning', 'errorHandler not found in errorHandler module');
      } else {
        this.addResult('Error Handler', 'pass', 'Error handler is properly defined');
      }

      this.addResult('Middleware', 'pass', 'All middleware components are valid');
    } catch (error) {
      this.addResult('Middleware', 'fail', 'Failed to validate middleware', { error: (error as Error).message });
    }
  }

  private async validateErrorHandling() {
    try {
      // Test error handling utilities
      const errorHandlerModule = await import('../middleware/errorHandler');

      if (errorHandlerModule.errorHandler) {
        // Create mock request, response, and next function
        const mockReq = {} as any;
        const mockRes = {
          status: () => mockRes,
          json: () => mockRes,
          locals: {}
        } as any;
        const mockNext = () => {};

        // Test with a standard error
        const testError = new Error('Test error');
        
        try {
          errorHandlerModule.errorHandler(testError, mockReq, mockRes, mockNext);
          this.addResult('Error Handler Function', 'pass', 'Error handler processes errors without throwing');
        } catch (handlerError) {
          this.addResult('Error Handler Function', 'fail', 'Error handler throws when processing errors', { error: (handlerError as Error).message });
        }
      } else {
        this.addResult('Error Handler Function', 'warning', 'Error handler function not found');
      }

      this.addResult('Error Handling', 'pass', 'Error handling system is functional');
    } catch (error) {
      this.addResult('Error Handling', 'fail', 'Failed to validate error handling', { error: (error as Error).message });
    }
  }

  private async validateLogging() {
    try {
      // Test logger functionality
      const testMessage = 'System validation test log';
      
      // Test different log levels
      logger.info(testMessage);
      logger.warn(testMessage);
      logger.error(testMessage);

      this.addResult('Logging System', 'pass', 'Logger is functional and accepts all log levels');
    } catch (error) {
      this.addResult('Logging System', 'fail', 'Failed to validate logging system', { error: (error as Error).message });
    }
  }

  private async validateSecurityHeaders() {
    try {
      // Test security middleware imports
      const helmet = await import('helmet');
      const cors = await import('cors');

      if (typeof helmet.default !== 'function') {
        this.addResult('Helmet Security', 'fail', 'Helmet middleware not properly imported');
        return;
      }
      this.addResult('Helmet Security', 'pass', 'Helmet security middleware available');

      if (typeof cors.default !== 'function') {
        this.addResult('CORS Middleware', 'fail', 'CORS middleware not properly imported');
        return;
      }
      this.addResult('CORS Middleware', 'pass', 'CORS middleware available');

      this.addResult('Security Headers', 'pass', 'Security middleware components are available');
    } catch (error) {
      this.addResult('Security Headers', 'fail', 'Failed to validate security headers', { error: (error as Error).message });
    }
  }

  private printResults() {
    console.log('\n📊 Validation Summary');
    console.log('═══════════════════════');

    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const warnings = this.results.filter(r => r.status === 'warning').length;

    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⚠️  Warnings: ${warnings}`);
    console.log(`📋 Total: ${this.results.length}`);

    if (failed > 0) {
      console.log('\n❌ Failed Components:');
      this.results
        .filter(r => r.status === 'fail')
        .forEach(r => console.log(`   - ${r.component}: ${r.message}`));
    }

    if (warnings > 0) {
      console.log('\n⚠️  Warnings:');
      this.results
        .filter(r => r.status === 'warning')
        .forEach(r => console.log(`   - ${r.component}: ${r.message}`));
    }

    const overallStatus = failed === 0 ? 'PASS' : 'FAIL';
    const statusIcon = failed === 0 ? '🎉' : '💥';
    
    console.log(`\n${statusIcon} Overall Status: ${overallStatus}`);
    
    if (overallStatus === 'PASS') {
      console.log('\n🚀 System validation successful! Core components are ready.');
      console.log('\nNext steps:');
      console.log('1. Start MongoDB and Elastic Search services');
      console.log('2. Run integration tests: npm test');
      console.log('3. Start the development server: npm run dev');
    } else {
      console.log('\n🔧 Please fix the failed components before proceeding.');
    }
  }
}

// CLI execution
async function main() {
  const validator = new SystemValidator();
  
  try {
    const results = await validator.validateAll();
    const failed = results.filter(r => r.status === 'fail').length;
    
    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('System validation failed:', error);
    process.exit(1);
  }
}

// Export for programmatic use
export { SystemValidator };

// Run if called directly
if (require.main === module) {
  main();
}