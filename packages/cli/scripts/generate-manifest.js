#!/usr/bin/env node

/**
 * Generate cli-manifest.json with dynamic version from package.json
 * This ensures the manifest always reflects the actual package version
 */

const fs = require('fs');
const path = require('path');

// Read package.json to get the actual version
const packageJsonPath = path.join(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Read the manifest template
const manifestTemplatePath = path.join(__dirname, '../cli-manifest.template.json');
const manifest = JSON.parse(fs.readFileSync(manifestTemplatePath, 'utf8'));

// Inject the version
manifest.cli.version = packageJson.version;

// Write the final manifest
const manifestPath = path.join(__dirname, '../cli-manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

console.log(`✓ Generated cli-manifest.json with version ${packageJson.version}`);
