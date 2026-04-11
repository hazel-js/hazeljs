# @hazeljs/eval

Evaluation toolkit for HazelJS AI applications: golden datasets, classical IR metrics (precision/recall@k, MRR, NDCG), RAG-style heuristics, agent trajectory scoring, LLM-as-judge helpers, and CI-friendly reporting.

[![npm version](https://img.shields.io/npm/v/@hazeljs/eval.svg)](https://www.npmjs.com/package/@hazeljs/eval)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Installation

```bash
npm install @hazeljs/eval
```

Peer dependency:

```bash
npm install @hazeljs/core
```

## Features

- **Golden datasets** — JSON format with cases (input, optional expected output, tool calls, retrieved IDs)
- **Retrieval metrics** — `precisionAtK`, `recallAtK`, `meanReciprocalRank`, `ndcgAtK`
- **RAG helpers** — `evaluateRetrieval`, `answerContextOverlap` (lightweight faithfulness proxy)
- **Agent trajectories** — `trajectoryScore`, `toolCallAccuracy`
- **LLM judge** — `parseJudgeScore`, `buildRelevanceJudgePrompt`, `buildFaithfulnessJudgePrompt` (wire to your model)
- **Runner** — `runGoldenDataset` with configurable concurrency and thresholds
- **CI** — `reportEvalForCi` with optional non-zero exit via `process.exitCode`

## Quick start

### Load a dataset and run evals

```typescript
import { loadGoldenDatasetFromJson, runGoldenDataset, reportEvalForCi } from '@hazeljs/eval';

const dataset = loadGoldenDatasetFromJson('./eval/golden.json');

const result = await runGoldenDataset(
  dataset,
  async ({ input }) => {
    // Call your RAG, agent, or HazelAI pipeline here
    return {
      output: await myPipeline.answer(input),
      toolCalls: ['search', 'summarize'],
      retrievedIds: ['doc-1', 'doc-2'],
    };
  },
  { concurrency: 2, minAverageScore: 0.75 }
);

reportEvalForCi(result, { exitOnFail: true });
```

### Retrieval metrics only

```typescript
import { evaluateRetrieval } from '@hazeljs/eval';

const metrics = evaluateRetrieval({
  query: 'What is HazelJS?',
  retrievedIds: ['a', 'b', 'c'],
  relevantIds: ['a', 'x'],
  k: 5,
});
// metrics.precisionAtK, recallAtK, mrr, ndcgAtK
```

### Golden dataset JSON shape

```json
{
  "name": "support-bot",
  "version": "1.0.0",
  "cases": [
    {
      "id": "refund-1",
      "input": "How do I get a refund?",
      "expectedOutput": "within 30 days",
      "expectedToolCalls": ["lookup_policy"],
      "expectedRetrievedIds": ["policy-refunds"]
    }
  ]
}
```

## Real-life example: regression-test a support FAQ (RAG + CI)

You ship a **customer support** app backed by **HazelAI** and **@hazeljs/rag**. Before each release, you run the same golden questions and fail the pipeline if quality drops. (Install `@hazeljs/ai` and `@hazeljs/rag` alongside `@hazeljs/eval` for this flow.)

**1. Check in a golden dataset** — e.g. `eval/golden.support.json`:

```json
{
  "name": "support-faq",
  "version": "2025.04",
  "cases": [
    {
      "id": "billing-cycle",
      "input": "When am I charged each month?",
      "expectedOutput": "first of the month"
    },
    {
      "id": "api-rate-limit",
      "input": "What happens if I exceed the API rate limit?",
      "expectedOutput": "429"
    }
  ]
}
```

**2. Add a small eval script** (run with `npx tsx scripts/run-support-eval.ts` or compile into your CLI):

```typescript
import * as path from 'path';
import { HazelAI } from '@hazeljs/ai';
import { loadGoldenDatasetFromJson, runGoldenDataset, reportEvalForCi } from '@hazeljs/eval';

async function main() {
  const datasetPath = path.join(process.cwd(), 'eval/golden.support.json');
  const dataset = loadGoldenDatasetFromJson(datasetPath);

  const ai = HazelAI.create({
    defaultProvider: 'openai',
    persistence: {
      rag: {
        vectorStore: 'qdrant',
        connectionString: process.env.QDRANT_URL ?? 'http://127.0.0.1:6333',
        indexName: 'support-docs',
      },
    },
  });

  const result = await runGoldenDataset(
    dataset,
    async ({ input }) => {
      const rag = await ai.rag.ask(input, { topK: 8 });
      const retrievedIds = rag.sources.map((s) => s.id);
      return {
        output: rag.answer,
        retrievedIds,
      };
    },
    { concurrency: 1, minAverageScore: 0.7 }
  );

  reportEvalForCi(result, { exitOnFail: process.env.CI === 'true' });
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
```

**3. Wire CI** — in GitHub Actions (or similar), after indexes are built and env vars (`OPENAI_API_KEY`, `QDRANT_URL`, …) are set:

```yaml
- name: Run support golden evals
  run: npx tsx scripts/run-support-eval.ts
  env:
    CI: true
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
    QDRANT_URL: ${{ secrets.QDRANT_URL }}
```

If any case scores below `minAverageScore` or the run errors, `reportEvalForCi` sets `process.exitCode = 1` and the job fails, blocking a bad deploy. Adjust the runner to return `toolCalls` too if you evaluate an **agent** (e.g. `ai.agent('support', input)`) instead of plain RAG.

## Scripts

| Command           | Description                                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run build`   | Compile TypeScript to `dist/`                                                                                                                           |
| `npm test`        | Jest with coverage thresholds (85%+ statements/lines/functions/branches on implementation files; `src/index.ts` is excluded as a pure re-export barrel) |
| `npm run test:ci` | Jest with coverage reports; thresholds can be relaxed via `--no-coverage-threshold` when needed                                                         |

## License

Apache-2.0

## Links

- [HazelJS documentation](https://hazeljs.ai)
- [Monorepo source](https://github.com/hazel-js/hazeljs) — `packages/eval`
