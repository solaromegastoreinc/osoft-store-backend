/**
 * Meta Conversions API (CAPI) Utility
 * Enterprise-Grade Server-Side Event Tracking
 * 
 * Features:
 * - Server-side event tracking to Meta
 * - Event deduplication with event_id
 * - User data hashing for privacy
 * - Retry logic with exponential backoff
 * - Event batching for performance
 * - AEM-compliant event structure
 * 
 * Required Environment Variables:
 * - META_PIXEL_ID: Your Facebook Pixel ID
 * - META_ACCESS_TOKEN: Conversions API access token
 * - META_TEST_EVENT_CODE: (Optional) Test event code for development
 * 
 * @version 1.0.0
 * @see https://developers.facebook.com/docs/marketing-api/conversions-api
 */

import crypto from 'crypto';

// Configuration from environment
const config = {
    pixelId: process.env.META_PIXEL_ID,
    accessToken: process.env.META_ACCESS_TOKEN,
    testEventCode: process.env.META_TEST_EVENT_CODE, // Used for testing in Events Manager
    apiVersion: 'v18.0',
    batchSize: 50, // Max events per batch
    retryAttempts: 3,
    retryDelayMs: 1000,
};

// Meta Graph API base URL
const GRAPH_API_BASE = `https://graph.facebook.com/${config.apiVersion}`;

/**
 * Hash a string using SHA-256 for privacy-compliant tracking
 * Meta requires hashed PII for user matching
 * @param {string} data - Data to hash
 * @returns {string|null} SHA-256 hash or null
 */
export function hashData(data) {
    if (!data) return null;

    // Normalize: lowercase, trim whitespace
    const normalized = String(data).toLowerCase().trim();

    return crypto
        .createHash('sha256')
        .update(normalized)
        .digest('hex');
}

/**
 * Hash phone number - requires special normalization
 * @param {string} phone - Phone number
 * @param {string} countryCode - Default country code
 * @returns {string|null} Hashed phone or null
 */
export function hashPhone(phone, countryCode = '94') { // Sri Lanka default
    if (!phone) return null;

    // Remove all non-digit characters
    let normalized = String(phone).replace(/\D/g, '');

    // Add country code if not present
    if (!normalized.startsWith(countryCode)) {
        normalized = countryCode + normalized;
    }

    return hashData(normalized);
}

/**
 * Normalize and hash user data for CAPI
 * @param {Object} userData - Raw user data
 * @returns {Object} Hashed user data object
 */
export function normalizeUserData(userData = {}) {
    const normalized = {};

    // Email (em)
    if (userData.email || userData.em) {
        normalized.em = [hashData(userData.email || userData.em)];
    }

    // Phone (ph)
    if (userData.phone || userData.ph) {
        normalized.ph = [hashPhone(userData.phone || userData.ph)];
    }

    // First name (fn)
    if (userData.firstName || userData.fn) {
        normalized.fn = [hashData(userData.firstName || userData.fn)];
    }

    // Last name (ln)
    if (userData.lastName || userData.ln) {
        normalized.ln = [hashData(userData.lastName || userData.ln)];
    }

    // City (ct)
    if (userData.city || userData.ct) {
        normalized.ct = [hashData(userData.city || userData.ct)];
    }

    // State (st)
    if (userData.state || userData.st) {
        normalized.st = [hashData(userData.state || userData.st)];
    }

    // Zip code (zp)
    if (userData.zipCode || userData.zp) {
        normalized.zp = [hashData(userData.zipCode || userData.zp)];
    }

    // Country (country)
    if (userData.country) {
        normalized.country = [hashData(userData.country)];
    }

    // External ID (external_id) - your system's user ID
    if (userData.externalId || userData.external_id || userData.userId) {
        const id = userData.externalId || userData.external_id || userData.userId;
        normalized.external_id = [hashData(String(id))];
    }

    // Browser-collected identifiers (unhashed)
    // Client user agent
    if (userData.client_user_agent) {
        normalized.client_user_agent = userData.client_user_agent;
    }

    // Click ID cookie (_fbc)
    if (userData.fbc) {
        normalized.fbc = userData.fbc;
    }

    // Browser ID cookie (_fbp)
    if (userData.fbp) {
        normalized.fbp = userData.fbp;
    }

    // Client IP address
    if (userData.client_ip_address) {
        normalized.client_ip_address = userData.client_ip_address;
    }

    return normalized;
}

