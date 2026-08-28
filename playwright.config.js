'use strict';

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests/e2e',
    fullyParallel: false,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    workers: 1,
    reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'line',
    timeout: 30_000,
    use: {
        trace: 'retain-on-failure'
    }
});
