import { HazelAI } from '../../hazel-ai';
import { HCELBuilder } from '../hcel.builder';

describe('HCEL - HazelJS Composable Expression Language', () => {
  let ai: HazelAI;
  let hcel: HCELBuilder;

  beforeEach(() => {
    jest.clearAllMocks();
    ai = new HazelAI();
    hcel = ai.hazel;
  });

  describe('Basic Operations', () => {
    it('should create an HCEL builder', () => {
      expect(hcel).toBeInstanceOf(HCELBuilder);
    });

    it('should build a simple prompt chain', () => {
      const chain = hcel.prompt('Hello, world!');
      const summary = chain.getSummary();

      expect(summary.operationCount).toBe(1);
      expect(summary.operations[0]).toContain('prompt');
    });

    it('should build a multi-operation chain', () => {
      const chain = hcel.prompt('Analyze this text').ml('sentiment');

      const summary = chain.getSummary();
      expect(summary.operationCount).toBe(2);
      expect(summary.operations[0]).toContain('prompt');
      expect(summary.operations[1]).toContain('ml');
    });

    it('should support chain configuration', () => {
      const chain = hcel.prompt('Test').config({ adaptive: true });

      const summary = chain.getSummary();
      expect(summary.config.adaptive).toBe(true);
    });

    it('should support context configuration', () => {
      const chain = hcel.prompt('Test').context({ userId: 'user-123' });

      // Context is stored internally, we can't directly access it
      // but we can verify the chain was built successfully
      expect(chain.getSummary().operationCount).toBe(1);
    });
  });

  describe('Chain Operations', () => {
    it('should clone a chain', () => {
      const original = hcel.prompt('Test').ml('sentiment');
      const cloned = original.clone();

      expect(cloned.getSummary().operationCount).toBe(2);
      expect(cloned.getSummary().operations).toEqual(original.getSummary().operations);
    });

    it('should reset a chain', () => {
      const chain = hcel.prompt('Test').ml('sentiment');
      expect(chain.getSummary().operationCount).toBe(2);

      chain.reset();
      expect(chain.getSummary().operationCount).toBe(0);
    });

    it('should get operations list', () => {
      const chain = hcel.prompt('Test').ml('sentiment');
      const operations = chain.getOperations();

      expect(operations).toHaveLength(2);
      expect(operations[0].type).toBe('prompt');
      expect(operations[1].type).toBe('ml');
    });
  });

  describe('Advanced Features', () => {
    it('should support parallel operations', () => {
      const chain1 = hcel.prompt('Chain 1');
      const chain2 = hcel.prompt('Chain 2');

      const parallelChain = hcel.parallel(chain1, chain2);
      const summary = parallelChain.getSummary();

      // parallel() adds a parallel op + the 2 operations from builders
      expect(summary.operationCount).toBe(3);
      expect(summary.operations.some((op: string) => op.includes('parallel'))).toBe(true);
    });

    it('should support conditional operations', () => {
      const chain = hcel.prompt('Test').conditional(() => true);

      const summary = chain.getSummary();
      expect(summary.operationCount).toBe(1);
      expect(summary.operations[0]).toContain('conditional');
    });

    it('should support adaptive configuration', () => {
      const chain = hcel.prompt('Test').adaptive();

      const summary = chain.getSummary();
      expect(summary.config.adaptive).toBe(true);
    });

    it('should support observation', () => {
      const mockObserver = jest.fn();
      const chain = hcel.prompt('Test').observe(mockObserver);

      // Observer should be registered (we can't easily test the callback without execution)
      expect(chain.getSummary().operationCount).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when executing empty chain', async () => {
      const emptyChain = hcel;

      await expect(emptyChain.execute()).rejects.toThrow('No operations to execute');
    });

    it('should throw error when streaming empty chain', async () => {
      const emptyChain = hcel;

      const stream = emptyChain.stream();
      await expect(stream.next()).rejects.toThrow('No operations to stream');
    });
  });

  describe('Type Safety', () => {
    it('should maintain type information through chain', () => {
      // This test verifies TypeScript compilation more than runtime behavior
      const stringChain: HCELBuilder<string, any> = hcel.prompt('Test');
      const mlChain: HCELBuilder<unknown, any> = stringChain.ml('sentiment');

      // Chained builder shares operations array, so both have 2 ops
      expect(stringChain.getSummary().operationCount).toBe(2);
      expect(mlChain.getSummary().operationCount).toBe(2);
    });
  });
});
