#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const VALID_BUMP_TYPES = new Set(["patch", "minor", "major"]);
const bumpType = process.argv[2] || "patch";

if (!VALID_BUMP_TYPES.has(bumpType)) {
  console.error(
    `Invalid bump type "${bumpType}". Use one of: patch, minor, major.`,
  );
  process.exit(1);
}

const repoRoot = path.resolve(__dirname, "..");
const packagesDir = path.join(repoRoot, "packages");
const changesetDir = path.join(repoRoot, ".changeset");

if (!fs.existsSync(packagesDir)) {
  console.error(`Packages directory not found: ${packagesDir}`);
  process.exit(1);
}

const packageDirs = fs
  .readdirSync(packagesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const packageNames = [];
for (const packageDir of packageDirs) {
  const packageJsonPath = path.join(packagesDir, packageDir, "package.json");
  if (!fs.existsSync(packageJsonPath)) continue;

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  if (!packageJson.name || !packageJson.name.startsWith("@hazeljs/")) continue;
  packageNames.push(packageJson.name);
}

if (packageNames.length === 0) {
  console.error("No publishable @hazeljs/* packages were found.");
  process.exit(1);
}

packageNames.sort((a, b) => a.localeCompare(b));

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const fileName = `full-release-${timestamp}.md`;
const filePath = path.join(changesetDir, fileName);

const frontmatterLines = packageNames.map((name) => `"${name}": ${bumpType}`);
const body = [
  "---",
  ...frontmatterLines,
  "---",
  "",
  `Coordinated ${bumpType} release across all HazelJS packages.`,
  "",
].join("\n");

fs.writeFileSync(filePath, body, "utf8");
console.log(`Created ${path.relative(repoRoot, filePath)}`);
console.log(`Packages included: ${packageNames.length}`);
