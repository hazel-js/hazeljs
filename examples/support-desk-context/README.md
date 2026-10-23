# support-desk-context

**Context desk** — local Agent OS + multi-layer context + HITL refunds.

| Layer      | Demo prompt                                      |
| ---------- | ------------------------------------------------ |
| **CAG**    | "What is the refund policy for damaged goods?"   |
| **RAG**    | "How do I escalate a shipping delay?"            |
| **KAG**    | "Who owns ORD-2042 and what product is it?"      |
| **Memory** | `remember` contact_channel=email, then ask again |
| **HITL**   | "Refund ORD-2042" → `hazel approve`              |

| File         | Role                                                          |
| ------------ | ------------------------------------------------------------- |
| `agent.ts`   | Tools: assemble_context, remember, lookup_order, issue_refund |
| `context.ts` | `ContextService` planner + offline CAG/RAG/KAG/Memory ports   |
| `kb/`        | policy.md, faq.md, graph.json                                 |
| `agent.yaml` | DNA for `hazel apply`                                         |

```bash
npm install
npm run demo          # offline planner walkthrough (logs sources)
npm run demo:hitl     # in-process ContextService + HITL refund proof
hazel apply agent.yaml
hazel run support_desk_context "What is the refund policy for damaged goods?"
hazel run support_desk_context "refund order ORD-2042"
hazel approvals
```

Scaffold the same project anywhere:

```bash
hazel new agent my-desk --template=context
```

Deeper package labs (Meridian): `example:rag` · `example:cag` · `example:kag` · `example:context`

Guide: [Local Agent OS](https://hazeljs.ai/docs/guides/local-agent-os)
