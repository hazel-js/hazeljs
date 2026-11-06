# Architecture and enforcement boundary

Positioning: **Use any harness; enforce one execution policy.**

## What Hazel enforces

- Finite decision answer membership
- Gatekeeper allow / deny / rewrite / require_approval
- Approval fingerprint (+ optional argument digest), expiry, single consume under lock
- Tenant filters before memory ranking
- Delegation attenuation (`issueDelegation`)
- Rejection of hosted computer-use / shell for governed adapters

## What a provider may enforce

Only its own output constraints. A model verdict may raise risk or abstain. It cannot grant a capability the caller lacks.

## Observable only

- Remote side effects after a dropped stream
- Backup copies after forget
- Provider-hosted clicks and shell
- Provider self-reported confidence

## Non-claims

This work does **not** claim HIPAA/GDPR compliance, complete computer-use mediation, universal exactly-once execution, or competitor-equivalent cost savings.

## Shipped vs roadmap

| Shipped                                             | Roadmap / unavailable                                                               |
| --------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Decision Plane (rules, structured, inject-only jev) | OpenAI Decisions API (undocumented)                                                 |
| Local governed runtime + Redis lock/ledger ports    | Governed SQL run store; live OpenAI Agents without opt-in                           |
| Governed memory + **in-memory** store               | Prisma/Postgres governed memory store adapter                                       |
| Redis Decision Plane cache port                     | Automatic product adoption into Zynli Flows                                         |
| Framework APIs only in HazelJS                      | Zynli product demo lives under `zynli/zynli-reference` (not published with HazelJS) |

## Threat boundaries

Authenticated caller → agent/subagent → Decision Plane → provider → Gatekeeper → approval → executor → governed memory. External harnesses enter at the Gatekeeper tool boundary with server-built identity.

## Related guides

- [Decision Plane quickstart](./decision-plane.md)
- [Governed runtime](./governed-runtime.md)
- [Governed memory](./governed-memory.md)
- [Provider capability matrix](./provider-capability-matrix.md)
- [Migration notes](./agent-os-migration.md)
- [Threat and failure behavior](./agent-os-threat-failure.md)
- [Benchmark limits](./decision-plane-benchmarks.md)
