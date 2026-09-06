# Organism Runtime Architecture

## Philosophy

> Developers deploy a goal, not an agent topology.

`@hazeljs/organism` is a **control plane** on top of `@hazeljs/agent` (ADR-001). It does not replace `AgentRuntime`, tool execution, durable runs, or gatekeeper.

## Runtime architecture

```mermaid
flowchart TD
    ENV[Environment] --> P[PerceptionEngine]
    P --> N[NeedDetector]
    N --> D[DecisionEngine]
    D --> Cap[CapabilityRegistry]
    D --> B[BirthEngine]
    D --> RA[ResourceAllocator]
    B --> A[RuntimeAgents]
    A --> RT[AgentRuntime_Tools_MCP]
    A --> O[OutcomeReporting]
    O --> U[UtilityEngine]
    U --> REP[ReputationEngine]
    REP --> S[SurvivalEngine]
    S --> X[Terminate_or_Continue]
    C[Constitution] --> D
    C --> GK[PolicyEngine_Gatekeeper]
    M[Mission] --> D
    M --> U
```

## Agent lifecycle

```mermaid
stateDiagram-v2
    [*] --> Conceived
    Conceived --> Initializing
    Initializing --> Active
    Active --> Idle
    Idle --> Active
    Active --> Specializing
    Specializing --> Active
    Active --> Suspended
    Suspended --> Active
    Active --> TerminationPending
    Idle --> TerminationPending
    TerminationPending --> Terminated
    Active --> Failed
    Terminated --> [*]
    Failed --> [*]
```

## Evolution (Phase 3 preview)

```mermaid
flowchart LR
    G1[Gene] --> A1[Agent_v1]
    G1 --> A2[Agent_v2]
    G1 --> A3[Agent_v3]
    A1 --> E[Evaluation]
    A2 --> E
    A3 --> E
    E --> W[WinningStrategy]
    W --> M[ControlledMutation]
    M --> B1[NextGeneration]
    M --> B2[NextGeneration]
```

## Package boundary

```
@hazeljs/organism → @hazeljs/agent → @hazeljs/core
                 ↘ optional: agent-gatekeeper, observability
```

## LLM boundary

Deterministic code handles: resource accounting, permissions, reputation math, lifecycle state, policy enforcement, spawn/reproduction limits, genealogy, mutation audits, generation scoring, event persistence.

Models (optional, later) may interpret ambiguous signals or propose specializations. Phase 1–3 need detection, spawn, reproduction, mutation, and generation evaluation are fully deterministic.

## Phase 2–4 additions

- **Reproduction:** `ReproductionEngine` + `GenealogyManager` — parent→child with inheritance policy, permission subset rules, resource transfer, depth/child limits
- **Evolution:** `MutationEngine` + `EvolutionEngine` + `GenerationManager` — constrained config mutation, population scoring, strategy promotion
- **Economy:** `UtilityForecaster` + `MarketEngine` — opportunity cost, sealed-bid clearing, peer negotiation
