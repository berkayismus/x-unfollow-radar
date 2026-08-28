'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

function assertSafeExistingFile(relativePath, label) {
    assert.equal(typeof relativePath, 'string', `${label} must be a file path`);
    const absolutePath = path.resolve(root, relativePath);
    assert.ok(absolutePath.startsWith(`${root}${path.sep}`), `${label} escapes the extension root: ${relativePath}`);
    assert.ok(fs.statSync(absolutePath).isFile(), `${label} is missing: ${relativePath}`);
}

assert.equal(manifest.manifest_version, 3, 'Only Manifest V3 packages are supported');
assert.equal(manifest.version, packageJson.version, 'manifest.json and package.json versions must match');
assert.equal(
    packageJson.dependencies,
    undefined,
    'Runtime npm dependencies cannot be shipped in this vanilla extension'
);

manifest.content_scripts.forEach((entry, entryIndex) => {
    entry.js.forEach((file, fileIndex) =>
        assertSafeExistingFile(file, `content_scripts[${entryIndex}].js[${fileIndex}]`)
    );
});

assertSafeExistingFile(manifest.background.service_worker, 'background.service_worker');
assertSafeExistingFile(manifest.action.default_popup, 'action.default_popup');
Object.entries(manifest.icons).forEach(([size, file]) => assertSafeExistingFile(file, `icons.${size}`));
Object.entries(manifest.action.default_icon).forEach(([size, file]) =>
    assertSafeExistingFile(file, `action.default_icon.${size}`)
);

const popupHtml = fs.readFileSync(path.join(root, manifest.action.default_popup), 'utf8');
for (const match of popupHtml.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const reference = match[1];
    if (/^(?:https?:|#)/.test(reference)) continue;
    const popupRelativePath = path.join(path.dirname(manifest.action.default_popup), reference);
    assertSafeExistingFile(popupRelativePath, `popup reference ${reference}`);
}

for (const locale of ['tr', 'en', 'de']) {
    assertSafeExistingFile(`locales/${locale}.json`, `${locale} locale`);
}

console.log(`Extension package ${manifest.version} validated successfully.`);
