// backend/routes/analytics.js
import express from 'express';
import { getDashboardAnalytics } from '../controllers/analyticsController.js';

const router = express.Router();



// Dashboard analytics endpoint
router.get('/dashboard', getDashboardAnalytics);

export default router;