import type { WorkflowBuilder, WorkflowResult } from '../platform/hazel-ai.types';

interface Step {
  name: string;
  fn: (input: unknown) => Promise<unknown>;
}

/**
 * Workflow Facade — Provides simple step-chaining capabilities.
 *
 * This facade allows creating workflows that chain multiple steps
 * together, passing the output of one step as input to the next.
 * It tracks execution time and provides a simple builder API.
 */
export class WorkflowFacade {
  /**
   * Create a new workflow builder.
   *
   * @param _id Unique workflow identifier (for logging/debugging)
   * @returns Workflow builder instance
   */
  create(_id: string): WorkflowBuilder {
    const steps: Step[] = [];

    const builder: WorkflowBuilder = {
      /**
       * Add a step to the workflow.
       *
       * @param name Step name for tracking
       * @param fn Async function that processes input
       * @returns Builder for chaining
       */
      step<TIn = unknown, TOut = unknown>(
        _name: string,
        fn: (input: TIn) => Promise<TOut>
      ): WorkflowBuilder {
        steps.push({ name: _name, fn: fn as (input: unknown) => Promise<unknown> });
        return builder;
      },

      /**
       * Execute the workflow with the given input.
       *
       * @param input Initial input for the first step
       * @returns Workflow result with outputs and timing
       */
      async run<T>(input: string): Promise<WorkflowResult<T>> {
        let current: unknown = input;
        const stepResults: Array<{ name: string; duration: number; output: unknown }> = [];
        const start = Date.now();

        for (const step of steps) {
          const stepStart = Date.now();
          try {
            current = await step.fn(current as unknown);
            const duration = Date.now() - stepStart;
            stepResults.push({ name: step.name, duration, output: current });
          } catch (error) {
            const duration = Date.now() - stepStart;
            stepResults.push({
              name: step.name,
              duration,
              output: error instanceof Error ? error.message : String(error),
            });
            throw error;
          }
        }

        return {
          output: current as T,
          steps: stepResults,
          totalDuration: Date.now() - start,
        };
      },
    };

    return builder;
  }
}
