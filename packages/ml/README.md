# @hazeljs/ml

Machine Learning & Model Management for HazelJS - training, prediction, model registry, built-in classical algorithms, metrics, feature store, experiments, and drift monitoring.

[![npm version](https://img.shields.io/npm/v/@hazeljs/ml.svg)](https://www.npmjs.com/package/@hazeljs/ml)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/ml)](https://www.npmjs.com/package/@hazeljs/ml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Features

- **Built-in algorithms** – TF-IDF, Naive Bayes, Logistic Regression, Isolation Forest, Cosine k-NN, Item-Item CF (pure TypeScript, zero ML deps)
- **Built-in models** – `@Model` wrappers ready for `MLModule.forRoot({ models: [...] })`
- **Model registry** – Register/discover models by name@version; optional JSON artifact persistence
- **Decorators** – `@Model`, `@Train`, `@Predict`, `@Experiment`
- **Training** – `TrainerService` runs named `PipelineService` pipelines from `@Train({ pipeline })` and auto-logs `@Experiment` runs
- **Inference** – `PredictorService` + `BatchService`
- **Metrics** – accuracy/P/R/F1, confusion matrix, MAE/MSE/RMSE/R², ROC-AUC, Brier
- **Feature store / experiments / drift** – wired into `MLModule` (PSI, KS, JSD, Wasserstein, chi², concept-shift helper)
- **Framework-agnostic** – bring your own TensorFlow.js / ONNX / Transformers.js model class; the package does not bundle those runtimes

## Installation

```bash
npm install @hazeljs/ml @hazeljs/core
# optional: validate/profile training data with @hazeljs/data
npm install @hazeljs/data
```

## Quick Start (built-in text classifier)

```typescript
import { HazelApp } from '@hazeljs/core';
import { MLModule, TextNaiveBayesModel, TrainerService, PredictorService } from '@hazeljs/ml';

const app = new HazelApp({
  imports: [
    MLModule.forRoot({
      models: [TextNaiveBayesModel],
      artifactDir: './models',
      experiments: { storage: 'memory' },
    }),
  ],
});

app.listen(3000);

// Train
await trainer.train('text-naive-bayes', {
  samples: [
    { text: 'great product', label: 'positive' },
    { text: 'terrible quality', label: 'negative' },
  ],
});

// Predict
const result = await predictor.predict('text-naive-bayes', { text: 'I love this' });
```

## Built-in models

| Model name                 | Class                         | Use case                          |
| -------------------------- | ----------------------------- | --------------------------------- |
| `text-naive-bayes`         | `TextNaiveBayesModel`         | Ticket/chat routing, spam, intent |
| `text-logistic-regression` | `TextLogisticRegressionModel` | Binary/multi-class text           |
| `isolation-forest`         | `IsolationForestModel`        | Fraud / outlier detection         |
| `cosine-knn`               | `CosineKnnModel`              | Similar tickets / k-NN            |
| `item-item-cf`             | `ItemItemCFModel`             | Recommendations                   |
| `entity-resolver`          | `EntityResolverModel`         | Duplicate customers / fuzzy match |
| `holt-winters`             | `HoltWintersModel`            | Demand / wait-time forecast       |
| `kmeans`                   | `KMeansModel`                 | Segmentation / clustering         |
| `decision-tree`            | `DecisionTreeModel`           | Interpretable tabular classify    |

Algorithms are also exported directly (`TfidfVectorizer`, `NaiveBayesClassifier`, `jaroWinkler`, `HoltWinters`, `KMeans`, `DecisionTreeClassifier`, …) for use without decorators.

## Training pipelines vs `@hazeljs/data`

`PipelineService` in `@hazeljs/ml` is **preprocess-only** (normalize/filter samples before train). For production ETL (connectors, quality, sinks), use `@hazeljs/data` `PipelineRunner` / `PipelineBuilder`, then pass cleaned samples to `TrainerService` via `prepareTrainingData()`.

## Training with @hazeljs/data

```typescript
import { Schema, QualityService } from '@hazeljs/data';
import { prepareTrainingData, TrainerService } from '@hazeljs/ml';

const SampleSchema = Schema.object({
  text: Schema.string().min(1),
  label: Schema.string().oneOf(['positive', 'negative']),
});

const prepared = await prepareTrainingData(
  { samples },
  { schema: SampleSchema, qualityService: new QualityService(), failOnQuality: true }
);
await trainer.train('text-naive-bayes', prepared.data);
```

## API summary

| Service               | Purpose                                     |
| --------------------- | ------------------------------------------- |
| `ModelRegistry`       | Register/lookup models; save/load artifacts |
| `TrainerService`      | Invoke `@Train` (+ pipeline + experiment)   |
| `PredictorService`    | Invoke `@Predict`                           |
| `PipelineService`     | Preprocess-only training pipelines          |
| `BatchService`        | Ordered concurrent batch prediction         |
| `MetricsService`      | Evaluation + metric history                 |
| `FeatureStoreService` | Online/offline feature retrieval            |
| `ExperimentService`   | Experiment/run/metric tracking              |
| `DriftService`        | Distribution drift detection                |
| `MonitorService`      | Periodic drift/accuracy alerts + webhooks   |

## Examples

- **[hazeljs-ml-starter](../../../hazeljs-ml-starter)** – Full app with classifiers and REST API
- **[example/src/ml](../../example/src/ml)** – Minimal decorator example

## Links

- [Documentation](https://hazeljs.ai/docs/packages/ml)
- [GitHub](https://github.com/hazel-js/hazeljs)
- [Issues](https://github.com/hazel-js/hazeljs/issues)
- [Homepage](https://hazeljs.ai)
