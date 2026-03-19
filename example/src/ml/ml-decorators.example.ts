/**
 * ML Decorators Example
 *
 * Demonstrates @Model, @Train, and @Predict from @hazeljs/ml.
 * Run: npm run ml:decorators (or ts-node src/ml/ml-decorators.example.ts)
 *
 * See src/ml/README.md for a full explanation of the decorators.
 */
import {
  Model,
  Train,
  Predict,
  ModelRegistry,
  TrainerService,
  PredictorService,
  registerMLModel,
  type TrainingData,
  type TrainingResult,
} from '@hazeljs/ml';

// --- 1. Define a model with the three decorators ---

@Model({
  name: 'demo-classifier',
  version: '1.0.0',
  framework: 'custom',
  description: 'Minimal demo model for ML decorators',
  tags: ['demo', 'example'],
})
class DemoClassifier {
  private labels: string[] = [];
  private weights: Map<string, number> = new Map();

  @Train({ pipeline: 'default', epochs: 1, batchSize: 8 })
  async train(data: TrainingData): Promise<TrainingResult> {
    const samples = (data as { samples?: Array<{ text: string; label: string }> }).samples ?? [];
    this.labels = [...new Set(samples.map((s) => s.label))];
    for (const { text, label } of samples) {
      const key = `${label}:${text.toLowerCase().slice(0, 20)}`;
      this.weights.set(key, (this.weights.get(key) ?? 0) + 1);
    }
    const correct = samples.filter((s) => this.predictInternal(s.text) === s.label).length;
    const accuracy = samples.length ? correct / samples.length : 0;
    return { accuracy, loss: 1 - accuracy };
  }

  @Predict({ batch: true, endpoint: '/predict' })
  async predict(input: unknown): Promise<{ label: string; confidence: number }> {
    const text = typeof input === 'object' && input !== null && 'text' in input
      ? String((input as { text: string }).text)
      : String(input);
    const label = this.predictInternal(text);
    return { label, confidence: 0.9 };
  }

  private predictInternal(text: string): string {
    if (this.labels.length === 0) return 'unknown';
    const lower = text.toLowerCase().slice(0, 20);
    let best = this.labels[0];
    let bestScore = 0;
    for (const label of this.labels) {
      const key = `${label}:${lower}`;
      const score = this.weights.get(key) ?? 0;
      if (score > bestScore) {
        bestScore = score;
        best = label;
      }
    }
    return best;
  }
}

// --- 2. Register and use the model ---

async function main() {
  console.log('ML Decorators Example (@Model, @Train, @Predict)\n');

  const registry = new ModelRegistry();
  const trainer = new TrainerService(registry);
  const predictor = new PredictorService(registry);
  const modelInstance = new DemoClassifier();

  registerMLModel(modelInstance, registry, trainer, predictor);

  const trainingData: TrainingData = {
    samples: [
      { text: 'Hello world', label: 'greeting' },
      { text: 'Hi there', label: 'greeting' },
      { text: 'Goodbye', label: 'farewell' },
      { text: 'Bye bye', label: 'farewell' },
    ],
  };

  console.log('Training with 4 samples...');
  const result = await trainer.train('demo-classifier', trainingData);
  console.log('Train result:', result, '\n');

  console.log('Predicting...');
  const out1 = await predictor.predict('demo-classifier', { text: 'Hello' });
  const out2 = await predictor.predict('demo-classifier', { text: 'Goodbye' });
  console.log('predict("Hello")  ->', out1);
  console.log('predict("Goodbye") ->', out2);

  console.log('\nDone. See src/ml/README.md for decorator reference.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
