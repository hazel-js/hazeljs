import { WorkflowFacade } from '../workflow.facade';

describe('WorkflowFacade', () => {
  let workflowFacade: WorkflowFacade;

  beforeEach(() => {
    workflowFacade = new WorkflowFacade();
  });

  describe('create', () => {
    it('should create a workflow builder', () => {
      const builder = workflowFacade.create('test-workflow');
      expect(builder).toBeDefined();
      expect(typeof builder.step).toBe('function');
      expect(typeof builder.run).toBe('function');
    });

    it('should execute a simple workflow', async () => {
      const builder = workflowFacade.create('simple-workflow');

      const result = await builder
        .step('step1', async (input: string) => {
          await new Promise((resolve) => setTimeout(resolve, 1)); // Small delay
          return input.toUpperCase();
        })
        .step('step2', async (input: string) => {
          await new Promise((resolve) => setTimeout(resolve, 1)); // Small delay
          return `${input}!`;
        })
        .run('hello');

      expect(result.output).toBe('HELLO!');
      expect(result.steps).toHaveLength(2);
      expect(result.steps[0]).toEqual({
        name: 'step1',
        duration: expect.any(Number),
        output: 'HELLO',
      });
      expect(result.steps[1]).toEqual({
        name: 'step2',
        duration: expect.any(Number),
        output: 'HELLO!',
      });
      expect(result.totalDuration).toBeGreaterThanOrEqual(0);
    });

    it('should pass output of one step to next', async () => {
      const builder = workflowFacade.create('pipeline-workflow');

      const result = await builder
        .step('extract', async (text: string) => {
          return { words: text.split(' ') };
        })
        .step('count', async (data: { words: string[] }) => {
          return { count: data.words.length };
        })
        .step('format', async (data: { count: number }) => {
          return `Word count: ${data.count}`;
        })
        .run('hello world test');

      expect(result.output).toBe('Word count: 3');
    });

    it('should handle async operations', async () => {
      const builder = workflowFacade.create('async-workflow');

      const result = await builder
        .step('delay', async (input: string) => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return input;
        })
        .step('transform', async (input: string) => {
          return input + ' (delayed)';
        })
        .run('test');

      expect(result.output).toBe('test (delayed)');
      // Date.now() is ms-resolution; wall time can measure 9ms for a 10ms timeout
      expect(result.totalDuration).toBeGreaterThanOrEqual(8);
    });

    it('should handle errors in steps', async () => {
      const builder = workflowFacade.create('error-workflow');

      await expect(
        builder
          .step('empty', async (_input: string) => {
            return 'no-op';
          })
          .step('bad-step', async (_input: string) => {
            throw new Error('Step failed');
          })
          .run('test')
      ).rejects.toThrow('Step failed');
    });

    it('should handle empty workflow', async () => {
      const builder = workflowFacade.create('empty-workflow');

      const result = await builder.run('input');

      expect(result.output).toBe('input');
      expect(result.steps).toHaveLength(0);
      expect(result.totalDuration).toBeGreaterThanOrEqual(0);
    });

    it('should support different input/output types', async () => {
      interface Step1Output {
        processed: string;
        length: number;
      }

      interface Step2Output {
        summary: string;
        metadata: Step1Output;
      }

      const builder = workflowFacade.create('typed-workflow');

      const result = await builder
        .step<string, Step1Output>('process', async (input: string) => {
          return {
            processed: input.toUpperCase(),
            length: input.length,
          };
        })
        .step<Step1Output, Step2Output>('summarize', async (input: Step1Output) => {
          return {
            summary: `Processed ${input.processed} (${input.length} chars)`,
            metadata: input,
          };
        })
        .run<Step2Output>('hello');

      expect(result.output).toEqual({
        summary: 'Processed HELLO (5 chars)',
        metadata: {
          processed: 'HELLO',
          length: 5,
        },
      });
    });
  });
});
