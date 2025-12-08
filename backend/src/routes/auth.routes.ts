import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
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

/**
 * @route POST /api/auth/register
 * @desc Register new user
 * @access Public
 */
router.post('/register', authController.register.bind(authController));

/**
 * @route POST /api/auth/login
 * @desc Login user
 * @access Public
 */
router.post('/login', authController.login.bind(authController));

/**
 * @route POST /api/auth/guest
 * @desc Create guest token
 * @access Public (if guest mode enabled)
 */
router.post('/guest', authController.createGuestToken.bind(authController));

/**
 * @route GET /api/auth/me
 * @desc Get current user profile
 * @access Private (authenticated users and guests)
 */
router.get('/me', authenticate, authController.getProfile.bind(authController));

/**
 * @route PUT /api/auth/memory-settings
 * @desc Update user memory preferences
 * @access Private (authenticated users only, not guests)
 */
router.put('/memory-settings', authenticate, authController.updateMemorySettings.bind(authController));

/**
 * @route POST /api/auth/logout
 * @desc Logout user (client-side token removal)
 * @access Private (authenticated users and guests)
 */
router.post('/logout', authenticate, authController.logout.bind(authController));

/**
 * @route GET /api/auth/validate
 * @desc Validate current token
 * @access Private (authenticated users and guests)
 */
router.get('/validate', authenticate, authController.validateToken.bind(authController));

export { router as authRoutes };