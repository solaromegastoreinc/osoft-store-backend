/**
 * Meta Events Routes
 * API routes for Meta CAPI integration
 * 
 * Routes:
 * - POST /api/meta/events       - Process single event from frontend
 * - POST /api/meta/events/batch - Process batch of events
 * - POST /api/meta/purchase     - Track purchase (server-side)
 * - POST /api/meta/registration - Track registration (server-side)
 * - POST /api/meta/lead         - Track lead event (server-side)
 * - GET  /api/meta/status       - Get CAPI configuration status
 * - GET  /api/meta/health       - Health check endpoint
 * 
 * @version 1.0.0
 */

import express from 'express';
import {
    getStatus,
    healthCheck,
    processBatchEvents,
    processEvent,
    trackLeadEvent,
    trackPurchase,
    trackRegistration,
} from '../controllers/metaEventsController.js';

const router = express.Router();

// Rate limiting middleware (optional - can use external rate limiter)
const rateLimit = (maxRequests = 100, windowMs = 60000) => {
    const requests = new Map();

    return (req, res, next) => {
        const ip = req.ip || req.connection.remoteAddress;
        const now = Date.now();
        const windowStart = now - windowMs;

        // Clean old entries
        for (const [key, value] of requests.entries()) {
            if (value.timestamp < windowStart) {
                requests.delete(key);
            }
        }

        const current = requests.get(ip);

        if (current && current.count >= maxRequests && current.timestamp > windowStart) {
            return res.status(429).json({
                success: false,
                error: 'Too many requests. Please try again later.',
            });
        }

        requests.set(ip, {
            count: (current?.count || 0) + 1,
            timestamp: now,
        });

        next();
    };
};

// Apply rate limiting to event endpoints
router.use('/events', rateLimit(100, 60000)); // 100 requests per minute

/**
 * POST /api/meta/events
 * Process single event from frontend
 * Body: { event_name, event_id, user_data, custom_data, ... }
 */
router.post('/events', processEvent);

/**
 * POST /api/meta/events/batch
 * Process batch of events
 * Body: { events: [...] }
 */
router.post('/events/batch', processBatchEvents);

/**
 * POST /api/meta/purchase
 * Track purchase event (typically called from backend after payment)
 * Body: { order, items, event_id, event_source_url }
 */
router.post('/purchase', trackPurchase);

/**
 * POST /api/meta/registration
 * Track registration completion
 * Body: { registration_method, event_id, event_source_url }
 */
router.post('/registration', trackRegistration);

/**
 * POST /api/meta/lead
 * Track lead event (contact form, newsletter signup)
 * Body: { lead_type, value, email, event_id, event_source_url }
 */
router.post('/lead', trackLeadEvent);

/**
 * GET /api/meta/status
 * Get CAPI configuration status
 */
router.get('/status', getStatus);

/**
 * GET /api/meta/health
 * Health check endpoint for monitoring
 */
router.get('/health', healthCheck);

export default router;
