import 'reflect-metadata';
import { EventScalingRegistry } from '../events/event-scaling-registry';
import { PredictiveScaler, createPredictiveScaler } from '../scaling/predictive-scaler';
import { PredictiveScalingOptions, ScaleOnEventOptions, ScalePredictOptions } from '../types';

const MODULE_SCALER_KEY = Symbol('hazeljs:predictive-scaling:scaler');
const MODULE_OPTIONS_KEY = Symbol('hazeljs:predictive-scaling:module');
const SCALE_PREDICT_KEY = Symbol('hazeljs:predictive-scaling:scale-predict');

const globalRegistry = new Map<string, PredictiveScaler>();

type ClassTarget = { name: string };

/**
 * Module-level predictive scaling configuration.
 */
export function PredictiveScaling(options: PredictiveScalingOptions): ClassDecorator {
  return function (constructor: ClassTarget) {
    const scope = constructor.name;
    const scaler = createPredictiveScaler(options);
    globalRegistry.set(scope, scaler);
    Reflect.defineMetadata(MODULE_SCALER_KEY, scaler, constructor);
    Reflect.defineMetadata(MODULE_OPTIONS_KEY, options, constructor);
  };
}

export function getPredictiveScaler(constructor: object): PredictiveScaler | undefined {
  const named = constructor as ClassTarget;
  return Reflect.getMetadata(MODULE_SCALER_KEY, constructor) ?? globalRegistry.get(named.name);
}

/**
 * Method-level hook to record demand signals for forecasting.
 */
export function ScalePredict(options: ScalePredictOptions = {}): MethodDecorator {
  return function (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const name = options.name ?? `${target.constructor.name}.${String(propertyKey)}`;

    const predictions =
      (Reflect.getMetadata(SCALE_PREDICT_KEY, target.constructor) as ScalePredictOptions[]) ?? [];
    predictions.push({ ...options, name });
    Reflect.defineMetadata(SCALE_PREDICT_KEY, predictions, target.constructor);

    descriptor.value = async function (...args: unknown[]): Promise<unknown> {
      const scaler = globalRegistry.get(target.constructor.name);
      const started = Date.now();

      try {
        const result = await originalMethod.apply(this, args);
        if (scaler) {
          scaler.recordMetric('requests', 1);
          const duration = Date.now() - started;
          scaler.recordMetric('latency', duration);
        }
        return result;
      } catch (error) {
        if (scaler) {
          scaler.recordMetric('requests', 1);
        }
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Register event-driven scaling triggers on a service class.
 */
export function ScaleOnEvent(options: ScaleOnEventOptions): ClassDecorator {
  return function (constructor: ClassTarget) {
    EventScalingRegistry.register(constructor.name, options);
  };
}

export function startPredictiveScaling(constructor: object): void {
  getPredictiveScaler(constructor)?.start();
}

export function stopPredictiveScaling(constructor: object): void {
  getPredictiveScaler(constructor)?.stop();
}

export async function emitScalingEvent(constructor: object, eventName: string): Promise<void> {
  const scaler = getPredictiveScaler(constructor);
  if (scaler) {
    await scaler.triggerEvent(eventName);
  }
}
