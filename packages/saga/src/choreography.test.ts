import { SagaChoreography, OnEvent, SagaChoreographyManager } from './choreography';
import { EventEmitterService } from '@hazeljs/event-emitter';

describe('SagaChoreography', () => {
  let manager: SagaChoreographyManager;
  let eventEmitter: EventEmitterService;

  beforeEach(() => {
    manager = SagaChoreographyManager.getInstance();
    // For test, we might want a fresh manager but it's a singleton.
    // We'll use the singleton instances.
    eventEmitter = (manager as any).eventEmitter;
    jest.clearAllMocks();
  });

  it('should handle decorator-based event subscriptions', async () => {
    const handlerSpy = jest.fn();

    @SagaChoreography()
    class _TestChoreography {
      @OnEvent('user.created')
      async onUserCreated(data: any) {
        handlerSpy(data);
      }
    }

    // Emit event
    const testData = { id: 'u123', name: 'John' };
    await eventEmitter.emitAsync('user.created', testData);

    expect(handlerSpy).toHaveBeenCalledWith(testData);
  });

  it('should work with multiple events and handlers', async () => {
    const handler1 = jest.fn();
    const handler2 = jest.fn();

    @SagaChoreography()
    class _MultiChoreography {
      @OnEvent('order.placed')
      async onOrderPlaced(data: any) {
        handler1(data);
      }

      @OnEvent('inventory.checked')
      async onInventoryChecked(data: any) {
        handler2(data);
      }
    }

    await eventEmitter.emitAsync('order.placed', { id: 'o1' });
    await eventEmitter.emitAsync('inventory.checked', { id: 'o1', status: 'OK' });

    expect(handler1).toHaveBeenCalledWith({ id: 'o1' });
    expect(handler2).toHaveBeenCalledWith({ id: 'o1', status: 'OK' });
  });
});
