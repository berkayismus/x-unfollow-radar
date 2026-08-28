'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

function loadHelpers() {
    const context = { window: {} };
    vm.runInNewContext(read('src/shared/constants.js'), context);
    vm.runInNewContext(read('src/shared/user-detection.js'), context);
    return {
        constants: context.window.Constants,
        detection: context.window.UserDetection
    };
}

function loadCell(fixtureName, selector) {
    const dom = new JSDOM(read(`tests/fixtures/${fixtureName}`));
    return dom.window.document.querySelector(selector);
}

const { constants, detection } = loadHelpers();
const options = {
    selectors: constants.SELECTORS,
    patterns: constants.TEXT_PATTERNS,
    whitelist: {},
    keywords: []
};

const candidateCell = loadCell('user-cell-non-follower.html', constants.SELECTORS.USER_CELL_MAIN);
const candidate = detection.inspectCandidate(candidateCell, options);
assert.equal(candidate.username, 'alice');
assert.equal(candidate.followsYou, false);
assert.ok(candidate.followingButton);
assert.equal(candidate.skip, false);

const followerCell = loadCell('user-cell-follower.html', constants.SELECTORS.USER_CELL_MAIN);
const follower = detection.inspectCandidate(followerCell, options);
assert.equal(follower.username, 'bob');
assert.equal(follower.followsYou, true);

const protectedUser = detection.inspectCandidate(candidateCell, {
    ...options,
    whitelist: { alice: { addedAt: 1 } }
});
assert.equal(protectedUser.skip, true);
assert.equal(protectedUser.skipReason, 'whitelist');

const keywordCell = loadCell('user-cell-turkish-keyword.html', constants.SELECTORS.USER_CELL_MAIN);
const keywordUser = detection.inspectCandidate(keywordCell, {
    ...options,
    keywords: ['yatırımcı']
});
assert.equal(keywordUser.username, 'carol');
assert.equal(keywordUser.skip, true);
assert.equal(keywordUser.skipReason, 'keyword:yatırımcı');
assert.ok(keywordUser.followingButton, 'Turkish following button should be detected');

console.log('UserCell fixture tests passed.');
