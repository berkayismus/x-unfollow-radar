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
            .toEqual({ schemaVersion: 2 });

        const page = await context.newPage();
        const pageErrors = [];
        page.on('pageerror', (error) => pageErrors.push(error.message));

        await page.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
        await expect(page).toHaveTitle('X Unfollow Radar');
        await expect(page.locator('#startBtn')).toBeDisabled();

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
