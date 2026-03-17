# ML Package – Decorators Example

This folder demonstrates the **ML decorators** from `@hazeljs/ml`: `@Model`, `@Train`, and `@Predict`.

## Run the example

From the `example` directory (with `@hazeljs/ml` and `@hazeljs/core` installed):

```bash
npm run ml:decorators
# or
npx ts-node src/ml/ml-decorators.example.ts
```

## The three decorators

### 1. `@Model` (on the class)

- **Purpose:** Declares the class as an ML model and attaches registry metadata.
- **Required:** `name`, `version`, `framework` (`'tensorflow'` | `'onnx'` | `'custom'`).
- **Optional:** `description`, `tags`.
- **Rule:** One `@Model` per model class. Use `@Injectable()` from `@hazeljs/core` so the app can create instances.

```typescript
@Model({
  name: 'demo-classifier',
  version: '1.0.0',
  framework: 'custom',
  description: 'Minimal demo',
  tags: ['demo'],
})
class DemoClassifier { ... }
```

### 2. `@Train` (on one method)

- **Purpose:** Marks the method that trains the model. `TrainerService.train(modelName, data)` will call it.
- **Optional:** `pipeline` (name of a registered pipeline), `batchSize`, `epochs` (hints; your logic can ignore them).
- **Rule:** Exactly one `@Train()` method per model. It receives training data and can return `TrainingResult` (e.g. `accuracy`, `loss`).

```typescript
@Train({ pipeline: 'default', epochs: 1 })
async train(data: TrainingData): Promise<TrainingResult> {
  // Your training logic
  return { accuracy: 0.95, loss: 0.05 };
}
```

### 3. `@Predict` (on one method)

- **Purpose:** Marks the method that runs inference. `PredictorService.predict(modelName, input)` will call it.
- **Optional:** `batch` (hint that the method supports batch input), `endpoint` (hint for route naming).
- **Rule:** Exactly one `@Predict()` method per model. It receives one input and returns a prediction object.

```typescript
@Predict({ batch: true })
async predict(input: { text: string }): Promise<{ label: string; confidence: number }> {
  // Your inference logic
  return { label: 'positive', confidence: 0.92 };
}
```

## How discovery works

When you pass model **classes** to `MLModule.forRoot({ models: [DemoClassifier, ...] })`, the bootstrap:

1. Instantiates each class (via the DI container).
2. Reads `@Model` metadata from the class.
3. Finds the single method with `@Train` and the single method with `@Predict`.
4. Registers the instance and those method names in the `ModelRegistry`.

Then:

- **TrainerService.train(modelName, data)** looks up the model and calls its `@Train` method.
- **PredictorService.predict(modelName, input)** looks up the model and calls its `@Predict` method.

No manual registration of method names is needed—the decorators are the source of truth.

## Full app example

For a complete app with REST API, pipelines, and metrics, see:

- **[hazeljs-ml-starter](https://github.com/hazel-js/hazeljs/tree/main/hazeljs-ml-starter)** – sentiment, spam, intent classifiers and training scripts.

## Docs

- [ML package README](../../../packages/ml/README.md) – API and decorator options.
- [hazeljs.ai/docs/packages/ml](https://hazeljs.ai/docs/packages/ml) – full documentation.
