'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const constantsSource = fs.readFileSync(path.join(root, 'src/shared/constants.js'), 'utf8');
const migrationsSource = fs.readFileSync(path.join(root, 'src/shared/storage-migrations.js'), 'utf8');
const context = { window: {} };
vm.runInNewContext(constantsSource, context);
context.Constants = context.window.Constants;
vm.runInNewContext(migrationsSource, context);
const migrations = context.window.StorageMigrations;

function createStorage(initialData) {
    const data = structuredClone(initialData);
    let writeCount = 0;
    return {
        data,
        getWriteCount: () => writeCount,
        area: {
            async get() {
                return structuredClone(data);
            },
            async set(updates) {
                writeCount++;
                Object.assign(data, structuredClone(updates));
            },
            async remove(keys) {
                writeCount++;
                keys.forEach((key) => delete data[key]);
            }
        }
    };
}

async function testLegacyMigration() {
    const now = 1_000_000;
    const storage = createStorage({
        sessionCount: 3,
        sessionStart: 500_000,
        keywords: 'invalid',
        whitelist: null,
        candidateScan: { status: 'ready' }
    });

    const result = await migrations.migrate(storage.area, { now, maxLegacyCount: 500 });
    assert.equal(result.fromVersion, 0);
    assert.equal(result.toVersion, migrations.CURRENT_SCHEMA_VERSION);
    assert.equal(storage.data.schemaVersion, 2);
    assert.equal(storage.data.candidateScan, undefined);
    assert.deepEqual(storage.data.actionTimestamps, [500_000, 500_000, 500_000]);
    assert.deepEqual(storage.data.keywords, []);
    assert.deepEqual(storage.data.whitelist, {});
    assert.deepEqual(storage.data.unfollowStats, { daily: {} });
    assert.deepEqual(storage.data.unfollowHistory, []);
}

async function testMigrationIsIdempotent() {
    const storage = createStorage({ sessionCount: 2, sessionStart: 100 });
    await migrations.migrate(storage.area, { now: 200 });
    const migratedSnapshot = structuredClone(storage.data);
    await migrations.migrate(storage.area, { now: 300 });

    assert.equal(storage.getWriteCount(), 1, 'the second migration must not write');
    assert.deepEqual(storage.data, migratedSnapshot, 'the second migration must not change data');
}

function testFutureSchemaIsPreserved() {
    const result = migrations.plan({ schemaVersion: 99, custom: true }, { now: 100 });
    assert.equal(result.fromVersion, 99);
    assert.equal(result.toVersion, 99);
    assert.deepEqual(Object.keys(result.updates), []);
    assert.deepEqual(Array.from(result.removals), []);
}

(async () => {
    await testLegacyMigration();
    await testMigrationIsIdempotent();
    testFutureSchemaIsPreserved();
    console.log('Storage migration tests passed.');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
