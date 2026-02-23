# @hazeljs/ml

Machine Learning & Model Management for HazelJS - training, prediction, model registry, and metrics.

[![npm version](https://img.shields.io/npm/v/@hazeljs/ml.svg)](https://www.npmjs.com/package/@hazeljs/ml)
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
  { name: 'normalize', fn: (d: { text: string }) => ({ ...d, text: d.text.toLowerCase() }) },
  { name: 'filter', fn: (d: { text: string }) => d.text.length > 0 },
];
const processed = await pipeline.run(data, steps);
await model.train(processed);
```

## Batch predictions

```typescript
import { BatchService } from '@hazeljs/ml';

const batchService = new BatchService(predictorService);
const results = await batchService.predictBatch('sentiment-classifier', items, {
  batchSize: 32,
});
```

## Metrics and evaluation

```typescript
import { MetricsService } from '@hazeljs/ml';

const metricsService = new MetricsService();
const evaluation = await metricsService.evaluate(modelName, testData, {
  metrics: ['accuracy', 'f1', 'precision', 'recall'],
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

## Example

See [hazeljs-ml-starter](../../../hazeljs-ml-starter) for a full example with sentiment, spam, intent classifiers, REST API, training pipeline, and metrics.

## Links

- [Documentation](https://hazeljs.com/docs/packages/ml)
- [GitHub](https://github.com/hazel-js/hazeljs)
- [Issues](https://github.com/hazeljs/hazel-js/issues)
- [Homepage](https://hazeljs.com)
