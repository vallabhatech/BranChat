import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { authenticate, requireAuth } from '../middleware/auth.middleware';

const router = Router();

// All admin routes require authentication (no guest access)
router.use(authenticate);
router.use(requireAuth);

/**
 * @route GET /api/admin/usage
 * @desc Get system usage statistics with date range filtering
 * @access Private (authenticated users only)
 * @query startDate - Start date in ISO format (optional)
 * @query endDate - End date in ISO format (optional)  
 * @query days - Number of days back from now (optional, default: 30)
 */
router.get('/usage', adminController.getUsageStats.bind(adminController));

/**
 * @route POST /api/admin/memory/cleanup
 * @desc Clean up old and orphaned memory entries
 * @access Private (authenticated users only)
 * @query olderThanDays - Delete entries older than this many days (optional, default: 90)
 * @query dryRun - If 'true', simulate cleanup without deleting (optional)
 */
router.post('/memory/cleanup', adminController.cleanupMemory.bind(adminController));

/**
 * @route GET /api/admin/health
 * @desc Get system health and metrics overview
 * @access Private (authenticated users only)
 */
router.get('/health', adminController.getSystemHealth.bind(adminController));

/**
 * @route GET /api/admin/tokens
 * @desc Get current token usage statistics
 * @access Private (authenticated users only)
 */
router.get('/tokens', adminController.getTokenStats.bind(adminController));

export { router as adminRoutes };