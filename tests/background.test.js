'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const constantsSource = fs.readFileSync(path.join(root, 'src/shared/constants.js'), 'utf8');
const storageMigrationsSource = fs.readFileSync(path.join(root, 'src/shared/storage-migrations.js'), 'utf8');
const backgroundSource = fs.readFileSync(path.join(root, 'src/background/index.js'), 'utf8');

function createHarness(fetchImpl, initialStorage = {}) {
    const storage = { ...initialStorage };
    let listener = null;
    let fetchCount = 0;
    let runtimeMessageCount = 0;

    const context = vm.createContext({
        URLSearchParams,
        Date,
        Object,
        Number,
        Math,
        Promise,
        console: { log() {}, warn() {}, error() {} },
        self: {},
        fetch: async (...args) => {
            fetchCount++;
            return fetchImpl(...args);
        },
        chrome: {
            runtime: {
                getURL: (value) => value,
                sendMessage() {
                    runtimeMessageCount++;
                },
                onMessage: {
                    addListener(value) {
                        listener = value;
                    }
                }
            },
            storage: {
                local: {
                    async get(keys) {
                        if (keys === null) return { ...storage };
                        const output = {};
                        keys.forEach((key) => {
                            if (key in storage) output[key] = storage[key];
                        });
                        return output;
                    },
                    async set(values) {
                        Object.assign(storage, values);
                    },
                    async remove(keys) {
                        keys.forEach((key) => delete storage[key]);
                    }
                }
            }
        }
    });

    context.importScripts = (...urls) => {
        urls.forEach((url) => {
            if (url.endsWith('constants.js')) vm.runInContext(constantsSource, context);
            if (url.endsWith('storage-migrations.js')) vm.runInContext(storageMigrationsSource, context);
        });
    };
    vm.runInContext(backgroundSource, context);

    async function send(message) {
        return new Promise((resolve) => {
            const keepChannelOpen = listener(message, {}, resolve);
            assert.equal(keepChannelOpen, true);
        });
    }

    function dispatch(message) {
        return listener(message, {}, () => {});
    }

    return {
        storage,
        send,
        dispatch,
        getFetchCount: () => fetchCount,
        getRuntimeMessageCount: () => runtimeMessageCount
    };
}

function gumroadResponse(purchaseOverrides = {}, options = {}) {
    return {
        ok: options.ok ?? true,
        status: options.status ?? 200,
        async json() {
            return {
                success: options.success ?? true,
                purchase: {
                    sale_timestamp: new Date().toISOString(),
                    refunded: false,
                    disputed: false,
                    dispute_won: false,
                    chargebacked: false,
                    subscription_ended_at: null,
                    subscription_cancelled_at: null,
                    subscription_failed_at: null,
                    ...purchaseOverrides
                }
            };
        }
    };
}

async function testActivationAndCachedPlan() {
    let requestBody = null;
    const harness = createHarness(async (_url, options) => {
        requestBody = new URLSearchParams(options.body);
        return gumroadResponse();
    });
    const activation = await harness.send({ action: 'VERIFY_LICENSE', licenseKey: 'TEST-KEY' });

    assert.equal(activation.success, true);
    assert.equal(activation.plan, 'pro');
    assert.equal(harness.storage.plan, 'pro');
    assert.equal(harness.storage.licenseKey, 'TEST-KEY');
    assert.ok(harness.storage.licenseLastVerifiedAt);
    assert.equal(requestBody.get('product_id'), 'XOdP9O_AruVvy5u7zkmD9Q==');
    assert.equal(requestBody.has('product_permalink'), false);
    assert.equal(requestBody.get('increment_uses_count'), 'false');

    const plan = await harness.send({ action: 'GET_PLAN' });
    assert.equal(plan.plan, 'pro');
    assert.equal(plan.licenseKey, undefined);
    assert.equal(harness.getFetchCount(), 1, 'fresh verification should be reused for 24 hours');
}

function testStatusMessagesAreNotRelayed() {
    const harness = createHarness(async () => gumroadResponse());
    assert.equal(harness.dispatch({ type: 'STATUS_UPDATE' }), false);
    assert.equal(harness.getRuntimeMessageCount(), 0);
}

async function testRefundedPurchaseIsRejected() {
    const harness = createHarness(async () => gumroadResponse({ refunded: true }));
    const activation = await harness.send({ action: 'VERIFY_LICENSE', licenseKey: 'REFUNDED-KEY' });

    assert.equal(activation.success, false);
    assert.equal(activation.error, 'refunded');
    assert.equal(harness.storage.plan, undefined);
}

async function testPeriodicRevalidationRevokesChargeback() {
    const now = Date.now();
    const harness = createHarness(async () => gumroadResponse({ chargebacked: true }), {
        plan: 'pro',
        licenseKey: 'CHARGEBACK-KEY',
        licenseActivatedAt: now - 10 * 24 * 60 * 60 * 1000,
        licenseLastVerifiedAt: now - 2 * 24 * 60 * 60 * 1000
    });

    const plan = await harness.send({ action: 'GET_PLAN' });
    assert.equal(plan.plan, 'expired');
    assert.equal(plan.verificationStatus, 'chargebacked');
    assert.equal(harness.storage.plan, 'expired');
    assert.equal(plan.daysRemaining, null);
}

async function testPeriodicRevalidationRefreshesPurchaseDate() {
    const now = Date.now();
    const purchaseDate = new Date(now - 20 * 24 * 60 * 60 * 1000).toISOString();
    const harness = createHarness(async () => gumroadResponse({ sale_timestamp: purchaseDate }), {
        plan: 'pro',
        licenseKey: 'ACTIVE-KEY',
        licenseActivatedAt: now - 10 * 24 * 60 * 60 * 1000,
        licenseLastVerifiedAt: now - 2 * 24 * 60 * 60 * 1000
    });

    const plan = await harness.send({ action: 'GET_PLAN' });
    assert.equal(plan.plan, 'pro');
    assert.equal(plan.verificationStatus, 'verified');
    assert.equal(plan.licenseActivatedAt, Date.parse(purchaseDate));
    assert.equal(harness.storage.licenseActivatedAt, Date.parse(purchaseDate));
}

(async () => {
    testStatusMessagesAreNotRelayed();
    await testActivationAndCachedPlan();
    await testRefundedPurchaseIsRejected();
    await testPeriodicRevalidationRevokesChargeback();
    await testPeriodicRevalidationRefreshesPurchaseDate();
    console.log('Background tests passed.');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
