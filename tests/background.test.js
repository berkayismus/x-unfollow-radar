'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const constantsSource = fs.readFileSync(path.join(root, 'src/shared/constants.js'), 'utf8');
const backgroundSource = fs.readFileSync(path.join(root, 'src/background/index.js'), 'utf8');

function createHarness(fetchImpl, initialStorage = {}) {
    const storage = { ...initialStorage };
    let listener = null;
    let fetchCount = 0;

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
                getURL: value => value,
                sendMessage() {},
                onMessage: {
                    addListener(value) { listener = value; }
                }
            },
            storage: {
                local: {
                    async get(keys) {
                        const output = {};
                        keys.forEach(key => {
                            if (key in storage) output[key] = storage[key];
                        });
                        return output;
                    },
                    async set(values) {
                        Object.assign(storage, values);
                    }
                }
            }
        }
    });

    context.importScripts = () => vm.runInContext(constantsSource, context);
    vm.runInContext(backgroundSource, context);

    async function send(message) {
        return new Promise(resolve => {
            const keepChannelOpen = listener(message, {}, resolve);
            assert.equal(keepChannelOpen, true);
        });
    }

    return {
        storage,
        send,
        getFetchCount: () => fetchCount
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
    const harness = createHarness(async () => gumroadResponse());
    const activation = await harness.send({ action: 'VERIFY_LICENSE', licenseKey: 'TEST-KEY' });

    assert.equal(activation.success, true);
    assert.equal(activation.plan, 'pro');
    assert.equal(harness.storage.plan, 'pro');
    assert.equal(harness.storage.licenseKey, 'TEST-KEY');
    assert.ok(harness.storage.licenseLastVerifiedAt);

    const plan = await harness.send({ action: 'GET_PLAN' });
    assert.equal(plan.plan, 'pro');
    assert.equal(plan.licenseKey, undefined);
    assert.equal(harness.getFetchCount(), 1, 'fresh verification should be reused for 24 hours');
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
    const harness = createHarness(
        async () => gumroadResponse({ chargebacked: true }),
        {
            plan: 'pro',
            licenseKey: 'CHARGEBACK-KEY',
            licenseActivatedAt: now - (10 * 24 * 60 * 60 * 1000),
            licenseLastVerifiedAt: now - (2 * 24 * 60 * 60 * 1000)
        }
    );

    const plan = await harness.send({ action: 'GET_PLAN' });
    assert.equal(plan.plan, 'expired');
    assert.equal(plan.verificationStatus, 'chargebacked');
    assert.equal(harness.storage.plan, 'expired');
    assert.equal(plan.daysRemaining, null);
}

async function testPeriodicRevalidationRefreshesPurchaseDate() {
    const now = Date.now();
    const purchaseDate = new Date(now - (20 * 24 * 60 * 60 * 1000)).toISOString();
    const harness = createHarness(
        async () => gumroadResponse({ sale_timestamp: purchaseDate }),
        {
            plan: 'pro',
            licenseKey: 'ACTIVE-KEY',
            licenseActivatedAt: now - (10 * 24 * 60 * 60 * 1000),
            licenseLastVerifiedAt: now - (2 * 24 * 60 * 60 * 1000)
        }
    );

    const plan = await harness.send({ action: 'GET_PLAN' });
    assert.equal(plan.plan, 'pro');
    assert.equal(plan.verificationStatus, 'verified');
    assert.equal(plan.licenseActivatedAt, Date.parse(purchaseDate));
    assert.equal(harness.storage.licenseActivatedAt, Date.parse(purchaseDate));
}

(async () => {
    await testActivationAndCachedPlan();
    await testRefundedPurchaseIsRejected();
    await testPeriodicRevalidationRevokesChargeback();
    await testPeriodicRevalidationRefreshesPurchaseDate();
    console.log('Background tests passed.');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
