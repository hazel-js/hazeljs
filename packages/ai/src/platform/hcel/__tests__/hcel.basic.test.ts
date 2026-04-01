import { HazelAI } from '../../hazel-ai';
import { HCELBuilder } from '../hcel.builder';

describe('HCEL - Basic Functionality', () => {
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
    });

    it('should support chain configuration', () => {
      const chain = hcel.prompt('Test').config({ adaptive: true });

      const summary = chain.getSummary();
      expect(summary.config.adaptive).toBe(true);
    });

    it('should support context configuration', () => {
      const chain = hcel.prompt('Test').context({ userId: 'user-123' });

      expect(chain.getSummary().operationCount).toBe(1);
    });
  });

  describe('Chain Management', () => {
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
});
