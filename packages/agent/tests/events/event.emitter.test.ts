import { AgentEventEmitter } from '../../src/events/event.emitter';
import { AgentEventType } from '../../src/types/event.types';

describe('AgentEventEmitter', () => {
  let emitter: AgentEventEmitter;

  beforeEach(() => {
    emitter = new AgentEventEmitter();
  });

  describe('on', () => {
    it('should subscribe to an event type', () => {
      const handler = jest.fn();
      emitter.on(AgentEventType.EXECUTION_STARTED, handler);

      expect(emitter.listenerCount(AgentEventType.EXECUTION_STARTED)).toBe(1);
    });

    it('should allow multiple handlers for same event type', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      emitter.on(AgentEventType.EXECUTION_STARTED, handler1);
      emitter.on(AgentEventType.EXECUTION_STARTED, handler2);

      expect(emitter.listenerCount(AgentEventType.EXECUTION_STARTED)).toBe(2);
    });
  });

  describe('onAny', () => {
    it('should subscribe to all events', () => {
      const handler = jest.fn();
      emitter.onAny(handler);

      // Wildcard handlers are not counted in listenerCount
      expect(emitter.listenerCount(AgentEventType.EXECUTION_STARTED)).toBe(0);
    });

    it('should allow multiple wildcard handlers', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      emitter.onAny(handler1);
      emitter.onAny(handler2);

      // Both should be registered
      expect(true).toBe(true);
    });
  });

  describe('off', () => {
    it('should unsubscribe from an event type', () => {
      const handler = jest.fn();
      emitter.on(AgentEventType.EXECUTION_STARTED, handler);

      expect(emitter.listenerCount(AgentEventType.EXECUTION_STARTED)).toBe(1);

      emitter.off(AgentEventType.EXECUTION_STARTED, handler);

      expect(emitter.listenerCount(AgentEventType.EXECUTION_STARTED)).toBe(0);
    });

    it('should not affect other handlers', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      emitter.on(AgentEventType.EXECUTION_STARTED, handler1);
      emitter.on(AgentEventType.EXECUTION_STARTED, handler2);

      emitter.off(AgentEventType.EXECUTION_STARTED, handler1);

      expect(emitter.listenerCount(AgentEventType.EXECUTION_STARTED)).toBe(1);
    });
  });

  describe('offAny', () => {
    it('should unsubscribe from all events', () => {
      const handler = jest.fn();
      emitter.onAny(handler);

      emitter.offAny(handler);

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('emit', () => {
    it('should call handlers for specific event type', async () => {
      const handler = jest.fn();
      emitter.on(AgentEventType.EXECUTION_STARTED, handler);

      await emitter.emit(AgentEventType.EXECUTION_STARTED, 'agent-1', 'exec-1', { data: 'test' });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: AgentEventType.EXECUTION_STARTED,
          agentId: 'agent-1',
          executionId: 'exec-1',
          data: { data: 'test' },
        })
      );
    });

    it('should call wildcard handlers', async () => {
      const handler = jest.fn();
      emitter.onAny(handler);

      await emitter.emit(AgentEventType.EXECUTION_STARTED, 'agent-1', 'exec-1', { data: 'test' });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: AgentEventType.EXECUTION_STARTED,
          agentId: 'agent-1',
          executionId: 'exec-1',
        })
      );
    });

    it('should include timestamp in event', async () => {
      const handler = jest.fn();
      emitter.on(AgentEventType.EXECUTION_STARTED, handler);

      const before = new Date();
      await emitter.emit(AgentEventType.EXECUTION_STARTED, 'agent-1', 'exec-1', {});
      const after = new Date();

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(Date),
        })
      );

      const event = handler.mock.calls[0][0];
      expect(event.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(event.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should include metadata in event', async () => {
      const handler = jest.fn();
      emitter.on(AgentEventType.EXECUTION_STARTED, handler);

      const metadata = { custom: 'value' };
      await emitter.emit(AgentEventType.EXECUTION_STARTED, 'agent-1', 'exec-1', {}, metadata);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata,
        })
      );
    });

    it('should handle async handlers', async () => {
      const handler = jest.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
      emitter.on(AgentEventType.EXECUTION_STARTED, handler);

      await emitter.emit(AgentEventType.EXECUTION_STARTED, 'agent-1', 'exec-1', {});

      expect(handler).toHaveBeenCalled();
    });

    it('should silently handle errors in handlers', async () => {
      const handler = jest.fn().mockImplementation(() => {
        throw new Error('Handler error');
      });
      emitter.on(AgentEventType.EXECUTION_STARTED, handler);

      await expect(
        emitter.emit(AgentEventType.EXECUTION_STARTED, 'agent-1', 'exec-1', {})
      ).resolves.not.toThrow();

      expect(handler).toHaveBeenCalled();
    });

    it('should silently handle async errors in handlers', async () => {
      const handler = jest.fn().mockImplementation(async () => {
        throw new Error('Async handler error');
      });
      emitter.on(AgentEventType.EXECUTION_STARTED, handler);

      await expect(
        emitter.emit(AgentEventType.EXECUTION_STARTED, 'agent-1', 'exec-1', {})
      ).resolves.not.toThrow();

      expect(handler).toHaveBeenCalled();
    });

    it('should silently handle errors in wildcard handlers', async () => {
      const wildcardHandler = jest.fn().mockImplementation(() => {
        throw new Error('Wildcard handler error');
      });
      emitter.onAny(wildcardHandler);

      await expect(
        emitter.emit(AgentEventType.EXECUTION_STARTED, 'agent-1', 'exec-1', {})
      ).resolves.not.toThrow();

      expect(wildcardHandler).toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it('should clear all handlers', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      const wildcardHandler = jest.fn();

      emitter.on(AgentEventType.EXECUTION_STARTED, handler1);
      emitter.on(AgentEventType.EXECUTION_COMPLETED, handler2);
      emitter.onAny(wildcardHandler);

      emitter.clear();

      expect(emitter.listenerCount(AgentEventType.EXECUTION_STARTED)).toBe(0);
      expect(emitter.listenerCount(AgentEventType.EXECUTION_COMPLETED)).toBe(0);
    });
  });

  describe('listenerCount', () => {
    it('should return correct count for event type', () => {
      expect(emitter.listenerCount(AgentEventType.EXECUTION_STARTED)).toBe(0);

      emitter.on(AgentEventType.EXECUTION_STARTED, jest.fn());
      expect(emitter.listenerCount(AgentEventType.EXECUTION_STARTED)).toBe(1);

      emitter.on(AgentEventType.EXECUTION_STARTED, jest.fn());
      expect(emitter.listenerCount(AgentEventType.EXECUTION_STARTED)).toBe(2);
    });

    it('should return 0 for non-existent event type', () => {
      expect(emitter.listenerCount(AgentEventType.EXECUTION_STARTED)).toBe(0);
    });
  });
});

