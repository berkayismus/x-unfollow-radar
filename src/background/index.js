/**
 * @fileoverview X Unfollow Radar - Background Service Worker
 * @description Handles message relay between content script and popup, and Gumroad license verification
 */

importScripts(
    chrome.runtime.getURL('src/shared/constants.js'),
    chrome.runtime.getURL('src/shared/storage-migrations.js')
);

const SharedConstants = self.Constants;
const SharedStorageMigrations = self.StorageMigrations;

/**
 * X Unfollow Radar Background Module
 * @namespace XUnfollowRadarBackground
 */
const XUnfollowRadarBackground = (function () {
    'use strict';

    // ═══════════════════════════════════════════════════════════════
    // PRIVATE METHODS — Message Relay
    // ═══════════════════════════════════════════════════════════════

    /**
     * Relays a message to the runtime
     * @param {Object} message - Message to relay
     * @returns {void}
     */
    function relayMessage(message) {
        try {
            chrome.runtime.sendMessage(message);
        } catch (error) {
            // Popup might not be open, ignore error
            if (!error.message?.includes('Could not establish connection')) {
                console.error('Error relaying message:', error);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIVATE METHODS — Gumroad License Verification
    // ═══════════════════════════════════════════════════════════════

    /**
     * Calls the Gumroad API to verify a license key
     * @param {string} licenseKey - The license key entered by the user
     * @returns {Promise<{success: boolean, plan: string|null, error: string|null}>}
     */
    async function verifyLicenseWithGumroad(licenseKey) {
        try {
            const body = new URLSearchParams({
                product_id: SharedConstants.GUMROAD.PRODUCT_ID,
                license_key: licenseKey.trim(),
                increment_uses_count: 'false'
            });

            const response = await fetch(SharedConstants.GUMROAD.VERIFY_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: body.toString()
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                return {
                    success: false,
                    plan: null,
                    error: response.status === 404 ? 'invalid_key' : data.message || 'verification_failed'
                };
            }

            const purchase = data.purchase || {};
            const entitlementError = getEntitlementError(purchase);
            if (entitlementError) {
                return { success: false, plan: null, error: entitlementError };
            }

            const purchaseTimestamp = Date.parse(purchase.sale_timestamp || purchase.created_at || '');
            const activatedAt = Number.isFinite(purchaseTimestamp) ? purchaseTimestamp : Date.now();
            const expiresAt = activatedAt + SharedConstants.GUMROAD.LICENSE_DURATION_MS;

            if (Date.now() >= expiresAt) {
                return { success: false, plan: null, error: 'expired' };
            }

            return {
                success: true,
                plan: SharedConstants.PLANS.PRO,
                error: null,
                activatedAt,
                daysRemaining: Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000))
            };
        } catch (error) {
            console.error('Gumroad verification error:', error);
            return { success: false, plan: null, error: 'network_error' };
        }
    }

    /**
     * Returns the reason a Gumroad purchase cannot grant access.
     * @param {Object} purchase
     * @returns {string|null}
     */
    function getEntitlementError(purchase) {
        if (!purchase || Object.keys(purchase).length === 0) return 'invalid_purchase';
        if (purchase.refunded) return 'refunded';
        if (purchase.chargebacked) return 'chargebacked';
        if (purchase.disputed && !purchase.dispute_won) return 'disputed';

        const endedAt =
            purchase.subscription_ended_at || purchase.subscription_cancelled_at || purchase.subscription_failed_at;
        if (endedAt) {
            const endTimestamp = Date.parse(endedAt);
            if (!Number.isFinite(endTimestamp) || endTimestamp <= Date.now()) {
                return 'subscription_ended';
            }
        }

        return null;
    }

    /**
     * Verifies a license key, stores the result, and responds to the popup
     * @param {string} licenseKey
     * @param {function} sendResponse
     * @returns {Promise<void>}
     */
    async function handleVerifyLicense(licenseKey, sendResponse) {
        const result = await verifyLicenseWithGumroad(licenseKey);

        if (result.success) {
            const verifiedAt = Date.now();
            await chrome.storage.local.set({
                plan: result.plan,
                licenseKey: licenseKey.trim(),
                licenseActivatedAt: result.activatedAt,
                licenseLastVerifiedAt: verifiedAt
            });
        }

        sendResponse(result);
    }

    /**
     * Reads the current plan from storage, checks expiry, and responds
     * @param {function} sendResponse
     * @returns {Promise<void>}
     */
    async function handleGetPlan(sendResponse) {
        const data = await chrome.storage.local.get([
            SharedConstants.STORAGE_KEYS.PLAN,
            SharedConstants.STORAGE_KEYS.LICENSE_KEY,
            SharedConstants.STORAGE_KEYS.LICENSE_ACTIVATED_AT,
            SharedConstants.STORAGE_KEYS.LICENSE_LAST_VERIFIED_AT
        ]);
        const storedPlan = data.plan || SharedConstants.PLANS.FREE;
        const activatedAt = data.licenseActivatedAt || null;
        let effectiveActivatedAt = activatedAt;
        const lastVerifiedAt = data.licenseLastVerifiedAt || activatedAt;

        let plan = storedPlan;
        let daysRemaining = null;
        let expiredAt = null;
        let verificationStatus = 'not_required';

        if (storedPlan === SharedConstants.PLANS.PRO && activatedAt) {
            const now = Date.now();
            const elapsed = now - activatedAt;
            let remaining = SharedConstants.GUMROAD.LICENSE_DURATION_MS - elapsed;

            if (remaining <= 0) {
                plan = SharedConstants.PLANS.EXPIRED;
                expiredAt = activatedAt + SharedConstants.GUMROAD.LICENSE_DURATION_MS;
                verificationStatus = 'expired';
                await chrome.storage.local.set({ plan });
            } else {
                const verificationDue =
                    !lastVerifiedAt || now - lastVerifiedAt >= SharedConstants.GUMROAD.VERIFY_INTERVAL_MS;

                if (verificationDue && data.licenseKey) {
                    const verification = await verifyLicenseWithGumroad(data.licenseKey);
                    if (verification.success) {
                        verificationStatus = 'verified';
                        effectiveActivatedAt = verification.activatedAt;
                        remaining = verification.activatedAt + SharedConstants.GUMROAD.LICENSE_DURATION_MS - now;
                        await chrome.storage.local.set({
                            plan: SharedConstants.PLANS.PRO,
                            licenseActivatedAt: verification.activatedAt,
                            licenseLastVerifiedAt: now
                        });
                    } else if (verification.error === 'network_error') {
                        const withinGrace =
                            lastVerifiedAt && now - lastVerifiedAt <= SharedConstants.GUMROAD.OFFLINE_GRACE_MS;
                        verificationStatus = withinGrace ? 'offline_grace' : 'verification_required';
                        if (!withinGrace) plan = SharedConstants.PLANS.FREE;
                    } else {
                        plan = SharedConstants.PLANS.EXPIRED;
                        verificationStatus = verification.error;
                        await chrome.storage.local.set({ plan });
                    }
                }

                if (plan === SharedConstants.PLANS.PRO) {
                    daysRemaining = Math.ceil(remaining / (24 * 60 * 60 * 1000));
                }
            }
        }

        sendResponse({
            plan,
            licenseActivatedAt: effectiveActivatedAt,
            daysRemaining,
            expiredAt,
            verificationStatus
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIVATE METHODS — Message Handler
    // ═══════════════════════════════════════════════════════════════

    /**
     * Handles incoming messages from content script or popup
     * @param {Object} message - The message object
     * @param {chrome.runtime.MessageSender} sender - The sender information
     * @param {function} sendResponse - Function to send response
     * @returns {boolean} True to indicate async response
     */
    function handleMessage(message, sender, sendResponse) {
        console.log('Background received message:', message.type || message.action);

        switch (message.type) {
            case 'TEST_COMPLETE':
                relayMessage(message);
                break;

            case 'STATUS_UPDATE':
                relayMessage(message);
                break;

            case 'RATE_LIMIT_HIT':
                relayMessage(message);
                break;

            case 'USER_PROCESSED':
                relayMessage(message);
                break;

            case 'RUN_STATE_UPDATED':
                relayMessage(message);
                break;

            default:
                break;
        }

        switch (message.action) {
            case 'VERIFY_LICENSE':
                handleVerifyLicense(message.licenseKey, sendResponse);
                return true;

            case 'GET_PLAN':
                handleGetPlan(sendResponse);
                return true;

            default:
                if (message.action) {
                    console.log('Unknown action:', message.action);
                }
        }

        return true;
    }

    // ═══════════════════════════════════════════════════════════════
    // PUBLIC METHODS
    // ═══════════════════════════════════════════════════════════════

    /**
     * Initializes the background service worker
     * @returns {void}
     */
    async function init() {
        console.log('🔵 X Unfollow Radar - Background Service Worker initialized');
        chrome.runtime.onMessage.addListener(handleMessage);
        await SharedStorageMigrations.migrate(chrome.storage.local, {
            maxLegacyCount: SharedConstants.LIMITS.PRO_MAX_SESSION
        });
        console.log('✅ Message listener attached');
    }

    // ═══════════════════════════════════════════════════════════════
    // RETURN PUBLIC API
    // ═══════════════════════════════════════════════════════════════

    return {
        init
    };
})();

// Auto-initialize
XUnfollowRadarBackground.init().catch((error) => {
    console.error('Background initialization failed:', error);
});
