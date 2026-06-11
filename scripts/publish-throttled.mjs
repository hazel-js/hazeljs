#!/usr/bin/env node
/**
 * Publish packages to npm with throttling to avoid rate limits (429).
 * Publishes via npm Trusted Publisher (OIDC) in CI — no NPM_TOKEN required.
 * Safe to re-run: skips versions already on the registry and repairs dist-tags.
 *
 * Usage: node scripts/publish-throttled.mjs <dist-tag> [delay-seconds]
 * Example: node scripts/publish-throttled.mjs latest 15
 */

import { spawnSync } from 'child_process';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PACKAGES_DIR = join(ROOT, 'packages');

const DIST_TAG = process.argv[2] || 'latest';
const DELAY_SEC = parseInt(process.argv[3] || '15', 10);

const SKIP_PACKAGES = ['@template'];

const ALREADY_PUBLISHED_PATTERNS = [
  'You cannot publish over the previously published versions',
  'EPUBLISHCONFLICT',
  'version already exists',
  'E409',
  '409 Conflict',
  'Cannot publish over',
  'already been published',
  'previously published',
  'not allowed to publish the same version',
  'Package version already published',
];

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
      packages.push({ name: pkg.name, version: pkg.version, path: pkgDir });
    }
  }
  return packages;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function publishEnv() {
  const env = { ...process.env, CI: 'true' };
  delete env.NODE_AUTH_TOKEN;
  delete env.NPM_TOKEN;
  return env;
}

function runNpm(args) {
  return spawnSync('npm', args, {
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'pipe'],
    env: publishEnv(),
  });
}

function npmOutput(result) {
  return [result.stdout, result.stderr].filter(Boolean).join('\n');
}

function isAlreadyPublishedOutput(output) {
  return ALREADY_PUBLISHED_PATTERNS.some((pattern) => output.includes(pattern));
}

function isVersionOnRegistry(name, version) {
  const result = runNpm(['view', `${name}@${version}`, 'version', '--json']);
  if (result.status !== 0) {
    return false;
  }
  try {
    const parsed = JSON.parse(result.stdout.trim());
    const published = Array.isArray(parsed) ? parsed[0] : parsed;
    return String(published) === version;
  } catch {
    return result.stdout.trim().includes(version);
  }
}

function ensureDistTag(name, version, tag) {
  const result = runNpm(['dist-tag', 'add', `${name}@${version}`, tag]);
  const output = npmOutput(result);
  if (output) console.log(output);
  if (
    result.status === 0 ||
    output.includes('already') ||
    output.includes('E409') ||
    output.includes('409')
  ) {
    return true;
  }
  console.warn(`  Warning: could not set dist-tag ${tag} on ${name}@${version}`);
  return false;
}

function publishPackage(pkg, tag) {
  const result = spawnSync(
    'npm',
    ['publish', '--access', 'public', '--provenance', '--tag', tag],
    {
      cwd: pkg.path,
      encoding: 'utf8',
      stdio: ['inherit', 'pipe', 'pipe'],
      env: publishEnv(),
    }
  );
  const output = npmOutput(result);
  if (output) console.log(output);
  if (result.status === 0) {
    return { status: 0, skipped: false };
  }
  if (isAlreadyPublishedOutput(output)) {
    return { status: 0, skipped: true, reason: 'already published' };
  }
  if (output.includes('429') || output.includes('Too Many Requests') || output.includes('rate limit')) {
    return { status: 429, skipped: false };
  }
  if (output.includes('E404') || output.includes('404 Not Found')) {
    console.error(
      '  Publish auth failed (E404). Verify npm Trusted Publisher: repo hazel-js/hazeljs, workflow publish.yml, environment prod, and id-token: write on this job.'
    );
  }
  return { status: result.status ?? 1, skipped: false };
}

async function publishOne(pkg, tag) {
  if (isVersionOnRegistry(pkg.name, pkg.version)) {
    console.log(`  ${pkg.name}@${pkg.version} already on registry — skipping publish`);
    ensureDistTag(pkg.name, pkg.version, tag);
    return { ok: true, skipped: true };
  }

  const RETRY_DELAY_429 = 120000;
  const MAX_RETRIES_429 = 3;

  let result = publishPackage(pkg, tag);
  let retries = 0;
  while (result.status === 429 && retries < MAX_RETRIES_429) {
    retries++;
    console.log(
      `  Rate limited (429). Waiting ${RETRY_DELAY_429 / 1000}s before retry ${retries}/${MAX_RETRIES_429}...`
    );
    await sleep(RETRY_DELAY_429);
    result = publishPackage(pkg, tag);
  }

  if (result.status !== 0) {
    return { ok: false, skipped: false, status: result.status };
  }

  if (result.skipped) {
    console.log(`  (already published, ensuring dist-tag ${tag})`);
    ensureDistTag(pkg.name, pkg.version, tag);
  }

  return { ok: true, skipped: result.skipped };
}

async function main() {
  const packages = getPublishablePackages();
  console.log(
    `Publishing ${packages.length} packages with tag "${DIST_TAG}" (${DELAY_SEC}s delay between each)\n`
  );

  let published = 0;
  let skipped = 0;
  const failed = [];

  for (let i = 0; i < packages.length; i++) {
    const pkg = packages[i];
    console.log(`[${i + 1}/${packages.length}] Publishing ${pkg.name}@${pkg.version}...`);

    const outcome = await publishOne(pkg, DIST_TAG);
    if (!outcome.ok) {
      failed.push({ name: pkg.name, status: outcome.status });
      console.error(`  Failed to publish ${pkg.name} (exit ${outcome.status})`);
      if (outcome.status === 429) {
        console.error('  Rate limit exceeded. Re-run this workflow to continue from remaining packages.');
      }
    } else if (outcome.skipped) {
      skipped++;
    } else {
      published++;
    }

    if (i < packages.length - 1) {
      console.log(`Waiting ${DELAY_SEC}s before next publish...\n`);
      await sleep(DELAY_SEC * 1000);
    }
  }

  console.log('\n--- Publish summary ---');
  console.log(`Published: ${published}`);
  console.log(`Skipped (already on registry): ${skipped}`);
  console.log(`Failed: ${failed.length}`);

  if (failed.length > 0) {
    console.error('\nFailed packages:');
    for (const f of failed) {
      console.error(`  - ${f.name} (exit ${f.status})`);
    }
    console.error('\nRe-run the publish workflow to retry only the remaining packages.');
    process.exit(1);
  }

  console.log('\nAll packages published successfully.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
