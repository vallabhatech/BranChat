import { Router } from 'express';
import { memoryController } from '../controllers/memory.controller';
import { 
  authenticate, 
  validateGuestMode, 
  applyUserBasedRateLimit 
} from '../middleware/auth.middleware';

const router = Router();

// Apply guest mode validation to all routes
router.use(validateGuestMode);

// Apply user-based rate limiting
router.use(applyUserBasedRateLimit);

// All memory routes require authentication
router.use(authenticate);

/**
 * @route POST /api/memory/retrieve
 * @desc Retrieve memories using semantic or text search
 * @access Private (authenticated users only, not guests, requires memory opt-in)
 */
router.post('/retrieve', memoryController.retrieveMemories.bind(memoryController));

/**
 * @route GET /api/memory/list
 * @desc List user's memories with pagination
 * @access Private (authenticated users only, not guests, requires memory opt-in)
 */
router.get('/list', memoryController.listMemories.bind(memoryController));

/**
 * @route POST /api/memory/:id/delete
 * @desc Delete a specific memory entry
 * @access Private (authenticated users only, not guests, requires memory opt-in)
 */
router.post('/:id/delete', memoryController.deleteMemory.bind(memoryController));

/**
 * @route GET /api/memory/status
 * @desc Get memory service status and user statistics
 * @access Private (authenticated users and guests)
 */
router.get('/status', memoryController.getMemoryStatus.bind(memoryController));

export { router as memoryRoutes };