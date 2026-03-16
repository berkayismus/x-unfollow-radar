/**
 * @fileoverview X Unfollow Radar - Background Service Worker
 * @description Handles message relay between content script and popup, and Gumroad license verification
 * @version 2.1.0
 */

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
        const GUMROAD_VERIFY_URL = 'https://api.gumroad.com/v2/licenses/verify';
        const PRODUCT_PERMALINK = 'vvbndt';

        try {
            const body = new URLSearchParams({
                product_permalink: PRODUCT_PERMALINK,
                license_key: licenseKey.trim(),
                increment_uses_count: 'false'
            });

            const response = await fetch(GUMROAD_VERIFY_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: body.toString()
            });

            if (!response.ok) {
                return { success: false, plan: null, error: 'network_error' };
            }

            const data = await response.json();

            if (data.success) {
                return { success: true, plan: 'pro', error: null };
            }

            return { success: false, plan: null, error: data.message || 'invalid_key' };
        } catch (error) {
            console.error('Gumroad verification error:', error);
            return { success: false, plan: null, error: 'network_error' };
        }
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
            await chrome.storage.local.set({
                plan: result.plan,
                licenseKey: licenseKey.trim(),
                licenseActivatedAt: Date.now()
            });
        }

        sendResponse(result);
    }

    /**
     * Reads the current plan from storage and responds
     * @param {function} sendResponse
     * @returns {Promise<void>}
     */
    async function handleGetPlan(sendResponse) {
        const data = await chrome.storage.local.get(['plan', 'licenseKey', 'licenseActivatedAt']);
        sendResponse({
            plan: data.plan || 'free',
            licenseKey: data.licenseKey || null,
            licenseActivatedAt: data.licenseActivatedAt || null
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
    function init() {
        console.log('🔵 X Unfollow Radar - Background Service Worker initialized');
        chrome.runtime.onMessage.addListener(handleMessage);
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
XUnfollowRadarBackground.init();
