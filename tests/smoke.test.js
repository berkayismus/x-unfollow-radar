'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

function flattenKeys(value, prefix = '', output = []) {
    Object.entries(value).forEach(([key, child]) => {
        const keyPath = prefix ? `${prefix}.${key}` : key;
        if (child && typeof child === 'object' && !Array.isArray(child)) {
            flattenKeys(child, keyPath, output);
        } else {
            output.push(keyPath);
        }
    });
    return output.sort();
}

function testSessionLimits() {
    const context = { window: {} };
    vm.runInNewContext(read('src/shared/constants.js'), context);
    const constants = context.window.Constants;

    assert.equal(constants.getSessionLimit(constants.PLANS.FREE), 50);
    assert.equal(constants.getSessionLimit(constants.PLANS.PRO), 500);
    assert.equal(constants.getSessionLimit(constants.PLANS.EXPIRED), 50);
    assert.equal(constants.getSessionLimit('unknown'), 50);
    assert.deepEqual(Array.from(constants.LOCALES.SUPPORTED), ['tr', 'en', 'de']);
    assert.equal(constants.GUMROAD.PRODUCT_ID, 'XOdP9O_AruVvy5u7zkmD9Q==');
    assert.equal(constants.GUMROAD.PRODUCT_PERMALINK, undefined);
}

function testLocaleParity() {
    const locales = ['tr', 'en', 'de'].map((locale) => ({
        locale,
        data: JSON.parse(read(`locales/${locale}.json`))
    }));
    const expectedKeys = flattenKeys(locales[0].data);

    locales.slice(1).forEach(({ locale, data }) => {
        assert.deepEqual(flattenKeys(data), expectedKeys, `${locale} locale keys differ`);
    });

    locales.forEach(({ locale, data }) => {
        assert.ok(data.messages.profileOpened, `${locale} profileOpened translation is missing`);
        assert.ok(data.messages.unfollowed, `${locale} unfollowed translation is missing`);
    });
}

function testCsvSafety() {
    const context = { window: {} };
    vm.runInNewContext(read('src/shared/csv.js'), context);
    const csv = context.window.CsvUtils;

    assert.equal(csv.escapeField('plain'), '"plain"');
    assert.equal(csv.escapeField('a,"b"'), '"a,""b"""');
    assert.equal(csv.escapeField('=IMPORTXML("https://example.com")'), '"\'=IMPORTXML(""https://example.com"")"');
    assert.equal(
        csv.serialize([
            ['A', 'B'],
            ['one', 'two']
        ]),
        '"A","B"\r\n"one","two"'
    );
}

function testDomInterpretation() {
    const context = { window: {} };
    vm.runInNewContext(read('src/shared/dom.js'), context);
    const dom = context.window.DomUtils;

    assert.equal(dom.containsAnyPattern('Try again later.', ['try again later']), true);
    assert.equal(dom.containsAnyPattern('Regular confirmation', ['rate limit']), false);

    const textDialog = {
        innerText: 'Unfollow @TargetUser?',
        querySelectorAll: () => []
    };
    assert.equal(dom.dialogMatchesUsername(textDialog, 'targetuser'), true);
    assert.equal(dom.dialogMatchesUsername(textDialog, 'someoneelse'), false);

    const linkDialog = {
        innerText: 'Unfollow this account?',
        querySelectorAll: () => [{ getAttribute: () => '/TargetUser' }]
    };
    assert.equal(dom.dialogMatchesUsername(linkDialog, '@targetuser'), true);
}

