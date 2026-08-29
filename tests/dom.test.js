'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const context = { window: {} };

vm.runInNewContext(read('src/shared/constants.js'), context);
vm.runInNewContext(read('src/shared/dom.js'), context);

const { SELECTORS, TEXT_PATTERNS } = context.window.Constants;
const domUtils = context.window.DomUtils;

function findAction(markup, username) {
    const dom = new JSDOM(markup);
    return domUtils.findDialogAction(dom.window.document, {
        dialogSelector: SELECTORS.DIALOG,
        buttonSelector: SELECTORS.CONFIRM_BUTTON,
        buttonPatterns: TEXT_PATTERNS.CONFIRM_UNFOLLOW_BUTTON,
        username
    });
}

const roleDialogAction = findAction(
    `<div role="dialog">
        <p>@\u200esemanurnigar adlı kişinin takibi bırakılsın mı?</p>
        <div role="button" data-testid="confirmationSheetConfirm">Takibi bırak</div>
        <div role="button" data-testid="confirmationSheetCancel">İptal</div>
    </div>`,
    'semanurnigar'
);
assert.ok(roleDialogAction);
assert.equal(roleDialogAction.matchedUsername, true);
assert.equal(roleDialogAction.button.textContent, 'Takibi bırak');

const sheetAction = findAction(
    `<div data-testid="confirmationSheetDialog">
        <p>@targetuser adlı kişinin takibi bırakılsın mı?</p>
        <div role="button" data-testid="confirmationSheetConfirm"><span>Takibi bırak</span></div>
        <div role="button" data-testid="confirmationSheetCancel">İptal</div>
    </div>`,
    'targetuser'
);
assert.ok(sheetAction);
assert.equal(sheetAction.matchedUsername, true);

const uniqueFallback = findAction(
    `<section>
        <p>Hesap takibi bırakılsın mı?</p>
        <div role="button" data-testid="confirmationSheetConfirm">Takibi bırak</div>
    </section>`,
    'targetuser'
);
assert.ok(uniqueFallback);
assert.equal(uniqueFallback.matchedUsername, false);

const ambiguousAction = findAction(
    `<div>
        <div role="button" data-testid="confirmationSheetConfirm">Takibi bırak</div>
        <div role="button" data-testid="confirmationSheetConfirm">Takibi bırak</div>
    </div>`,
    'targetuser'
);
assert.equal(ambiguousAction, null);

console.log('Dialog action tests passed.');
