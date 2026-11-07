# Threat model and failure behavior

**Use any harness; enforce one execution policy.**

## Enforcement boundary

| Layer           | Enforces                                                                                             |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| Decision Plane  | Answer-id membership; abstain / timeout / unavailable / invalid unions                               |
| Gatekeeper      | Allow / deny / rewrite / require_approval from server-built caller context                           |
| Approvals       | Fingerprint (+ optional argument digest), expiry, single consume under lock                          |
| Governed memory | Tenant/actor/scope/`accepted` predicates before rank; CAS on version (`InMemoryGovernedMemoryStore`) |
| GovernedRuntime | Tool mediation required; hosted computer-use/shell rejected; run store is in-memory today            |

A model verdict may raise risk or force abstain. It cannot grant a capability the caller lacks. Tool arguments cannot set `tenantId`, `actorId`, or `runId`.

## Failure outcomes

| Situation                                   | Outcome                                                          |
| ------------------------------------------- | ---------------------------------------------------------------- |
| Plane provider timeout                      | `timed_out` (AbortSignal); ordered fallback cannot widen answers |
| Provider auth / invalid config              | No retry; `unavailable` or `invalid`                             |
| OpenAI Decisions / unconfigured Jev (plane) | `unavailable` with typed code                                    |
| Approval digest mismatch / reuse / expiry   | Deny; no dispatch                                                |
| Second replica loses consume lock           | Rejected                                                         |
| Dispatch timeout after ledger `dispatched`  | `unknown` until reconciliation — not cancelled or succeeded      |
| Dropped provider stream                     | `unknown`; cancel stays `requested` until adapter ack            |
| Privacy-hook error on capture               | Fail closed (reject) when `failClosed: true`                     |
| Cross-tenant memory retrieve                | Empty — filter is in the store predicate                         |

## Observable-only risks

Remote side effects after a dropped stream, backups after forget, provider-hosted clicks/shell, and provider self-reported confidence are outside Hazel's control plane. Document them to operators; do not claim they are mediated.

## Non-claims

No HIPAA/GDPR certification, no complete computer-use mediation, no universal exactly-once, no competitor-equivalent savings figures.
