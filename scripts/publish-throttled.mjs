#!/usr/bin/env node
/**
 * Publish packages to npm with throttling to avoid rate limits (429).
 * Publishes packages sequentially with a delay between each.
 *
 * Usage: node scripts/publish-throttled.mjs <dist-tag> [delay-seconds]
 * Example: node scripts/publish-throttled.mjs beta 15
 */

import { spawnSync } from 'child_process';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PACKAGES_DIR = join(ROOT, 'packages');

const DIST_TAG = process.argv[2] || 'beta';
const DELAY_SEC = parseInt(process.argv[3] || '15', 10);

const SKIP_PACKAGES = ['@template'];

function getPublishablePackages() {
  const packages = [];
  for (const name of readdirSync(PACKAGES_DIR)) {
    const pkgDir = join(PACKAGES_DIR, name);
    const pkgPath = join(pkgDir, 'package.json');
    if (!existsSync(pkgPath)) continue;
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    if (pkg.private || !pkg.name || pkg.name.includes('template')) continue;
    if (SKIP_PACKAGES.some((s) => pkg.name.includes(s))) continue;
    const distPath = join(pkgDir, 'dist');
    const mainEntry = pkg.main || pkg.module || 'dist/index.js';
    const entryPath = join(pkgDir, mainEntry);
    if (existsSync(distPath) || existsSync(entryPath)) {
      packages.push({ name: pkg.name, path: pkgDir });
    }
  }
  return packages;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function publishPackage(pkg, tag) {
  const result = spawnSync('npm', ['publish', '--access', 'public', '--tag', tag], {
    cwd: pkg.path,
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'pipe'],
    env: { ...process.env, CI: 'true' },
  });
  const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
  if (output) console.log(output);
  if (result.status !== 0) {
    if (output.includes('You cannot publish over the previously published versions') ||
        output.includes('EPUBLISHCONFLICT') ||
        output.includes('version already exists')) {
      console.log(`  (already published, skipping)`);
      return 0;
    }
    if (output.includes('429') || output.includes('Too Many Requests') || output.includes('rate limit')) {
      return 429;
    }
  }
  return result.status;
}

async function main() {
  const packages = getPublishablePackages();
  console.log(`Publishing ${packages.length} packages with tag "${DIST_TAG}" (${DELAY_SEC}s delay between each)\n`);

  const RETRY_DELAY_429 = 120000; // 2 min wait on rate limit
  const MAX_RETRIES_429 = 3;

  for (let i = 0; i < packages.length; i++) {
    const pkg = packages[i];
    console.log(`[${i + 1}/${packages.length}] Publishing ${pkg.name}...`);
    let status = publishPackage(pkg, DIST_TAG);
    let retries = 0;
    while (status === 429 && retries < MAX_RETRIES_429) {
      retries++;
      console.log(`  Rate limited (429). Waiting ${RETRY_DELAY_429 / 1000}s before retry ${retries}/${MAX_RETRIES_429}...`);
      await sleep(RETRY_DELAY_429);
      status = publishPackage(pkg, DIST_TAG);
    }
    if (status !== 0) {
      console.error(`\nFailed to publish ${pkg.name} (exit ${status})`);
      if (status === 429) {
        console.error('Rate limit exceeded. Consider increasing DELAY_SEC (e.g. 30) or RETRY_DELAY_429.');
      }
      process.exit(1);
    }
    if (i < packages.length - 1) {
      console.log(`Waiting ${DELAY_SEC}s before next publish...\n`);
      await sleep(DELAY_SEC * 1000);
    }
  }
  console.log('\nAll packages published successfully.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
