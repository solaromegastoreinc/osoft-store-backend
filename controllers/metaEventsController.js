/**
 * Meta Events Controller
 * Handles incoming requests from frontend for CAPI processing
 * 
 * Endpoints:
 * - POST /api/meta/events - Receive and forward events to Meta CAPI
 * - GET /api/meta/status - Check CAPI configuration status
 * - POST /api/meta/purchase - Track purchase event (server-side only)
 * 
 * @version 1.0.0
 */

import {
    buildServerEvent,
    getConfigStatus,
    sendEvents,
    trackCompleteRegistration,
    trackLead,
    trackPurchase as trackPurchaseEvent
} from '../utils/metaCAPI.js';

/**
 * Extract client IP from request
 * Handles various proxy configurations
 * @param {Object} req - Express request object
 * @returns {string|null} Client IP address
 */
function getClientIP(req) {
    return (
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.headers['x-real-ip'] ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        null
    );
}

/**
 * Process and forward event from frontend to Meta CAPI
 * POST /api/meta/events
 */
export async function processEvent(req, res) {
    try {
        const {
            event_name,
            event_id,
            event_time,
            event_source_url,
            action_source = 'website',
            user_data = {},
            custom_data = {},
            test_event_code,
        } = req.body;

        // Validate required fields
        if (!event_name) {
            return res.status(400).json({
                success: false,
                error: 'event_name is required',
            });
        }

        // Enhance user data with server-side information
        const enhancedUserData = {
            ...user_data,
            client_ip_address: getClientIP(req),
        };

        // Add user ID if authenticated
        if (req.user?._id) {
            enhancedUserData.external_id = String(req.user._id);
        }

        // Build the server event
        const event = buildServerEvent({
            eventName: event_name,
            eventId: event_id,
            eventTime: event_time,
            eventSourceUrl: event_source_url,
            actionSource: action_source,
            userData: enhancedUserData,
            customData: custom_data,
        });

        // Send to Meta CAPI
        const result = await sendEvents([event]);

        if (result.success) {
            return res.json({
                success: true,
                message: 'Event sent successfully',
                events_received: result.events_received,
            });
        } else {
            return res.status(500).json({
                success: false,
                error: result.error || 'Failed to send event',
            });
        }

    } catch (error) {
        console.error('[Meta Events Controller] Error processing event:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
        });
    }
}

/**
 * Process batch of events from frontend
 * POST /api/meta/events/batch
 */
export async function processBatchEvents(req, res) {
    try {
        const { events } = req.body;

        if (!Array.isArray(events) || events.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'events array is required and must not be empty',
            });
        }

        // Process each event
        const serverEvents = events.map(eventData => {
            const enhancedUserData = {
                ...eventData.user_data,
                client_ip_address: getClientIP(req),
            };

            if (req.user?._id) {
                enhancedUserData.external_id = String(req.user._id);
            }

            return buildServerEvent({
                eventName: eventData.event_name,
                eventId: eventData.event_id,
                eventTime: eventData.event_time,
                eventSourceUrl: eventData.event_source_url,
                actionSource: eventData.action_source || 'website',
                userData: enhancedUserData,
                customData: eventData.custom_data || {},
            });
        });

        const result = await sendEvents(serverEvents);

        if (result.success) {
            return res.json({
                success: true,
                message: `${serverEvents.length} event(s) sent successfully`,
                events_received: result.events_received,
            });
        } else {
            return res.status(500).json({
                success: false,
                error: result.error || 'Failed to send events',
            });
        }

    } catch (error) {
        console.error('[Meta Events Controller] Error processing batch:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
        });
    }
}

/**
 * Track purchase event from server-side (for order completion)
 * POST /api/meta/purchase
 * 
 * This endpoint should be called from the backend after successful payment
 */
export async function trackPurchase(req, res) {
    try {
        const {
            order,
            items,
            event_id,
            event_source_url,
        } = req.body;

        // Validate required fields
        if (!order || !items || !Array.isArray(items)) {
            return res.status(400).json({
                success: false,
                error: 'order and items are required',
            });
        }

        // Build user data
        const userData = {
            client_ip_address: getClientIP(req),
        };

        if (order.email) {
            userData.email = order.email;
        }

        if (req.user?._id) {
            userData.external_id = String(req.user._id);
        }

        // Track purchase event
        const result = await trackPurchaseEvent(order, items, {
            eventId: event_id,
            eventSourceUrl: event_source_url,
            userData,
        });

        return res.json({
            success: result.success,
            message: result.success ? 'Purchase event tracked' : result.error,
        });

    } catch (error) {
        console.error('[Meta Events Controller] Error tracking purchase:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
        });
    }
}

/**
 * Track registration event from server-side
 * POST /api/meta/registration
 */
export async function trackRegistration(req, res) {
    try {
        const {
            registration_method,
            event_id,
            event_source_url,
        } = req.body;

        const userData = {
            client_ip_address: getClientIP(req),
        };

        if (req.user?._id) {
            userData.external_id = String(req.user._id);
        }

        if (req.user?.email) {
            userData.email = req.user.email;
        }

        trackCompleteRegistration(
            { registration_method },
            {
                eventId: event_id,
                eventSourceUrl: event_source_url,
                userData,
            }
        );

        return res.json({
            success: true,
            message: 'Registration event tracked',
        });

    } catch (error) {
        console.error('[Meta Events Controller] Error tracking registration:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
        });
    }
}

/**
 * Track lead event from server-side (contact form, newsletter)
 * POST /api/meta/lead
 */
export async function trackLeadEvent(req, res) {
    try {
        const {
            lead_type,
            value,
            event_id,
            event_source_url,
        } = req.body;

        const userData = {
            client_ip_address: getClientIP(req),
        };

        if (req.body.email) {
            userData.email = req.body.email;
        }

        if (req.user?._id) {
            userData.external_id = String(req.user._id);
        }

        trackLead(
            { lead_type, value },
            {
                eventId: event_id,
                eventSourceUrl: event_source_url,
                userData,
            }
        );

        return res.json({
            success: true,
            message: 'Lead event tracked',
        });

    } catch (error) {
        console.error('[Meta Events Controller] Error tracking lead:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
        });
    }
}

/**
 * Get CAPI configuration status
 * GET /api/meta/status
 */
export function getStatus(req, res) {
    const status = getConfigStatus();

    return res.json({
        success: true,
        status,
    });
}

/**
 * Health check endpoint
 * GET /api/meta/health
 */
export function healthCheck(req, res) {
    const status = getConfigStatus();

    return res.json({
        healthy: status.configured,
        ...status,
    });
}

export default {
    processEvent,
    processBatchEvents,
    trackPurchase,
    trackRegistration,
    trackLeadEvent,
    getStatus,
    healthCheck,
};
