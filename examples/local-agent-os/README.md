# Local Agent OS example

Single-user **local-first** HazelJS Agent OS: agents run under `hazeld`, survive terminal close, and recover HITL approvals after a crash.

## Quick path (CLI)

```bash
# from monorepo: build packages first
cd ../../packages/agent && npm run build
cd ../cli && npm run build

cd ../../examples/local-agent-os
npm install
npx hazel apply agent.yaml
npx hazel inspect support_desk
npx hazel doctor
```

Close the terminal, open a new one — `hazel inspect support_desk` should still show **Running**.

## Refund + approve flow

With a real LLM / skill handlers wired in your app:

```bash
hazel run support_desk "Please refund order ord_42"
hazel approvals
hazel approve <taskId>
```

## Crash-safe HITL (automated)

In-process demo (no global install):

```bash
npm run demo
```

This: apply → refund HITL → kill hazeld → restart → approve → complete.

## Production local checklist

1. `hazel doctor` — must be green (daemon reachable)
2. `hazel secret set NAME value` — values never echoed; DNA `env: { X: { secret: NAME } }` resolves only inside hazeld
3. Optional reboot persistence: `HostServiceManager` installing `hazeld` (launchd / systemd user)
4. Prefer `hazel apply` over foreground `hazel dev` for anything that must survive logout

## Files

| File | Role |
| --- | --- |
| `agent.yaml` | DNA + deployment |
| `agent.ts` | Optional skill handlers |
| `scripts/demo.ts` | Recover / approve proof (`npm run demo`) |

## Want CAG + RAG + KAG + Memory?

See [`../support-desk-context`](../support-desk-context) (`hazel new agent … --template=context`).
