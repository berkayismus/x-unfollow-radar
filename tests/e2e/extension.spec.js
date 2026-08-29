'use strict';

const path = require('node:path');
const { test, expect, chromium } = require('@playwright/test');

const extensionPath = path.resolve(__dirname, '../..');

test('loads the unpacked extension and renders the popup navigation', async () => {
    const context = await chromium.launchPersistentContext('', {
        channel: 'chromium',
        headless: true,
        args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
    });

    try {
        let [serviceWorker] = context.serviceWorkers();
        if (!serviceWorker) serviceWorker = await context.waitForEvent('serviceworker');

        const serviceWorkerUrl = new URL(serviceWorker.url());
        const extensionId = serviceWorkerUrl.hostname;
        expect(serviceWorkerUrl.pathname).toBe('/src/background/index.js');
        await expect
            .poll(() => serviceWorker.evaluate(() => chrome.storage.local.get('schemaVersion')))
            .toEqual({ schemaVersion: 4 });
        await serviceWorker.evaluate(async () => {
            const now = Date.now();
            await chrome.storage.local.set({
                dryRunMode: true,
                dryRunTimestamps: [now - 2_000, now - 1_000],
                totalDryRun: 7
            });
        });

        const page = await context.newPage();
        const pageErrors = [];
        page.on('pageerror', (error) => pageErrors.push(error.message));

        await page.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
        await expect(page).toHaveTitle('X Unfollow Radar');
        await expect(page.locator('#startBtn')).toBeDisabled();
        await expect(page.locator('#sessionCountLabel')).toHaveText('24 Hour Simulated');
        await expect(page.locator('#sessionCount')).toHaveText('2');
        await expect(page.locator('#totalCountLabel')).toHaveText('Total Simulated');
        await expect(page.locator('#totalCount')).toHaveText('7');

        await serviceWorker.evaluate(async () => {
            const today = new Date().toISOString().split('T')[0];
            await chrome.storage.local.set({
                dryRunTimestamps: [],
                totalDryRun: 0,
                unfollowStats: { daily: { [today]: { dryRun: 3, unfollowed: 0, timestamp: Date.now() } } }
            });
            await chrome.runtime.sendMessage({
                type: 'STATUS_UPDATE',
                status: 'unfollowed',
                dryRun: true,
                username: 'legacy-content-script'
            });
        });
        await expect(page.locator('#sessionCount')).toHaveText('3');
        await expect(page.locator('#totalCount')).toHaveText('3');

        await page.locator('#tab-filters').click();
        await expect(page.locator('#filters-tab')).toBeVisible();
        await expect(page.locator('#main-tab')).toBeHidden();

        await page.locator('#tab-stats').click();
        await expect(page.locator('#stats-tab')).toBeVisible();
        await expect(page.locator('#filters-tab')).toBeHidden();

        expect(pageErrors).toEqual([]);
    } finally {
        await context.close();
    }
});
