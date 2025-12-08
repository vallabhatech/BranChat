import cors from 'cors';
import { Request } from 'express';
import { config } from '../config/environment';
import { logger } from '../utils/logger';

// Helper function to normalize origins (remove trailing slashes)
const normalizeOrigin = (origin: string | undefined): string => {
  if (!origin) return '';
  return origin.replace(/\/+$/, '');
};

// CORS configuration
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Normalize origins for comparison (remove trailing slashes)
    const normalizedOrigin = normalizeOrigin(origin);
    const normalizedConfigOrigin = normalizeOrigin(config.cors.origin);
    
    // In development, allow localhost origins
    if (config.env === 'development') {
      const allowedOrigins = [
        'https://branchat.onrender.com',
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5175',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:5174',
        'http://127.0.0.1:5175',
        normalizedConfigOrigin
      ].map(normalizeOrigin);
      
      if (allowedOrigins.includes(normalizedOrigin)) {
        return callback(null, true);
      }
    }
    
    // In production, allow configured origin (with normalized comparison)
    if (normalizedOrigin === normalizedConfigOrigin) {
      return callback(null, true);
    }
    
    logger.warn('CORS blocked request from origin:', { 
      origin, 
      normalizedOrigin,
      expectedOrigin: normalizedConfigOrigin,
      configOrigin: config.cors.origin
    });
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Cache-Control',
    'X-File-Name'
  ],
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204
};

export const corsMiddleware = cors(corsOptions);

// Additional CORS headers for specific routes if needed
export const setCorsHeaders = (req: Request, res: any, next: any) => {
  const origin = req.get('Origin');
  const normalizedOrigin = normalizeOrigin(origin);
  const normalizedConfigOrigin = normalizeOrigin(config.cors.origin);
  
  // Only set CORS headers if origin matches
  if (origin && normalizedOrigin === normalizedConfigOrigin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
  }
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
};