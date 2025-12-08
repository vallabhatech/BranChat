import { Request, Response, NextFunction } from 'express';
const { validationResult } = require('express-validator');
import { ApiResponse } from '../types';
import { logger } from '../utils/logger';

/**
 * Middleware to handle express-validator validation results
 */
export function validationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorDetails = errors.array().map((error: any) => ({
      field: error.type === 'field' ? error.path : 'unknown',
      message: error.msg,
      value: error.type === 'field' ? error.value : undefined,
    }));

    logger.debug('Validation failed', {
      path: req.path,
      method: req.method,
      errors: errorDetails,
      userId: req.user?.userId,
    });

    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        timestamp: new Date().toISOString(),
        details: errorDetails,
      },
    } as ApiResponse);
    return;
  }

  next();
}