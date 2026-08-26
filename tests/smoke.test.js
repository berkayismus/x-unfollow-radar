'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

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
}

function testLocaleParity() {
    const locales = ['tr', 'en', 'de'].map(locale => ({
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
    assert.equal(csv.escapeField('=IMPORTXML("https://example.com")'),
        '"\'=IMPORTXML(""https://example.com"")"');
    assert.equal(csv.serialize([['A', 'B'], ['one', 'two']]), '"A","B"\r\n"one","two"');
}

function testManifestScope() {
    const manifest = JSON.parse(read('manifest.json'));
    assert.equal(manifest.web_accessible_resources, undefined);
    assert.deepEqual(manifest.permissions, ['storage', 'activeTab']);
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
    assert.doesNotMatch(resetHandler, /STORAGE_KEYS\.SESSION_COUNT/);
    assert.match(contentSource, /case Constants\.ACTIONS\.DELETE_ALL_DATA/);
    assert.match(popupSource, /chrome\.storage\.local\.clear\(\)/);
}

testSessionLimits();
testLocaleParity();
testCsvSafety();
testManifestScope();
testCriticalRegressionGuards();

console.log('Smoke tests passed.');
