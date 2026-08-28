'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function parseVersion(version) {
    const match = versionPattern.exec(String(version));
    if (!match) throw new Error(`Invalid release version: ${version}`);
    return match.slice(1).map(Number);
}

function resolveVersion(currentVersion, requestedVersion) {
    const parts = parseVersion(currentVersion);
    if (versionPattern.test(String(requestedVersion))) return String(requestedVersion);

    switch (requestedVersion) {
        case 'major':
            return `${parts[0] + 1}.0.0`;
        case 'minor':
            return `${parts[0]}.${parts[1] + 1}.0`;
        case 'patch':
            return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
        default:
            throw new Error('Release target must be major, minor, patch, or an explicit x.y.z version');
    }
}

function readJson(root, filename) {
    return JSON.parse(fs.readFileSync(path.join(root, filename), 'utf8'));
}

function writeJson(root, filename, value) {
    fs.writeFileSync(path.join(root, filename), `${JSON.stringify(value, null, 4)}\n`);
}

function checkVersions(root = projectRoot) {
    const packageJson = readJson(root, 'package.json');
    const packageLock = readJson(root, 'package-lock.json');
    const manifest = readJson(root, 'manifest.json');
    parseVersion(packageJson.version);

    assert.equal(manifest.version, packageJson.version, 'manifest.json version differs from package.json');
    assert.equal(packageLock.version, packageJson.version, 'package-lock.json version differs from package.json');
    assert.equal(
        packageLock.packages?.['']?.version,
        packageJson.version,
        'package-lock.json root package version differs from package.json'
    );

    return packageJson.version;
}

function setVersion(requestedVersion, root = projectRoot) {
    const packageJson = readJson(root, 'package.json');
    const packageLock = readJson(root, 'package-lock.json');
    const manifest = readJson(root, 'manifest.json');
    const nextVersion = resolveVersion(packageJson.version, requestedVersion);

    packageJson.version = nextVersion;
    packageLock.version = nextVersion;
    packageLock.packages[''].version = nextVersion;
    manifest.version = nextVersion;

    writeJson(root, 'package.json', packageJson);
    writeJson(root, 'package-lock.json', packageLock);
    writeJson(root, 'manifest.json', manifest);
    checkVersions(root);
    return nextVersion;
}

if (require.main === module) {
    try {
        const requestedVersion = process.argv[2];
        if (requestedVersion === '--check') {
            console.log(`Release files are synchronized at ${checkVersions()}.`);
        } else {
            const nextVersion = setVersion(requestedVersion);
            console.log(`Release files updated to ${nextVersion}. Run the full test suite before committing.`);
        }
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}

module.exports = { parseVersion, resolveVersion, checkVersions, setVersion };
