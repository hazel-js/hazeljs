import 'reflect-metadata';
import { SagaOptions, SagaStepOptions } from './interfaces';
import { SagaOrchestrator } from './orchestrator';

/**
 * Decorator to mark a class as a Saga.
 */
export function Saga(options: SagaOptions) {
  return function (constructor: new (...args: unknown[]) => unknown): void {
    const orchestrator = SagaOrchestrator.getInstance();

    // Check if steps were already defined via prototype/member decorators
    const steps: { propertyKey: string; options: SagaStepOptions }[] =
      Reflect.getMetadata('hazeljs:saga:steps', constructor.prototype) || [];

    orchestrator.registerSaga(options.name, constructor);

    // Register all steps captured
    for (const step of steps) {
      orchestrator.registerStep(options.name, step.propertyKey, step.options);
    }
  };
}

/**
 * Decorator to mark a method as a Saga step.
 */
export function SagaStep(options: SagaStepOptions = {}) {
  return function (target: object, propertyKey: string, _descriptor: PropertyDescriptor): void {
    // Collect step metadata on the prototype to be retrieved by @Saga later
    const steps =
      (Reflect.getMetadata('hazeljs:saga:steps', target) as {
        propertyKey: string;
        options: SagaStepOptions;
      }[]) || [];
    steps.push({ propertyKey, options });
    Reflect.defineMetadata('hazeljs:saga:steps', steps, target);
  };
}
