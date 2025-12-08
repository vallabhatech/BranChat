import { Router } from 'express';
import { aiController } from '../controllers/ai.controller';
import { authenticate } from '../middleware/auth.middleware';
import { llmLimiter } from '../middleware/rateLimiter';

const router = Router();

// Apply rate limiting to all AI routes
router.use(llmLimiter);

// Apply auth middleware (supports both authenticated users and guests)
router.use(authenticate);

// AI endpoints
router.post('/write', aiController.write);
router.post('/rewrite', aiController.rewrite);
router.post('/summarize', aiController.summarize);
router.post('/search', aiController.search);

export { router as aiRoutes };