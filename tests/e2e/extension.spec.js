'use strict';

const path = require('node:path');
const { test, expect, chromium } = require('@playwright/test');

const extensionPath = path.resolve(__dirname, '../..');

test('loads the unpacked extension and preserves the approval-first popup flow', async () => {
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

        await serviceWorker.evaluate(async () => {
            await chrome.storage.local.set({
                candidateScan: {
                    id: 'playwright-scan',
                    status: 'ready',
                    startedAt: Date.now(),
                    finishedAt: Date.now(),
                    candidates: [
                        {
                            username: 'fixture_user',
                            displayName: 'Fixture User',
                            preview: '@fixture_user · candidate preview',
                            discoveredAt: Date.now(),
                            selected: false
                        }
                    ],
                    excluded: { followsYou: 0, whitelist: 0, keyword: 0 },
                    truncated: false
                }
            });
        });

        const page = await context.newPage();
        const pageErrors = [];
        page.on('pageerror', (error) => pageErrors.push(error.message));

        await page.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
        await expect(page).toHaveTitle('X Unfollow Radar');
        await expect(page.locator('#startBtn')).toBeDisabled();

        await expect(page.locator('#candidatePanel')).toBeVisible();
        await expect(page.locator('#candidateCount')).toHaveText('1');
        const candidateCheckbox = page.locator('#candidateList input[type="checkbox"]');
        await expect(candidateCheckbox).not.toBeChecked();
        await expect(page.locator('#executeSelectedBtn')).toBeDisabled();

        await candidateCheckbox.check();
        await expect(page.locator('#executeSelectedBtn')).toBeEnabled();

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
