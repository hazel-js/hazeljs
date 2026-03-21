import {
  collectTokens,
  bufferTokens,
  StreamingProgressTracker,
  StreamingEventEmitter,
  ConsoleStreamFormatter,
  filterChunks,
  transformStream,
} from '../streaming.utils';
import { AgentStreamChunk, AgentState, AgentActionType } from '../../types/agent.types';

describe('Streaming Utils', () => {
  describe('collectTokens', () => {
    it('should collect all tokens from a stream', async () => {
      async function* mockStream() {
        yield { type: 'token', content: 'Hello' } as AgentStreamChunk;
        yield { type: 'token', content: ' World' } as AgentStreamChunk;
      }

      const result = await collectTokens(mockStream());
      expect(result).toBe('Hello World');
    });

    it('should handle empty stream', async () => {
      async function* mockStream() {
        // Empty
      }

      const result = await collectTokens(mockStream());
      expect(result).toBe('');
    });
  });

  describe('bufferTokens', () => {
    it('should buffer tokens', async () => {
      async function* mockStream() {
        yield { type: 'token', content: 'a' } as AgentStreamChunk;
        yield { type: 'token', content: 'b' } as AgentStreamChunk;
        yield { type: 'token', content: 'c' } as AgentStreamChunk;
      }

      const results: AgentStreamChunk[] = [];
      for await (const chunk of bufferTokens(mockStream(), 2)) {
        results.push(chunk);
      }

      expect(results.length).toBeGreaterThan(0);
    });

    it('should pass through non-token chunks', async () => {
      async function* mockStream() {
        yield { type: 'token', content: 'a' } as AgentStreamChunk;
        yield {
          type: 'step',
          step: {
            id: '1',
            agentId: 'test',
            executionId: 'exec1',
            stepNumber: 1,
            state: AgentState.THINKING,
            timestamp: new Date(),
          },
        } as unknown as AgentStreamChunk;
      }

      const results: AgentStreamChunk[] = [];
      for await (const chunk of bufferTokens(mockStream(), 5)) {
        results.push(chunk);
      }

      expect(results.some((c) => c.type === 'step')).toBe(true);
    });

    it('should flush remaining tokens when buffer not full', async () => {
      async function* mockStream() {
        yield { type: 'token', content: 'a' } as AgentStreamChunk;
        yield { type: 'token', content: 'b' } as AgentStreamChunk;
      }

      const results: AgentStreamChunk[] = [];
      for await (const chunk of bufferTokens(mockStream(), 10)) {
        results.push(chunk);
      }

      expect(results.length).toBe(1);
      expect(results[0].type).toBe('token');
      if (results[0].type === 'token') {
        expect(results[0].content).toBe('ab');
      }
    });

    it('should handle mixed token and non-token chunks', async () => {
      async function* mockStream() {
        yield { type: 'token', content: 'a' } as AgentStreamChunk;
        yield {
          type: 'done',
          result: { state: AgentState.COMPLETED, duration: 100, response: 'done' },
        } as unknown as AgentStreamChunk;
        yield { type: 'token', content: 'b' } as AgentStreamChunk;
      }

      const results: AgentStreamChunk[] = [];
      for await (const chunk of bufferTokens(mockStream(), 5)) {
        results.push(chunk);
      }

      expect(results.some((c) => c.type === 'done')).toBe(true);
      expect(results.some((c) => c.type === 'token')).toBe(true);
    });
  });

  describe('StreamingProgressTracker', () => {
    it('should track token updates', () => {
      const tracker = new StreamingProgressTracker(5);
      tracker.update({ type: 'token', content: 'test' } as AgentStreamChunk);

      const progress = tracker.getProgress();
      expect(progress.tokensGenerated).toBe(1);
    });

    it('should track step updates', () => {
      const tracker = new StreamingProgressTracker(3);
      tracker.update({
        type: 'step',
        step: {
          id: '1',
          agentId: 'test',
          executionId: 'exec1',
          stepNumber: 1,
          state: AgentState.COMPLETED,
          timestamp: new Date(),
        },
      } as unknown as AgentStreamChunk);

      const progress = tracker.getProgress();
      expect(progress.currentStep).toBe(1);
    });

    it('should track tool calls', () => {
      const tracker = new StreamingProgressTracker(3);
      tracker.update({
        type: 'step',
        step: {
          id: '1',
          agentId: 'test',
          executionId: 'exec1',
          stepNumber: 1,
          state: AgentState.COMPLETED,
          timestamp: new Date(),
          action: {
            type: AgentActionType.USE_TOOL,
            toolName: 'testTool',
            toolInput: {},
          },
        },
      } as unknown as AgentStreamChunk);

      const progress = tracker.getProgress();
      expect(progress.toolsCalled).toBe(1);
    });

    it('should reset tracker', () => {
      const tracker = new StreamingProgressTracker(5);
      tracker.update({ type: 'token', content: 'test' } as AgentStreamChunk);
      tracker.reset();

      const progress = tracker.getProgress();
      expect(progress.tokensGenerated).toBe(0);
    });

    it('should calculate elapsed time', () => {
      const tracker = new StreamingProgressTracker(5);
      const progress = tracker.getProgress();
      expect(progress.elapsedTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('StreamingEventEmitter', () => {
    it('should register and call handlers', async () => {
      const emitter = new StreamingEventEmitter();
      const handler = jest.fn();

      emitter.on('token', handler);

      async function* mockStream() {
        yield { type: 'token', content: 'test' } as AgentStreamChunk;
      }

      await emitter.process(mockStream());

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple handlers', async () => {
      const emitter = new StreamingEventEmitter();
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      emitter.on('token', handler1);
      emitter.on('token', handler2);

      async function* mockStream() {
        yield { type: 'token', content: 'test' } as AgentStreamChunk;
      }

      await emitter.process(mockStream());

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should only call matching handlers', async () => {
      const emitter = new StreamingEventEmitter();
      const tokenHandler = jest.fn();
      const stepHandler = jest.fn();

      emitter.on('token', tokenHandler);
      emitter.on('step', stepHandler);

      async function* mockStream() {
        yield { type: 'token', content: 'test' } as AgentStreamChunk;
      }

      await emitter.process(mockStream());

      expect(tokenHandler).toHaveBeenCalledTimes(1);
      expect(stepHandler).not.toHaveBeenCalled();
    });
  });

  describe('filterChunks', () => {
    it('should filter chunks by type', async () => {
      async function* mockStream() {
        yield { type: 'token', content: 'a' } as AgentStreamChunk;
        yield { type: 'step', step: {} } as unknown as AgentStreamChunk;
        yield { type: 'token', content: 'b' } as AgentStreamChunk;
      }

      const results: AgentStreamChunk[] = [];
      for await (const chunk of filterChunks(mockStream(), ['token'])) {
        results.push(chunk);
      }

      expect(results.length).toBe(2);
      expect(results.every((c) => c.type === 'token')).toBe(true);
    });

    it('should handle empty filter', async () => {
      async function* mockStream() {
        yield { type: 'token', content: 'a' } as AgentStreamChunk;
      }

      const results: AgentStreamChunk[] = [];
      for await (const chunk of filterChunks(mockStream(), [])) {
        results.push(chunk);
      }

      expect(results.length).toBe(0);
    });
  });

  describe('transformStream', () => {
    it('should transform chunks', async () => {
      async function* mockStream() {
        yield { type: 'token', content: 'hello' } as AgentStreamChunk;
        yield { type: 'token', content: 'world' } as AgentStreamChunk;
      }

      const results: string[] = [];
      for await (const transformed of transformStream(mockStream(), (chunk: AgentStreamChunk) =>
        chunk.type === 'token' ? chunk.content.toUpperCase() : null
      )) {
        results.push(transformed);
      }

      expect(results).toEqual(['HELLO', 'WORLD']);
    });

    it('should filter out null transforms', async () => {
      async function* mockStream() {
        yield { type: 'token', content: 'a' } as AgentStreamChunk;
        yield { type: 'step', step: {} } as unknown as AgentStreamChunk;
      }

      const results: string[] = [];
      for await (const transformed of transformStream(mockStream(), (chunk: AgentStreamChunk) =>
        chunk.type === 'token' ? chunk.content : null
      )) {
        results.push(transformed);
      }

      expect(results).toEqual(['a']);
    });
  });

  describe('ConsoleStreamFormatter', () => {
    it('should format token chunks', () => {
      const formatter = new ConsoleStreamFormatter();
      const result = formatter.format({ type: 'token', content: 'Hello' } as AgentStreamChunk);
      expect(result).toBe('Hello');
    });

    it('should format step chunks', () => {
      const formatter = new ConsoleStreamFormatter();
      const result = formatter.format({
        type: 'step',
        step: {
          id: '1',
          agentId: 'test',
          executionId: 'exec1',
          stepNumber: 1,
          state: AgentState.THINKING,
          timestamp: new Date(),
        },
      } as AgentStreamChunk);

      expect(result).toContain('[Step 1]');
      expect(result).toContain('thinking');
    });

    it('should format done chunks', () => {
      const formatter = new ConsoleStreamFormatter();
      const result = formatter.format({
        type: 'done',
        result: {
          state: AgentState.COMPLETED,
          duration: 1500,
          response: 'test',
        },
      } as AgentStreamChunk);

      expect(result).toContain('Complete');
      expect(result).toContain('1500ms');
    });

    it('should return null for unknown types', () => {
      const formatter = new ConsoleStreamFormatter();
      const result = formatter.format({ type: 'unknown' } as any);
      expect(result).toBeNull();
    });

    it('should reset formatter', () => {
      const formatter = new ConsoleStreamFormatter();
      formatter.format({ type: 'token', content: 'test' } as AgentStreamChunk);
      formatter.reset();

      expect(formatter['currentLine']).toBe('');
      expect(formatter['stepCount']).toBe(0);
    });
  });
});