/**
 * Build a server event object for CAPI
 * @param {Object} params - Event parameters
 * @returns {Object} Server event object
 */
export function buildServerEvent({
    eventName,
    eventId,
    eventTime,
    eventSourceUrl,
    actionSource = 'website',
    userData = {},
    customData = {},
    optOut = false,
}) {
    const event = {
        event_name: eventName,
        event_time: eventTime || Math.floor(Date.now() / 1000),
        action_source: actionSource,
        user_data: normalizeUserData(userData),
        opt_out: optOut,
    };

    // Event ID for deduplication (must match Pixel event_id)
    if (eventId) {
        event.event_id = eventId;
    }

    // Event source URL
    if (eventSourceUrl) {
        event.event_source_url = eventSourceUrl;
    }

    // Custom data for e-commerce events
    if (Object.keys(customData).length > 0) {
        event.custom_data = customData;
    }

    return event;
}

/**
 * Send events to Meta Conversions API
 * @param {Array} events - Array of server event objects
 * @param {number} attempt - Current retry attempt
 * @returns {Promise<Object>} API response
 */
export async function sendEvents(events, attempt = 1) {
    if (!config.pixelId || !config.accessToken) {
        console.error('[Meta CAPI] Missing configuration. Set META_PIXEL_ID and META_ACCESS_TOKEN.');
        return { success: false, error: 'Missing configuration' };
    }

    if (!Array.isArray(events) || events.length === 0) {
        return { success: false, error: 'No events to send' };
    }

    const url = `${GRAPH_API_BASE}/${config.pixelId}/events`;

    const payload = {
        data: events,
        access_token: config.accessToken,
    };

    // Add test event code for development/testing
    if (config.testEventCode) {
        payload.test_event_code = config.testEventCode;
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error?.message || `HTTP ${response.status}`);
        }

        console.log(`[Meta CAPI] Successfully sent ${events.length} event(s):`, result);
        return { success: true, ...result };

    } catch (error) {
        console.error(`[Meta CAPI] Error (attempt ${attempt}):`, error.message);

        // Retry with exponential backoff
        if (attempt < config.retryAttempts) {
            const delay = config.retryDelayMs * Math.pow(2, attempt - 1);
            console.log(`[Meta CAPI] Retrying in ${delay}ms...`);

            await new Promise(resolve => setTimeout(resolve, delay));
            return sendEvents(events, attempt + 1);
        }

        return { success: false, error: error.message };
    }
}

/**
 * Event queue for batching
 */
class EventQueue {
    constructor() {
        this.queue = [];
        this.flushTimer = null;
        this.flushIntervalMs = 5000; // Flush every 5 seconds
    }

    /**
     * Add event to queue
     * @param {Object} event - Server event
     */
    add(event) {
        this.queue.push(event);

        // Flush immediately if batch size reached
        if (this.queue.length >= config.batchSize) {
            this.flush();
            return;
        }

        // Set up delayed flush if not already scheduled
        if (!this.flushTimer) {
            this.flushTimer = setTimeout(() => this.flush(), this.flushIntervalMs);
        }
    }

    /**
     * Flush all queued events
     */
    async flush() {
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }

        if (this.queue.length === 0) return;

        const events = [...this.queue];
        this.queue = [];

        await sendEvents(events);
    }

    /**
     * Get queue length
     */
    get length() {
        return this.queue.length;
    }
}

// Singleton event queue
export const eventQueue = new EventQueue();

/**
 * Track a single event (adds to queue for batching)
 * @param {Object} params - Event parameters
 */
export function trackServerEvent(params) {
    const event = buildServerEvent(params);
    eventQueue.add(event);
    return event.event_id;
}

/**
 * Track event immediately (bypasses queue)
 * @param {Object} params - Event parameters
 * @returns {Promise<Object>} API response
 */
export async function trackServerEventImmediate(params) {
    const event = buildServerEvent(params);
    return sendEvents([event]);
}

// ============================================
// E-Commerce Event Helpers
// ============================================

/**
 * Track PageView event
 * @param {Object} params - { eventSourceUrl, userData, eventId }
 */
export function trackPageView(params = {}) {
    return trackServerEvent({
        eventName: 'PageView',
        ...params,
    });
}

/**
 * Track ViewContent event (product view)
 * @param {Object} product - Product data
 * @param {Object} params - Additional parameters
 */
