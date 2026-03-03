import { config } from '../config/environment';
import { logger } from '../utils/logger';

export class EnvironmentValidator {
  static validate(): void {
    const errors: string[] = [];

    // Required environment variables
    if (!config.database.uri) {
      errors.push('MONGODB_URI is required');
    }

    if (!config.jwt.secret) {
      errors.push('JWT_SECRET is required');
    }

    // Optional but recommended
    if (!config.gemini.apiKey) {
      logger.warn('GEMINI_API_KEY not configured - Chrome AI fallback will be unavailable');
    }

    if (!config.elastic.url) {
      logger.warn('ELASTIC_URL not configured - memory features will be disabled');
    }

    // Validate critical configurations
    if (config.jwt.secret === 'your-super-secret-jwt-key-change-this-in-production') {
      errors.push('JWT_SECRET must be changed from default value');
    }

    if (config.cors.origin === 'https://branchat.onrender.com' && config.env === 'production') {
      logger.warn('CORS_ORIGIN should be updated for your production domain');
    }

    // Fail fast on critical errors
    if (errors.length > 0) {
      const errorMessage = `Environment validation failed:\n${errors.join('\n')}`;
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    logger.info('Environment validation passed');
  }

  static checkServiceHealth(): {
    database: boolean;
    elasticsearch: boolean;
    gemini: boolean;
  } {
    return {
      database: !!config.database.uri,
      elasticsearch: !!config.elastic.url,
      gemini: !!config.gemini.apiKey,
    };
  }
}
