import { Router } from 'express';
import { conversationsController } from '../controllers/conversations.controller';
import { authenticate, validateGuestMode, applyUserBasedRateLimit } from '../middleware/auth.middleware';
const { body, param, query } = require('express-validator');
import { validationMiddleware } from '../middleware/validation.middleware';

const router = Router();

// Apply authentication and guest validation to all routes
router.use(validateGuestMode);
router.use(authenticate);
router.use(applyUserBasedRateLimit);

/**
 * GET /api/conversations
 * List user's conversations with pagination
 */
router.get(
  '/',
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50'),
    query('sortBy')
      .optional()
      .isIn(['createdAt', 'updatedAt', 'lastMessageAt'])
      .withMessage('SortBy must be one of: createdAt, updatedAt, lastMessageAt'),
    query('sortOrder')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('SortOrder must be either asc or desc'),
  ],
  validationMiddleware,
  conversationsController.listConversations.bind(conversationsController)
);

/**
 * POST /api/conversations/start
 * Start a new conversation with memory toggle
 */
router.post(
  '/start',
  [
    body('title')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage('Title must be a string between 1 and 200 characters'),
    body('useMemory')
      .optional()
      .isBoolean()
      .withMessage('useMemory must be a boolean'),
    body('initialMessage')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 50000 })
      .withMessage('initialMessage must be a string between 1 and 50000 characters'),
  ],
  validationMiddleware,
  conversationsController.startConversation.bind(conversationsController)
);

/**
 * POST /api/conversations
 * Create a new conversation
 */
router.post(
  '/',
  [
    body('title')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage('Title must be a string between 1 and 200 characters'),
  ],
  validationMiddleware,
  conversationsController.createConversation.bind(conversationsController)
);

/**
 * GET /api/conversations/:id
 * Get conversation by ID with messages (paginated)
 */
router.get(
  '/:id',
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid conversation ID'),
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
  conversationsController.getConversation.bind(conversationsController)
);

/**
 * POST /api/conversations/:id/messages
 * Add a message to conversation and get LLM response
 */
router.post(
  '/:id/messages',
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid conversation ID'),
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
  conversationsController.addMessage.bind(conversationsController)
);

/**
 * PATCH /api/conversations/:id
 * Update conversation (rename)
 */
router.patch(
  '/:id',
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid conversation ID'),
    body('title')
      .isString()
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage('Title must be a string between 1 and 200 characters'),
  ],
  validationMiddleware,
  conversationsController.updateConversation.bind(conversationsController)
);

/**
 * DELETE /api/conversations/:id
 * Delete conversation and all its messages
 */
router.delete(
  '/:id',
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid conversation ID'),
  ],
  validationMiddleware,
  conversationsController.deleteConversation.bind(conversationsController)
);

export { router as conversationRoutes };