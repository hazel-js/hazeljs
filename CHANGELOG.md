# Changelog

All notable changes to HazelJS are documented here. The project follows [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Agent OS — production hardening

- Separate **critique** vs **validate** loop stages; failed loops return `FAILED` below `successScore`; softer no-LLM heuristic (score 70)
- `executeStream` honors `options.loop` (yields final `done` chunk)
- `RETRYING` / `BLOCKED` state transitions in recovery path
- `runtime.hotReloadDna()` / `installAgentPackage()` + `hazel agent install|dna`
- `assessKnowledgeFreshness` wired into RAG context metadata
- GraphRAG bridge: `memoryGraphFromKnowledgeGraph` / `syncMemoryGraphToKnowledgeGraph`
- `FileTimelineStore` + `attachTimelineStore` for durable timelines
- `@hazeljs/testing` suite-level `maxLatencyMs` / `maxCostUsd` enforcement

### Agent OS Phases 2–4

- **Time travel** — `TimeTravelDebugger` (fork / edit prompt|tool output / prepareContinue); `runtime.getTimeTravel()`
- **Contracts** — `validateAgentContract`, `executeWithContract`, `options.contract` (+ fallback agent)
- **Policies** — `PolicyEngine` allow / deny / mask / require_approval; wired into `ToolExecutor`
- **Recovery** — `runRecoveryLadder`, `options.recovery`
- **Benchmark** — `@hazeljs/benchmark` + `hazel benchmark` (baseline compare, `--ci`)
- **Skills** — `openApiToSkills`, `createSkillInvoker`
- **Memory graph** — `AgentMemoryGraph`
- **Evolution** — `evolveSystemPrompt`, `runEvolutionLoop`
- **Cost** — `CostOptimizer`, `options.costRoute`
- **Simulator** — `runAgentSimulator`
- **Digital twin** — `runDigitalTwin`, `shouldRunCanary`
- **DNA / marketplace** — `exportAgentDna`, `parseDna`, `toMarketplacePackage`
- **Consensus** — `runConsensus`, `collectConsensusVotes`
- **Governance** — `GovernanceGate`, `options.governance`

### Agent OS Phase 1

- **`@hazeljs/agent` — Loop Engine**: `options.loop: { maxIterations, successScore, stages? }` — plan → execute → critique → validate around Think→Act
- **`@hazeljs/agent` — State machine**: Extended `AgentState` (`planning`, `searching_knowledge`, `searching_memory`, `retrying`, `blocked`, `validating`, …) plus `onState` / `onStateChange`
- **`@hazeljs/agent` — Visual timeline**: Timeline recorder (`getTimeline` / `getTimelineRecorder`); events `LOOP_ITERATION`, `LOOP_CRITIQUE`, `LOOP_COMPLETE`
- **`@hazeljs/inspector`**: `GET /__hazel/agents/:name/stream` (SSE), `GET /__hazel/agents/:name/timeline`, Agents UI Timeline panel
- **`@hazeljs/testing`**: New package — `describeAgent`, `runAgentSuite`, `bindAgentSuite`, `assertAgentResult`, `expectTools`, `runAgentGolden` / `reportAgentCi`

---

## [1.0.1] - 2026-06-14

### `@hazeljs/agent` — Production hardening

- **Durable state**: `createStateManager`, `createStateManagerFromEnv`, `resolveStateManagerFromEnv`; `AgentModule.forRootAsync` for `REDIS_URL`
- **Durable approvals**: `IApprovalStore`, `RedisApprovalStore`, `useRedisApprovals` module option
- **Resilience**: Local retry/rate-limiter delegate to `@hazeljs/resilience`; removed `circuit-breaker.js` shim
- **Observability**: Optional OTel spans via `observabilityProvider` (`agent.execute`, `agent.tool.execute`, `agent.llm`)
- **Error handling**: `agent.rag.failed` events, `strictEventHandlers`, LLM bootstrap timeout logging
- **Types**: `RedisClientLike`, `PrismaClientLike` for state manager clients

---

## [1.0.0] - 2026-06-10

### Highlights

- **Stable release** — all 47 `@hazeljs/*` packages published to npm `latest`
- Semver guarantee: no breaking changes in patch/minor 1.x releases
- Production-ready test coverage thresholds on core packages
- Node.js 20, 22, and 23 CI matrix
- Integration test suite for cross-package workflows

### Packages (47 total)

All packages released at `1.0.0`:

`core`, `cli`, `ai`, `agent`, `auth`, `cache`, `config`, `cron`, `worker`, `pubsub`, `distributed-lock`, `saga`, `observability`, `inspector`, `casl`, `realtime`, `feature-toggle`, `mcp`, `memory`, `flow`, `flow-runtime`, `prompts`, `i18n`, `typeorm`, `graphql`, `discovery`, `audit`, `oauth`, `kafka`, `gateway`, `guardrails`, `resilience`, `grpc`, `messaging`, `ops-agent`, `data`, `ml`, `rag`, `event-emitter`, `pdf-to-audio`, `prisma`, `queue`, `serverless`, `swagger`, `websocket`, `payment`, `eval`

### Changed

- Default npm dist-tag changed from `beta` to `latest`
- `bump-version.js` now updates `devDependencies` and `lerna.json`
- Dependabot configured for automated dependency updates
- Repository URLs normalized to `hazel-js/hazeljs`

---

## [0.9.0] - 2026-06-10

### Breaking Changes

- **`@hazeljs/ai`**: Removed deprecated `AIService` — use `AIEnhancedService`
- **`@hazeljs/agent`**: Removed `circuit-breaker` re-export — import from `@hazeljs/resilience`
- **`@hazeljs/swagger`**: Removed `AutoSwaggerOptions` alias — use `SwaggerBuildOptions`
- **`@hazeljs/rag`**: Removed `AgenticGraphSearchResult` — use `GraphSearchResult` from graph module
- **`@hazeljs/data`**: Removed `PipelineBuilder.create()` and `reset()` — use `new PipelineBuilder()`

See [MIGRATION.md](./MIGRATION.md) for upgrade instructions.

---

## [0.8.6] - 2026-05-01

### Changed

- Peer dependency alignment across all 47 packages
- Version tooling improvements

---

## [0.8.0] - 2026-04-15

### Added

- HCEL (HazelJS Composable Expression Language) orchestration
- `@hazeljs/ops-agent` for Jira/Slack operational agents
- `@hazeljs/pdf-to-audio` pipeline package
- Enhanced `@hazeljs/gateway` with metrics and routing

### Changed

- Expanded monorepo to 47 publishable packages
- Improved publish workflow with Lerna throttling

---

## [0.7.0] - 2026-03-28

### Added

- `@hazeljs/saga` distributed saga orchestration
- `@hazeljs/distributed-lock` for cross-service locking
- `@hazeljs/discovery` service registry
- `@hazeljs/gateway` API gateway package

---

## [0.4.0] - 2026-03-15

### Added

- Distributed sagas with compensation
- Distributed locking (Redis + in-memory)
- Auto-documentation generation improvements

---

## [0.3.0] - 2026-03-23

### Added

- **`@hazeljs/ml`**: Feature store, experiment tracking, drift detection
- **`@hazeljs/data`**: Pipeline builder, contract registry, telemetry
- Agentic RAG with reasoning chains
- Persistent memory with hybrid storage

See [RELEASE_NOTES_v0.3.0.md](../RELEASE_NOTES_v0.3.0.md) for full details.

---

## [0.2.0] - 2026-02-03

### Added

- Production security middleware (rate limit, CSRF, CORS, headers)
- Graceful shutdown and health check system
- 793+ tests across core packages
- npm publishing workflow

---

## [0.1.0] - 2025-12-01

### Added

- Initial public beta of `@hazeljs/core`, `@hazeljs/ai`, `@hazeljs/agent`, `@hazeljs/rag`
- CLI scaffolding tool
- Modular monorepo architecture
