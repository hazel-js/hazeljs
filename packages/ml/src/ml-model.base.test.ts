import { registerMLModel } from './ml-model.base';
import { ModelRegistry } from './registry/model.registry';
import { TrainerService } from './training/trainer.service';
import { PredictorService } from './inference/predictor.service';
import { Model, Train, Predict } from './decorators';

@Model({ name: 'register-test', version: '1.0.0', framework: 'tensorflow' })
class RegisterTestModel {
  @Train()
  train() {}

  @Predict()
  predict() {}
}

describe('registerMLModel', () => {
  it('registers model with registry', () => {
    const registry = new ModelRegistry();
    const trainer = new TrainerService(registry);
    const predictor = new PredictorService(registry);
    const instance = new RegisterTestModel();

    registerMLModel(instance, registry, trainer, predictor);

    const registered = registry.get('register-test', '1.0.0');
    expect(registered).toBeDefined();
    expect(registered?.trainMethod).toBe('train');
    expect(registered?.predictMethod).toBe('predict');
  });

  it('does nothing for class without @Model', () => {
    const registry = new ModelRegistry();
    const trainer = new TrainerService(registry);
    const predictor = new PredictorService(registry);

    class PlainClass {}
    registerMLModel(new PlainClass(), registry, trainer, predictor);

    expect(registry.list()).toHaveLength(0);
  });
});
