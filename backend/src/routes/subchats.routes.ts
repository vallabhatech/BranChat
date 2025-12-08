import { Router } from 'express';
import { subchatsController } from '../controllers/subchats.controller';
import { mergeController } from '../controllers/merge.controller';
import { authenticate, validateGuestMode, applyUserBasedRateLimit } from '../middleware/auth.middleware';
const { body, param, query } = require('express-validator');
import { validationMiddleware } from '../middleware/validation.middleware';

const router = Router();

// Apply authentication and guest validation to all routes
router.use(validateGuestMode);
router.use(authenticate);
router.use(applyUserBasedRateLimit);

/**
 * POST /api/subchats
 * Create a new sub-chat with context seeding
 */
router.post(
  '/',
  [
    body('conversationId')
      .isMongoId()
      .withMessage('Valid conversation ID is required'),
    body('parentMessageId')
      .optional()
      .isMongoId()
      .withMessage('Parent message ID must be a valid MongoDB ObjectId'),
    body('contextMessage')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 10000 })
      .withMessage('Context message must be a string between 1 and 10000 characters'),
    body('title')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage('Title must be a string between 1 and 200 characters'),
    body('includeInMemory')
      .optional()
      .isBoolean()
      .withMessage('includeInMemory must be a boolean'),
    body('autoSend')
      .optional()
      .isBoolean()
      .withMessage('autoSend must be a boolean'),
  ],
  validationMiddleware,
  subchatsController.createSubchat.bind(subchatsController)
);

/**
 * GET /api/subchats/:id
 * Get sub-chat by ID with metadata and messages (paginated)
 */
router.get(
  '/:id',
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid sub-chat ID'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('sortOrder')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('SortOrder must be either asc or desc'),
  ],
  validationMiddleware,
  subchatsController.getSubchat.bind(subchatsController)
);

/**
 * POST /api/subchats/:id/messages
 * Add a message to sub-chat and get LLM response
 */
router.post(
  '/:id/messages',
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid sub-chat ID'),
    body('content')
      .isString()
      .trim()
      .isLength({ min: 1, max: 50000 })
      .withMessage('Content must be a string between 1 and 50000 characters'),
    body('role')
      .optional()
      .isIn(['user', 'assistant', 'system'])
      .withMessage('Role must be one of: user, assistant, system'),
  ],
  validationMiddleware,
  subchatsController.addMessage.bind(subchatsController)
);

/**
 * GET /api/subchats/:id/stream
 * Stream LLM response for sub-chat using SSE
 */
router.get(
  '/:id/stream',
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid sub-chat ID'),
    query('message')
      .isString()
      .trim()
      .isLength({ min: 1, max: 50000 })
      .withMessage('Message must be a string between 1 and 50000 characters'),
    query('role')
      .optional()
      .isIn(['user', 'assistant', 'system'])
      .withMessage('Role must be one of: user, assistant, system'),
  ],
  validationMiddleware,
  subchatsController.streamResponse.bind(subchatsController)
);

/**
 * POST /api/subchats/:id/merge
 * Merge sub-chat back into parent conversation with summarization
 */
router.post(
  '/:id/merge',
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid sub-chat ID'),
  ],
  validationMiddleware,
  mergeController.mergeSubchat.bind(mergeController)
);

export { router as subchatRoutes };