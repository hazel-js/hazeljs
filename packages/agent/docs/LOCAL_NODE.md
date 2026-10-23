# Local Agent OS Node (`hazeld`)

HazelJS Agent OS is **local-first**. The kernel (`AgentOS` + `AgentRuntime` + durable HITL) already runs in-process. What `hazeld` adds is a **supervisor node** that keeps that kernel alive after the terminal closes.

## Quick path

```bash
npm i -g @hazeljs/cli
hazel new agent my-bot
cd my-bot && npm install
hazel apply agent.yaml   # loads ./agent.ts @Tool handlers into hazeld
hazel inspect my_bot
# close the terminal — hazeld keeps the agent Running
```

`hazel apply` registers DNA **and** loads `./agent.ts` (or `agent.js` / `src/agent.ts`) from `HAZEL_PROJECT_ROOT` / cwd. Re-apply after editing handlers. DNA-only projects still work (stub tools until you add `agent.ts`).

## Architecture

| Layer | Package / type | Role |
| --- | --- | --- |
| CLI | `@hazeljs/cli` (`hazel`, `hazeld`) | Apply / inspect / approvals over a Unix socket |
| Control API | `LocalControlApi` | JSON request/response on `~/.hazel/hazeld.sock` |
| Node seam | `HazelNode` / `LocalNode` | Portable host interface |
| Kernel | `AgentOS` | Deploy, start, pause, recover, approve; loads project `agent.ts` |
| Platform | `LocalDeploymentBackend` (hosted) | `ready` = DNA registered in AgentOS |
| Durability | `DurableRunStore` + `DurableJobStore` | Runs, HITL, cron jobs under `~/.hazel` / `.hazel/` |
| Governance | Gatekeeper + `HumanTaskService` | Default local approvals (no Redis) |
| Secrets | `EncryptedFileSecretStore` | `hazel secret set` — values never printed |
| Reboot | `HostServiceManager` | launchd / systemd user / Windows task |

```
CLI ──unix socket──► LocalControlApi ──► LocalNode ──► AgentOS ──► AgentRuntime
                                              │
                                              ├── FileResourceRepository
                                              ├── DurableRunStore
                                              └── Gatekeeper (optional peer)
```

## Portable DNA, local node only (v1)

- DNA / `AgentDefinition` / `AgentDeployment` stay portable (`runtimeClassName: local` today; `kubernetes` already exists).
- `HazelNode` is the seam for future Remote / K8s / Cloud nodes.
- **v1 implements only `LocalNode`.** There is no `hazel node join`, remote scheduler, or cluster control plane.
- `hazel deploy --target` is reserved for a future product layer; **`hazel apply` is the product**.

## Production bar (single-user)

Stable for a laptop / workstation:

- `hazel doctor` fails closed when hazeld is unreachable
- HITL survives hazeld kill/restart; resume only via `approve` / `deny`
- Sleep / cron jobs re-arm from `DurableJobStore`
- Secrets: encrypted file (or keytar); DNA `{ secret: "REF" }` resolves only in-daemon
- Platform reconcile tick inside hazeld

Not in scope: multi-tenant socket auth, process isolation, Cloud/K8s required.

## Phases shipped in this tree

1. **Foundation** — `LocalNode`, `hazeld`, socket control API, `ensureDaemon`, CLI aliases, minimal `local` template
2. **Durability** — boot `recover` + conservative continue worker, durable jobs, host service install helpers
3. **Governance** — default local Gatekeeper (HumanTask), `hazel approvals|approve|deny`, secret store
4. **DX** — `logs` / `runs` / `doctor` / `ui`, five-minute guide
5. **Autonomy** — DNA `schedule.cron` → durable jobs, triggers contract, `maxConcurrentRuns`, display status map
6. **Distributed seam** — documented only (this file); no cluster implementation

## Out of scope for v1

Docker/K8s required, Hazel Cloud signup, Postgres/Redis required, copying Kubernetes APIs, treating Agent VM as a hypervisor, auto-destructive `doctor --repair`, public unauthenticated TCP control plane.