function testRollingSafetyWindow() {
    const context = { window: {} };
    vm.runInNewContext(read('src/shared/safety-window.js'), context);
    const safetyWindow = context.window.SafetyWindow;
    const hour = 60 * 60 * 1000;
    const now = 100 * hour;

    assert.deepEqual(Array.from(safetyWindow.prune([now - 25 * hour, now - hour, now, now + hour], now, 24 * hour)), [
        now - hour,
        now,
        now + hour
    ]);
    assert.equal(safetyWindow.nextSlotAt([now - hour], 24 * hour), now + 23 * hour);

    const migrated = safetyWindow.fromStorage({
        timestamps: undefined,
        legacyCount: 3,
        legacyStart: now - 2 * hour,
        now,
        durationMs: 24 * hour,
        maxLegacyCount: 500
    });
    assert.deepEqual(Array.from(migrated), Array(3).fill(now - 2 * hour));

    const expiredLegacy = safetyWindow.fromStorage({
        timestamps: undefined,
        legacyCount: 3,
        legacyStart: now - 25 * hour,
        now,
        durationMs: 24 * hour,
        maxLegacyCount: 500
    });
    assert.deepEqual(Array.from(expiredLegacy), []);
}

function testRunStateMachine() {
    const context = { window: {} };
    vm.runInNewContext(read('src/shared/run-state.js'), context);
    const runs = context.window.RunStateUtils;
    const run = runs.create({ id: 'run-1', startedAt: 100, dryRun: false });

    assert.ok(runs.queue(run, 'alice', 110, 'unfollowed'));
    assert.equal(run.summary.queued, 1);
    assert.equal(
        runs.transition(run, 'alice', runs.ITEM_STATUS.SUCCEEDED, 120),
        null,
        'queued items must not skip the attempting state'
    );
    assert.ok(runs.transition(run, 'alice', runs.ITEM_STATUS.ATTEMPTING, 120));
    assert.equal(run.summary.queued, 0);
    assert.equal(run.summary.attempting, 1);
    assert.ok(runs.transition(run, 'alice', runs.ITEM_STATUS.SUCCEEDED, 130));
    assert.equal(run.summary.attempting, 0);
    assert.equal(run.summary.realSucceeded, 1);

    runs.queue(run, 'bob', 140, 'dry-run');
    runs.transition(run, 'bob', runs.ITEM_STATUS.ATTEMPTING, 150);
    runs.transition(run, 'bob', runs.ITEM_STATUS.FAILED, 160, 'verification_failed');
    assert.equal(run.summary.failed, 1);
    assert.ok(runs.skip(run, 'carol', 'whitelist', 170, 100));
    assert.equal(run.summary.skipped, 1);
    runs.queue(run, 'dave', 175, 'unfollowed');
    assert.ok(runs.skipQueued(run, 'dave', 'protected:whitelist', 176, 100));
    assert.equal(run.summary.queued, 0);
    assert.equal(run.summary.skipped, 2);
    runs.setStatus(run, 'completed', 180, true);
    assert.equal(run.status, 'completed');
    assert.equal(run.finishedAt, 180);

    runs.trimCompleted(run, 1);
    assert.equal(run.items.length, 1);
    assert.equal(run.summary.realSucceeded, 1, 'trimming records must preserve aggregate counts');
    assert.equal(run.summary.failed, 1, 'trimming records must preserve aggregate counts');
}

function testCandidateSelectionWorkflow() {
    const context = { window: {}, Set };
    vm.runInNewContext(read('src/shared/candidates.js'), context);
    const candidates = context.window.CandidateUtils;
    const scan = candidates.create(100);

    assert.equal(
        candidates.add(
            scan,
            {
                username: 'alice',
                displayName: 'Alice',
                preview: '@alice',
                discoveredAt: 110
            },
            2
        ),
        true
    );
    assert.equal(scan.candidates[0].selected, false, 'candidates must require explicit selection');
    assert.equal(
        candidates.add(
            scan,
            {
                username: 'alice',
                displayName: 'Alice',
                preview: '@alice',
                discoveredAt: 120
            },
            2
        ),
        false,
        'candidate usernames must be unique'
    );
    candidates.add(
        scan,
        {
            username: 'bob',
            displayName: 'Bob',
            preview: '@bob',
            discoveredAt: 130
        },
        2
    );
    assert.equal(
        candidates.add(
            scan,
            {
                username: 'carol',
                displayName: 'Carol',
                preview: '@carol',
                discoveredAt: 140
            },
            2
        ),
        false
    );
    assert.equal(scan.truncated, true);
    candidates.exclude(scan, 'whitelist');
    candidates.setSelection(scan, ['bob']);
    assert.deepEqual(Array.from(candidates.selectedUsernames(scan)), ['bob']);
    candidates.complete(scan, 200);
    assert.equal(scan.status, 'ready');
}

