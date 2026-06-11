#!/usr/bin/env node
/**
 * Publish packages to npm with throttling to avoid rate limits (429).
 * Publishes via npm Trusted Publisher (OIDC) in CI — no NPM_TOKEN required.
 * Safe to re-run: skips versions already on the registry and repairs dist-tags.
 *
 * Usage: node scripts/publish-throttled.mjs <dist-tag> [delay-seconds] [package-filter]
 * Example: node scripts/publish-throttled.mjs latest 5
 * Example: node scripts/publish-throttled.mjs latest 5 saga,queue,distributed-lock
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
const DELAY_SEC = parseInt(process.argv[3] || '5', 10);
const PACKAGE_FILTER = process.argv[4] || process.env.PUBLISH_PACKAGES_ONLY || '';

const SKIP_PACKAGES = ['@template'];
const RETRY_DELAYS_MS = [15000, 45000, 90000];
const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;

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

const TRANSIENT_ERROR_PATTERNS = [
  '429',
  'Too Many Requests',
  'rate limit',
  'ETIMEDOUT',
  'ECONNRESET',
  'socket hang up',
  '502 Bad Gateway',
  '503 Service Unavailable',
  '504 Gateway Timeout',
  'EAI_AGAIN',
  'network',
  'timeout',
  'temporarily unavailable',
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
      packages.push({ name: pkg.name, version: pkg.version, path: pkgDir, dir: name });
    }
  }
  return packages;
}

function filterPackages(packages, filter) {
  if (!filter?.trim()) return packages;
  const wanted = new Set(
    filter
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .flatMap((s) => [s, s.replace(/^@hazeljs\//, '')])
  );
  return packages.filter(
    (p) => wanted.has(p.name) || wanted.has(p.dir) || wanted.has(p.name.replace('@hazeljs/', ''))
  );
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

function runNpm(args, cwd) {
  return spawnSync('npm', args, {
    cwd,
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

function isTransientError(output) {
  return TRANSIENT_ERROR_PATTERNS.some((pattern) =>
    output.toLowerCase().includes(pattern.toLowerCase())
  );
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

function publishPackage(pkg, tag, { provenance = true } = {}) {
  const args = ['publish', '--access', 'public', '--tag', tag];
  if (provenance) {
    args.push('--provenance');
  }

  const result = runNpm(args, pkg.path);
  const output = npmOutput(result);
  if (output) console.log(output);

  if (result.status === 0) {
    return { status: 0, skipped: false, output };
  }
  if (isAlreadyPublishedOutput(output)) {
    return { status: 0, skipped: true, reason: 'already published', output };
  }
  if (output.includes('E404') || output.includes('404 Not Found')) {
    console.error(
      '  Publish auth failed (E404). Verify npm Trusted Publisher: repo hazel-js/hazeljs, workflow publish.yml, environment prod, and id-token: write on this job.'
    );
  }
  return { status: result.status ?? 1, skipped: false, output };
}

async function publishOne(pkg, tag) {
  if (isVersionOnRegistry(pkg.name, pkg.version)) {
    console.log(`  ${pkg.name}@${pkg.version} already on registry — skipping publish`);
    ensureDistTag(pkg.name, pkg.version, tag);
    return { ok: true, skipped: true };
  }

  let lastStatus = 1;
  let lastOutput = '';

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const useProvenance = attempt < MAX_ATTEMPTS - 1;
    if (attempt > 0) {
      const isRateLimit = lastOutput.includes('429') || lastOutput.toLowerCase().includes('rate limit');
      const delay = isRateLimit ? 120000 : RETRY_DELAYS_MS[attempt - 1];
      console.log(
        `  Attempt ${attempt + 1}/${MAX_ATTEMPTS} in ${delay / 1000}s${useProvenance ? '' : ' (without provenance)'}...`
      );
      await sleep(delay);
    }

    const result = publishPackage(pkg, tag, { provenance: useProvenance });
    lastOutput = result.output || '';
    lastStatus = result.status;

    if (result.status === 0) {
      if (result.skipped) {
        console.log(`  (already published, ensuring dist-tag ${tag})`);
        ensureDistTag(pkg.name, pkg.version, tag);
      }
      return { ok: true, skipped: result.skipped };
    }

    if (!isTransientError(lastOutput) && !isAlreadyPublishedOutput(lastOutput) && attempt === 0) {
      console.error(`  Publish error: ${lastOutput.split('\n').slice(-5).join('\n')}`);
    }
  }

  return { ok: false, skipped: false, status: lastStatus, output: lastOutput };
}

async function runPass(packages, tag, passLabel) {
  let published = 0;
  let skipped = 0;
  const failed = [];

  for (let i = 0; i < packages.length; i++) {
    const pkg = packages[i];
    console.log(`[${i + 1}/${packages.length}] ${passLabel} ${pkg.name}@${pkg.version}...`);

    const outcome = await publishOne(pkg, tag);
    if (!outcome.ok) {
      failed.push({ name: pkg.name, status: outcome.status, pkg });
      console.error(`  Failed to publish ${pkg.name} (exit ${outcome.status})`);
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

  return { published, skipped, failed };
}

async function main() {
  const allPackages = getPublishablePackages();
  const packages = filterPackages(allPackages, PACKAGE_FILTER);

  if (packages.length === 0) {
    console.error('No packages matched the publish filter.');
    process.exit(1);
  }

  console.log(
    `Publishing ${packages.length} package(s) with tag "${DIST_TAG}" (${DELAY_SEC}s delay between each)\n`
  );
  if (PACKAGE_FILTER) {
    console.log(`Filter: ${PACKAGE_FILTER}\n`);
  }

  let totals = { published: 0, skipped: 0, failed: [] };

  const first = await runPass(packages, DIST_TAG, 'Publishing');
  totals.published += first.published;
  totals.skipped += first.skipped;
  totals.failed = first.failed;

  if (totals.failed.length > 0) {
    console.log(`\n=== Final retry pass (${totals.failed.length} packages, 2 min cooldown) ===\n`);
    await sleep(120000);
    const retryPkgs = totals.failed.map((f) => f.pkg);
    const retry = await runPass(retryPkgs, DIST_TAG, 'Retrying');
    totals.published += retry.published;
    totals.skipped += retry.skipped;
    totals.failed = retry.failed;
  }

  console.log('\n--- Publish summary ---');
  console.log(`Published: ${totals.published}`);
  console.log(`Skipped (already on registry): ${totals.skipped}`);
  console.log(`Failed: ${totals.failed.length}`);

  if (totals.failed.length > 0) {
    console.error('\nFailed packages:');
    const names = totals.failed.map((f) => f.name.replace('@hazeljs/', ''));
    for (const f of totals.failed) {
      console.error(`  - ${f.name} (exit ${f.status})`);
    }
    console.error('\nRe-run the publish workflow with packages_only:');
    console.error(`  ${names.join(',')}`);
    process.exit(1);
  }

  console.log('\nAll packages published successfully.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