export function trackViewContent(product, params = {}) {
    return trackServerEvent({
        eventName: 'ViewContent',
        customData: {
            content_type: 'product',
            content_ids: [product.id],
            content_name: product.name,
            content_category: product.category,
            value: parseFloat(product.price) || 0,
            currency: product.currency || 'LKR',
        },
        ...params,
    });
}

/**
 * Track AddToCart event
 * @param {Object} product - Product data
 * @param {number} quantity - Quantity added
 * @param {Object} params - Additional parameters
 */
export function trackAddToCart(product, quantity = 1, params = {}) {
    return trackServerEvent({
        eventName: 'AddToCart',
        customData: {
            content_type: 'product',
            content_ids: [product.id],
            content_name: product.name,
            value: parseFloat(product.price) * quantity || 0,
            currency: product.currency || 'LKR',
            contents: [{
                id: product.id,
                quantity,
                item_price: parseFloat(product.price) || 0,
            }],
        },
        ...params,
    });
}

/**
 * Track InitiateCheckout event
 * @param {Array} items - Cart items
 * @param {number} totalValue - Cart total
 * @param {Object} params - Additional parameters
 */
export function trackInitiateCheckout(items, totalValue, params = {}) {
    const contentIds = items.map(item => item.productId || item.id);
    const contents = items.map(item => ({
        id: item.productId || item.id,
        quantity: item.quantity || 1,
    }));

    return trackServerEvent({
        eventName: 'InitiateCheckout',
        customData: {
            content_type: 'product',
            content_ids: contentIds,
            contents,
            num_items: items.length,
            value: parseFloat(totalValue) || 0,
            currency: 'LKR',
        },
        ...params,
    });
}

/**
 * Track Purchase event
 * @param {Object} order - Order details
 * @param {Array} items - Purchased items
 * @param {Object} params - Additional parameters
 */
export async function trackPurchase(order, items, params = {}) {
    const contentIds = items.map(item => item.productId || item.id);
    const contents = items.map(item => ({
        id: item.productId || item.id,
        quantity: item.quantity || 1,
        item_price: item.price || 0,
    }));

    // Build user data with email for better matching
    const userData = { ...params.userData };
    if (order.email) {
        userData.email = order.email;
    }

    // Purchase events should be sent immediately for accuracy
    return trackServerEventImmediate({
        eventName: 'Purchase',
        eventId: params.eventId,
        eventSourceUrl: params.eventSourceUrl,
        userData,
        customData: {
            content_type: 'product',
            content_ids: contentIds,
            contents,
            value: parseFloat(order.totalAmount || order.amount) || 0,
            currency: order.currency || 'LKR',
            order_id: order.orderId || order.id || order._id,
            num_items: items.length,
        },
    });
}

/**
 * Track Lead event
 * @param {Object} leadData - Lead information
 * @param {Object} params - Additional parameters
 */
export function trackLead(leadData = {}, params = {}) {
    return trackServerEvent({
        eventName: 'Lead',
        customData: leadData,
        ...params,
    });
}

/**
 * Track CompleteRegistration event
 * @param {Object} registrationData - Registration info
 * @param {Object} params - Additional parameters
 */
export function trackCompleteRegistration(registrationData = {}, params = {}) {
    return trackServerEvent({
        eventName: 'CompleteRegistration',
        customData: {
            status: 'success',
            ...registrationData,
        },
        ...params,
    });
}

/**
 * Get configuration status
 * @returns {Object} Configuration status
 */
export function getConfigStatus() {
    return {
        configured: !!(config.pixelId && config.accessToken),
        pixelId: config.pixelId ? `${config.pixelId.substring(0, 4)}...` : null,
        hasToken: !!config.accessToken,
        testMode: !!config.testEventCode,
        apiVersion: config.apiVersion,
    };
}

// Flush queue on process exit (for serverless/shutdown)
process.on('beforeExit', async () => {
    console.log('[Meta CAPI] Flushing event queue before exit...');
    await eventQueue.flush();
});

export default {
    sendEvents,
    buildServerEvent,
    normalizeUserData,
    hashData,
    hashPhone,
    trackServerEvent,
    trackServerEventImmediate,
    trackPageView,
    trackViewContent,
    trackAddToCart,
    trackInitiateCheckout,
    trackPurchase,
    trackLead,
    trackCompleteRegistration,
    getConfigStatus,
    eventQueue,
};
