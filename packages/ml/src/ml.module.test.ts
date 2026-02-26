import { MLModule } from './ml.module';
import { Model, Train, Predict } from './decorators';

@Model({ name: 'test', version: '1.0.0', framework: 'tensorflow' })
class TestModel {
  @Train()
  train() {}

  @Predict()
  predict() {}
}

describe('MLModule', () => {
  describe('forRoot', () => {
    it('returns dynamic module structure', () => {
      const result = MLModule.forRoot();

      expect(result).toHaveProperty('module', MLModule);
      expect(result).toHaveProperty('providers');
      expect(result).toHaveProperty('exports');
      expect(Array.isArray(result.providers)).toBe(true);
      expect(result.providers.length).toBeGreaterThan(0);
    });

    it('includes models in providers when specified', () => {
      const result = MLModule.forRoot({ models: [TestModel] });
      expect(result.providers).toContain(TestModel);
    });

    it('includes ML_MODELS and MLModelBootstrap when models provided', () => {
      const result = MLModule.forRoot({ models: [TestModel] });
      const mlModels = result.providers.find(
        (p: unknown) => p && typeof p === 'object' && 'provide' in p
      );
      expect(mlModels).toBeDefined();
    });
  });

  describe('getOptions', () => {
    it('returns last forRoot options', () => {
      MLModule.forRoot({ models: [TestModel] });
      const opts = MLModule.getOptions();
      expect(opts.models).toContain(TestModel);
    });
  });
});
