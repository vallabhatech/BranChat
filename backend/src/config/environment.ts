import Joi from 'joi';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Environment validation schema
const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3001),

  // Database
  MONGODB_URI: Joi.string().required(),

  // Elastic Search
  ELASTIC_URL: Joi.string().required(),
  ELASTIC_USERNAME: Joi.string().optional(),
  ELASTIC_PASSWORD: Joi.string().optional(),
  ELASTIC_API_KEY: Joi.string().optional(),

  // Gemini AI
  GEMINI_API_KEY: Joi.string().required(),
  GEMINI_MODEL: Joi.string().default('gemini-1.5-pro'),
  GEMINI_EMBEDDING_MODEL: Joi.string().default('text-embedding-004'),

  // JWT
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('7d'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: Joi.number().default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(100),

  // Guest Mode
  ALLOW_GUEST: Joi.boolean().default(false),

  // CORS
  CORS_ORIGIN: Joi.string().default('https://branchat.onrender.com'),

  // Logging
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),

  // Memory Settings
  MEMORY_TOP_K: Joi.number().default(5),
  MEMORY_SIMILARITY_THRESHOLD: Joi.number().default(0.7),

  // LLM Settings
  MAX_TOKENS: Joi.number().default(2000),
  TEMPERATURE: Joi.number().default(0.7),

  // Admin
  ADMIN_API_KEY: Joi.string().optional()
}).unknown();

// Validate environment variables
const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

export const config = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,

  database: {
    uri: envVars.MONGODB_URI,
  },

  elastic: {
    url: envVars.ELASTIC_URL,
    username: envVars.ELASTIC_USERNAME,
    password: envVars.ELASTIC_PASSWORD,
    apiKey: envVars.ELASTIC_API_KEY,
  },

  gemini: {
    apiKey: envVars.GEMINI_API_KEY,
    model: envVars.GEMINI_MODEL,
    embeddingModel: envVars.GEMINI_EMBEDDING_MODEL,
    maxTokens: envVars.MAX_TOKENS,
    temperature: envVars.TEMPERATURE,
  },

  jwt: {
    secret: envVars.JWT_SECRET,
    expiresIn: envVars.JWT_EXPIRES_IN,
  },

  rateLimit: {
    windowMs: envVars.RATE_LIMIT_WINDOW_MS,
    maxRequests: envVars.RATE_LIMIT_MAX_REQUESTS,
  },

  cors: {
    origin: envVars.CORS_ORIGIN,
  },

  guest: {
    allowed: envVars.ALLOW_GUEST,
  },

  logging: {
    level: envVars.LOG_LEVEL,
  },

  memory: {
    topK: envVars.MEMORY_TOP_K,
    similarityThreshold: envVars.MEMORY_SIMILARITY_THRESHOLD,
  },

  admin: {
    apiKey: envVars.ADMIN_API_KEY,
  },
};

export default config;