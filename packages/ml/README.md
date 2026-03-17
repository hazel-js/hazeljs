# @hazeljs/ml

Machine Learning & Model Management for HazelJS - training, prediction, model registry, and metrics.

[![npm version](https://img.shields.io/npm/v/@hazeljs/ml.svg)](https://www.npmjs.com/package/@hazeljs/ml)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/ml)](https://www.npmjs.com/package/@hazeljs/ml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Features

- **Model registry** – Register and discover models by name and version
- **Decorators** – `@Model`, `@Train`, `@Predict` for declarative ML APIs
- **Training pipeline** – PipelineService for data preprocessing (normalize, filter)
- **Inference** – PredictorService for single and batch predictions
- **Metrics** – MetricsService for evaluation, A/B testing, and monitoring
- **Framework-agnostic** – Works with TensorFlow.js, ONNX, Transformers.js, or custom backends

## Installation

```bash
npm install @hazeljs/ml @hazeljs/core
```

### Peer dependencies (optional, per use case)

```bash
# TensorFlow.js
npm install @tensorflow/tfjs-node

# ONNX Runtime
npm install onnxruntime-node

# Hugging Face Transformers (embeddings, sentiment)
npm install @huggingface/transformers
```

## Quick Start

### 1. Import MLModule

```typescript
import { HazelApp } from '@hazeljs/core';
import { MLModule } from '@hazeljs/ml';

const app = new HazelApp({
  imports: [
    MLModule.forRoot({
      models: [SentimentClassifier, SpamClassifier],
    }),
  ],
});

app.listen(3000);
```

### 2. Define a model with decorators

```typescript
import { Injectable } from '@hazeljs/core';
import { Model, Train, Predict, ModelRegistry } from '@hazeljs/ml';

@Model({ name: 'sentiment-classifier', version: '1.0.0', framework: 'custom' })
@Injectable()
export class SentimentClassifier {
  private labels = ['positive', 'negative', 'neutral'];
  private weights: Record<string, number[]> = {};

  constructor(private registry: ModelRegistry) {}

  @Train()
  async train(data: { text: string; label: string }[]): Promise<void> {
    // Your training logic – e.g. bag-of-words, embeddings, etc.
    const vocab = this.buildVocabulary(data);
    this.weights = this.computeWeights(data, vocab);
  }

  @Predict()
  async predict(input: { text: string }): Promise<{ sentiment: string; confidence: number }> {
    const scores = this.score(input.text);
    const idx = scores.indexOf(Math.max(...scores));
    return {
      sentiment: this.labels[idx],
      confidence: scores[idx],
    };
  }
}
```

### 3. Predict from a controller or service

```typescript
import { Controller, Post, Body, Inject } from '@hazeljs/core';
import { PredictorService } from '@hazeljs/ml';

@Controller('ml')
export class MLController {
  constructor(private predictor: PredictorService) {}

  @Post('predict')
  async predict(@Body() body: { text: string; model?: string }) {
    const result = await this.predictor.predict(
      body.model ?? 'sentiment-classifier',
      body
    );
    return { result };
  }
}
```

## ML Decorators

The package uses three decorators to declare ML models and their behaviour. The registry and services discover them via reflection—no manual wiring needed.

### `@Model` (class)

Marks a class as an ML model and attaches **registry metadata**. Required so the model can be registered and looked up by name/version.

| Property      | Type     | Required | Description |
|---------------|----------|----------|-------------|
| `name`        | string   | Yes      | Unique model id (e.g. `'sentiment-classifier'`). |
| `version`     | string   | Yes      | Semver (e.g. `'1.0.0'`). |
| `framework`   | string   | Yes      | `'tensorflow'` \| `'onnx'` \| `'custom'`. |
| `description` | string   | No       | Human-readable description. |
| `tags`        | string[] | No       | Tags for filtering (default: `[]`). |

**Example:** One model per class; use `@Injectable()` so the app can construct it.

```typescript
@Model({
  name: 'spam-classifier',
  version: '1.0.0',
  framework: 'custom',
  description: 'Binary spam/ham classifier',
  tags: ['nlp', 'moderation'],
})
@Injectable()
export class SpamClassifier {
  // ...
}
```

---

### `@Train` (method)

Marks the **single method** that trains this model. `TrainerService.train(modelName, data)` will call it. Optional config is for documentation or pipeline wiring.

| Option      | Type   | Default   | Description |
|-------------|--------|-----------|-------------|
| `pipeline`  | string | `'default'` | Name of a registered `PipelineService` pipeline to run before training. |
| `batchSize` | number | `32`     | Hint for batching (your logic can ignore it). |
| `epochs`    | number | `10`     | Hint for epochs (your logic can ignore it). |

**Example:** Exactly one `@Train()` method per model; it receives training data and can return metrics.

```typescript
@Train({ pipeline: 'sentiment-preprocessing', epochs: 5 })
async train(data: { samples: Array<{ text: string; label: string }> }): Promise<TrainingResult> {
  // Your training logic
  return { accuracy: 0.95, loss: 0.05 };
}
```

---

### `@Predict` (method)

Marks the **single method** that runs inference. `PredictorService.predict(modelName, input)` will call it.

| Option    | Type    | Default    | Description |
|-----------|---------|------------|-------------|
| `batch`   | boolean | `false`    | Hint that the method supports batch input (semantic only). |
| `endpoint`| string  | `'/predict'` | Hint for route naming (semantic only). |

**Example:** Exactly one `@Predict()` method per model; it receives one input and returns a prediction object.

```typescript
@Predict({ batch: true, endpoint: '/predict' })
async predict(input: { text: string }): Promise<{ label: string; confidence: number }> {
  // Your inference logic
  return { label: 'ham', confidence: 0.92 };
}
```

---

### Rules

- **One model class** = one `@Model`, one `@Train` method, one `@Predict` method.
- **Order:** Put `@Model` on the class, then `@Train` and `@Predict` on the methods. Use `@Injectable()` from `@hazeljs/core` so the app can instantiate the model.
- **Discovery:** When you pass model classes to `MLModule.forRoot({ models: [...] })`, the bootstrap finds the `@Train` and `@Predict` methods and registers them with the registry.

## Model registration

Models are registered when passed to `MLModule.forRoot({ models: [...] })`. The bootstrap discovers `@Train` and `@Predict` methods via reflection.

### Manual registration

```typescript
import { registerMLModel, ModelRegistry, TrainerService, PredictorService } from '@hazeljs/ml';

// When injecting ModelRegistry in a custom service:
registerMLModel(
  sentimentInstance,
  modelRegistry,
  trainerService,
  predictorService
);
```

## Training pipeline

Preprocess data before training with `PipelineService`:

```typescript
import { PipelineService } from '@hazeljs/ml';

const pipeline = new PipelineService();
const steps = [
  { name: 'normalize', transform: (d: unknown) => ({ ...(d as object), text: (d as { text: string }).text?.toLowerCase() }) },
  { name: 'filter', transform: (d: unknown) => (d as { text: string }).text?.length > 0 ? d : null },
];
// Inline steps (no registration required)
const processed = await pipeline.run(data, steps);
await model.train(processed);

// Or register a named pipeline
pipeline.registerPipeline('default', steps);
const processed2 = await pipeline.run('default', data);
```

## Batch predictions

```typescript
import { BatchService } from '@hazeljs/ml';

const batchService = new BatchService(predictorService);
const results = await batchService.predictBatch('sentiment-classifier', items, {
  batchSize: 32,
  concurrency: 4,
});
// Results are returned in the same order as inputs
```

## Metrics and evaluation

```typescript
import { MetricsService } from '@hazeljs/ml';

// Evaluate model on test data (inject MetricsService via MLModule - it receives PredictorService)
@Injectable()
class EvaluationService {
  constructor(private metricsService: MetricsService) {}

  async runEvaluation() {
    const testData = [
      { text: 'great product', label: 'positive' },
      { text: 'terrible', label: 'negative' },
    ];
    const evaluation = await this.metricsService.evaluate('sentiment-classifier', testData, {
      metrics: ['accuracy', 'f1', 'precision', 'recall'],
      labelKey: 'label',           // key in test sample for ground truth
      predictionKey: 'sentiment',   // key in prediction result (auto-detect: label, sentiment, class)
    });
    // evaluation.metrics: { accuracy, precision, recall, f1Score }
    // Result is automatically recorded via recordEvaluation()
  }
}

// Manual recording
metricsService.recordEvaluation({
  modelName: 'my-model',
  version: '1.0.0',
  metrics: { accuracy: 0.95, loss: 0.05 },
  evaluatedAt: new Date(),
});
```

## API summary

| Service | Purpose |
|---------|---------|
| `ModelRegistry` | Register and lookup models by name/version |
| `TrainerService` | Discover and invoke `@Train` methods |
| `PredictorService` | Discover and invoke `@Predict` methods |
| `PipelineService` | Data preprocessing pipeline |
| `BatchService` | Batch prediction with configurable batch size |
| `MetricsService` | Model evaluation and metrics tracking |

## Examples

- **[hazeljs-ml-starter](../../../hazeljs-ml-starter)** – Full app: sentiment, spam, intent classifiers, REST API, training pipeline, and metrics.
- **[example/src/ml](../../example/src/ml)** – Minimal runnable example of the three decorators (`npm run ml:decorators` from the example repo).

## Links

- [Documentation](https://hazeljs.ai/docs/packages/ml)
- [GitHub](https://github.com/hazel-js/hazeljs)
- [Issues](https://github.com/hazel-js/hazeljs/issues)
- [Homepage](https://hazeljs.ai)
