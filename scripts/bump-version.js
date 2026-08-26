#!/usr/bin/env node
/**
 * bump-version.js
 *
 * Updates every @hazeljs/* package to the given version and fixes all
 * @hazeljs/* peer dependency ranges to match (using ^ prefix).
 *
 * Usage:
 *   node scripts/bump-version.js 0.9.0
 *   npm run version:bump -- 0.9.0
 */

const fs = require('fs');
const path = require('path');

const newVersion = process.argv[2];
if (!newVersion || !/^\d+\.\d+\.\d+(-\S+)?$/.test(newVersion)) {
  console.error('Usage: node scripts/bump-version.js <version>  (e.g. 0.9.0)');
  process.exit(1);
}

const packagesDir = path.join(__dirname, '..', 'packages');
const rootPkgPath = path.join(__dirname, '..', 'package.json');

// Collect all @hazeljs/* package names so we know which peer dep keys to update
const hazelPackageNames = new Set();
for (const dir of fs.readdirSync(packagesDir)) {
  const pkgPath = path.join(packagesDir, dir, 'package.json');
  if (!fs.existsSync(pkgPath)) continue;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (pkg.name && pkg.name.startsWith('@hazeljs/')) {
    hazelPackageNames.add(pkg.name);
  }
}

let updatedCount = 0;

function updatePackageJson(pkgPath, isTemplate = false) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  let changed = false;

  // Update own version (skip template scaffolds — they intentionally use "latest")
  if (!isTemplate && pkg.version) {
    pkg.version = newVersion;
    changed = true;
  }

  // Update @hazeljs/* ranges in peerDependencies, dependencies, and devDependencies
  for (const section of ['peerDependencies', 'dependencies', 'devDependencies']) {
    if (!pkg[section]) continue;
    for (const [name, range] of Object.entries(pkg[section])) {
      if (hazelPackageNames.has(name) && !String(range).startsWith('file:') && range !== 'latest') {
        pkg[section][name] = `^${newVersion}`;
        changed = true;
      }
    }
  }

  if (changed) {
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    updatedCount++;
    console.log(`  updated: ${pkgPath.replace(path.join(__dirname, '..') + '/', '')}`);
  }
}

console.log(`\nBumping all @hazeljs/* packages to ${newVersion}...\n`);

for (const dir of fs.readdirSync(packagesDir)) {
  const pkgPath = path.join(packagesDir, dir, 'package.json');
  if (!fs.existsSync(pkgPath)) continue;
  const isTemplate = dir.startsWith('@template');
  updatePackageJson(pkgPath, isTemplate);
}

// Also update root package.json version
updatePackageJson(rootPkgPath);

// Sync lerna.json version without re-serializing (JSON.stringify expands short
// arrays; Prettier keeps them single-line and CI format:check would fail).
const lernaPath = path.join(__dirname, '..', 'lerna.json');
if (fs.existsSync(lernaPath)) {
  const raw = fs.readFileSync(lernaPath, 'utf8');
  const next = raw.replace(/("version"\s*:\s*")[^"]*(")/, `$1${newVersion}$2`);
  if (next !== raw) {
    fs.writeFileSync(lernaPath, next);
    console.log(`  updated: lerna.json`);
  }
}

console.log(`\nDone. ${updatedCount} file(s) updated to v${newVersion}.\n`);
