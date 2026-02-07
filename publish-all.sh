#!/bin/bash

set -e  # Exit on any error

TAG=${1:-beta}  # Default to beta tag, or use first argument
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "Publishing all packages with tag: $TAG"
echo "=========================================="

# Tier 0: Core
echo "Publishing @hazeljs/core..."
cd "$SCRIPT_DIR/packages/core" && npm publish --access public --tag $TAG

# Tier 1: Packages depending only on core
TIER1_PACKAGES=("cache" "config" "auth" "cron" "prisma" "swagger" "websocket" "serverless" "discovery" "cli")
for pkg in "${TIER1_PACKAGES[@]}"; do
  echo "Publishing @hazeljs/$pkg..."
  cd "$SCRIPT_DIR/packages/$pkg" && npm publish --access public --tag $TAG
done

# Tier 2: Packages depending on tier 1
TIER2_PACKAGES=("ai" "rag")
for pkg in "${TIER2_PACKAGES[@]}"; do
  echo "Publishing @hazeljs/$pkg..."
  cd "$SCRIPT_DIR/packages/$pkg" && npm publish --access public --tag $TAG
done

# Tier 3: Packages depending on tier 2
echo "Publishing @hazeljs/agent..."
cd "$SCRIPT_DIR/packages/agent" && npm publish --access public --tag $TAG

cd "$SCRIPT_DIR"
echo "=========================================="
echo "All packages published successfully!"
