#!/usr/bin/env bash
# Sync GitHub "About" description + homepage for hazel-js/hazeljs (and optional Meridian).
# Requires: GitHub CLI (`gh`) authenticated with repo admin on hazel-js/*.
set -euo pipefail

DESC='HazelJS Agent OS — durable TypeScript agents (DNA, Skillgate, Gatekeeper, crash-safe HITL) in your Node backend'
HOMEPAGE='https://hazeljs.ai'

if ! command -v gh >/dev/null 2>&1; then
  echo "gh is not installed. Install GitHub CLI, then re-run:"
  echo "  brew install gh && gh auth login"
  echo "Intended about text:"
  echo "  $DESC"
  echo "  homepage: $HOMEPAGE"
  exit 1
fi

gh repo edit hazel-js/hazeljs \
  --description "$DESC" \
  --homepage "$HOMEPAGE" \
  --add-topic agent-os \
  --add-topic typescript \
  --add-topic ai-agents \
  --add-topic nodejs

echo "Updated hazel-js/hazeljs about + topics."

if gh repo view hazel-js/hazeljs-meridian-ops >/dev/null 2>&1; then
  gh repo edit hazel-js/hazeljs-meridian-ops \
    --description 'HazelJS Agent OS flagship — Meridian ops desk (DNA, Skillgate, Gatekeeper, HITL)' \
    --homepage 'https://hazeljs.ai/agent-os' \
    --add-topic agent-os \
    --add-topic typescript \
    --add-topic hazeljs
  echo "Updated hazel-js/hazeljs-meridian-ops about + topics."
fi