function testManifestScope() {
    const manifest = JSON.parse(read('manifest.json'));
    assert.equal(manifest.web_accessible_resources, undefined);
    assert.deepEqual(manifest.permissions, ['storage', 'activeTab']);
    assert.ok(manifest.content_scripts[0].js.includes('src/shared/dom.js'));
    assert.ok(manifest.content_scripts[0].js.includes('src/shared/user-detection.js'));
    assert.ok(manifest.content_scripts[0].js.includes('src/shared/safety-window.js'));
    assert.ok(manifest.content_scripts[0].js.includes('src/shared/run-state.js'));
    assert.ok(manifest.content_scripts[0].js.includes('src/shared/candidates.js'));
}

function testCriticalRegressionGuards() {
    const popupSource = read('src/popup/popup.js');
    const contentSource = read('src/content/index.js');
    const resetHandler = popupSource.slice(
        popupSource.indexOf('async function handleReset()'),
        popupSource.indexOf('async function handleDeleteAllData()')
    );

    assert.match(popupSource, /content\.hidden = !isActive/);
    assert.doesNotMatch(popupSource, /Constants\.LIMITS\.MAX_SESSION/);
    assert.doesNotMatch(contentSource, /Constants\.LIMITS\.MAX_SESSION/);
    assert.match(contentSource, /sessionLimit = Constants\.getSessionLimit\(currentPlan\)/);
    assert.match(contentSource, /processedUsers\.size - seenBeforeCycle/);
    assert.match(contentSource, /updateDailyStats\(Constants\.USER_ACTIONS\.DRY_RUN\)/);
    assert.match(contentSource, /if \(!dryRunMode && testMode && !testComplete/);
    assert.doesNotMatch(resetHandler, /STORAGE_KEYS\.SESSION_COUNT/);
    assert.doesNotMatch(resetHandler, /STORAGE_KEYS\.ACTION_TIMESTAMPS/);
    assert.match(resetHandler, /STORAGE_KEYS\.RUN_STATE/);
    assert.match(contentSource, /case Constants\.ACTIONS\.DELETE_ALL_DATA/);
    assert.match(popupSource, /chrome\.storage\.local\.clear\(\)/);
    assert.match(contentSource, /new AbortController\(\)/);
    assert.match(contentSource, /new MutationObserver\(/);
    assert.match(contentSource, /findConfirmationDialog\(username\)/);
    assert.match(contentSource, /MAX_CONSECUTIVE_FAILURES/);
    assert.match(contentSource, /pauseIfRateLimited\(\)/);
    assert.match(contentSource, /RunStateUtils\.ITEM_STATUS\.ATTEMPTING/);
    assert.match(popupSource, /loadLastRunState\(\)/);
    assert.match(popupSource, /Constants\.ACTIONS\.SCAN_CANDIDATES/);
    assert.match(popupSource, /Constants\.ACTIONS\.EXECUTE_SELECTED/);
    assert.match(popupSource, /confirm\(I18n\.t\('candidates\.confirmExecution'/);
    assert.match(contentSource, /operationMode === 'scan'/);
    assert.match(contentSource, /operationMode === 'execute'/);
    assert.match(contentSource, /UserDetection\.shouldSkipUser/);
}

testSessionLimits();
testLocaleParity();
testCsvSafety();
testDomInterpretation();
testRollingSafetyWindow();
testRunStateMachine();
testCandidateSelectionWorkflow();
testManifestScope();
testCriticalRegressionGuards();

console.log('Smoke tests passed.');
