# Competitive DX note (verified effort, not unverified claims)

This note compares **developer assembly effort** for a policy-governed, approval-gated, crash-recoverable operation — not a claim that NestJS “cannot” do these things.

## NestJS-style assembly (typical)

Building the same path usually means composing separate libraries yourself, for example:

1. Nest service/controller
2. Event emitter or message bus
3. Custom “agent” or rules service
4. AuthZ / policy package
5. Approval workflow (custom or workflow engine)
6. Durable workflow / saga / queue for crash recovery
7. Audit + OpenTelemetry wiring
8. Replay tooling (often custom)

Packages and integration surfaces multiply; security boundaries must be hand-enforced so an LLM or planner cannot bypass AuthZ.

## HazelJS AAR path

1. Ordinary `@Injectable()` service
2. `@Autonomous` + `@Observe` + `@Capability`
3. `AutonomousModule.forRoot`
4. Reuses Gatekeeper, HumanTask/approvals, DurableRunStore, timeline/CLI

One control plane coordinates existing Agent OS subsystems instead of introducing a second orchestration stack.

## What we do **not** claim

- That NestJS lacks policy, workflows, or HITL in absolute terms
- Numeric performance superiority without measured benchmarks
- Exactly-once execution for arbitrary external side effects

See `docs/architecture/autonomous-runtime/` and package tests for the implemented HazelJS path.
