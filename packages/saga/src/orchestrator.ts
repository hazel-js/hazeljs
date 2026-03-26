import { SagaContext, SagaStatus, SagaStepOptions } from './interfaces';

export interface RegisteredSaga {
  name: string;
  steps: RegisteredSagaStep[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  target: any;
}

export interface RegisteredSagaStep {
  name: string;
  methodName: string;
  options: SagaStepOptions;
  order: number;
}

export class SagaOrchestrator {
  private static instance: SagaOrchestrator;
  private readonly sagas = new Map<string, RegisteredSaga>();

  private constructor() {}

  static getInstance(): SagaOrchestrator {
    if (!SagaOrchestrator.instance) {
      SagaOrchestrator.instance = new SagaOrchestrator();
    }
    return SagaOrchestrator.instance;
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
  registerSaga(name: string, target: any): void {
    if (!this.sagas.has(name)) {
      this.sagas.set(name, { name, steps: [], target });
    }
  }

  registerStep(sagaName: string, methodName: string, options: SagaStepOptions): void {
    const saga = this.sagas.get(sagaName);
    if (!saga) {
      throw new Error(`Saga '${sagaName}' not found.`);
    }

    saga.steps.push({
      name: methodName,
      methodName,
      options,
      order: options.order ?? saga.steps.length,
    });

    // Sort by order
    saga.steps.sort((a, b) => a.order - b.order);
  }

  async start<T>(sagaName: string, initialData: T): Promise<SagaContext<T>> {
    const saga = this.sagas.get(sagaName);
    if (!saga) {
      throw new Error(`Saga '${sagaName}' not found`);
    }

    const context: SagaContext<T> = {
      id: Math.random().toString(36).substring(2),
      name: sagaName,
      status: SagaStatus.STARTED,
      data: initialData,
      steps: [],
    };

    const executedSteps: RegisteredSagaStep[] = [];

    try {
      for (const step of saga.steps) {
        executedSteps.push(step);
        try {
          const result = await (
            saga.target[step.methodName] || saga.target.prototype[step.methodName]
          ).call(saga.target, context.data);

          context.steps.push({
            stepName: step.name,
            status: 'COMPLETED',
            result,
            timestamp: Date.now(),
          });
        } catch (error) {
          context.error = error;
          context.status = SagaStatus.FAILED;

          context.steps.push({
            stepName: step.name,
            status: 'FAILED',
            error,
            timestamp: Date.now(),
          });

          await this.compensate(saga, context, executedSteps.slice(0, -1).reverse());
          break;
        }
      }

      if (context.status === SagaStatus.STARTED) {
        context.status = SagaStatus.COMPLETED;
      }
    } catch (criticalError) {
      context.status = SagaStatus.FAILED;
      context.error = criticalError;
    }

    return context;
  }

  private async compensate(
    saga: RegisteredSaga,
    context: SagaContext,
    stepsToCompensate: RegisteredSagaStep[]
  ): Promise<void> {
    context.status = SagaStatus.COMPENSATING;

    for (const step of stepsToCompensate) {
      if (step.options.compensate) {
        try {
          await (
            saga.target[step.options.compensate] || saga.target.prototype[step.options.compensate]
          ).call(saga.target, context.data);

          const execution = context.steps.find((s) => s.stepName === step.name);
          if (execution) {
            execution.status = 'COMPENSATED';
          }
        } catch (compensationError) {
          // eslint-disable-next-line no-console
          console.error(`Compensation failed for step ${step.name}:`, compensationError);
          // If compensation fails, we mark the saga as FAILED/ABORTED and continue
        }
      }
    }

    context.status = SagaStatus.ABORTED;
  }
}
