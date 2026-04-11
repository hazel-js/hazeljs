# Contributing to HazelJS

## Package manager

This monorepo uses **npm** (workspaces + Lerna). Use `npm install` / `npm ci` at the repository root. Do not add `pnpm-lock.yaml` or `pnpm-workspace.yaml`; CI and release workflows assume npm only.

## Scripts

- `npm run build` — tiered build of all packages
- `npm run test` — tests in all workspaces
- `npm run lint` — ESLint in all workspaces
- `npm run format:check` — Prettier check
- `npm run typecheck` — `tsc -b` at the repo root

## Node.js

Target **Node.js 20+** (see root `package.json` `engines`).
