'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { parseVersion, resolveVersion, checkVersions } = require('../scripts/release');
const packageJson = require('../package.json');

assert.deepEqual(parseVersion('2.0.3'), [2, 0, 3]);
assert.throws(() => parseVersion('2.0'), /Invalid release version/);
assert.equal(resolveVersion('2.0.3', 'patch'), '2.0.4');
assert.equal(resolveVersion('2.0.3', 'minor'), '2.1.0');
assert.equal(resolveVersion('2.0.3', 'major'), '3.0.0');
assert.equal(resolveVersion('2.0.3', '4.5.6'), '4.5.6');
assert.equal(checkVersions(path.resolve(__dirname, '..')), packageJson.version);

console.log('Release version tests passed.');
