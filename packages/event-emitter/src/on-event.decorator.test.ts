import 'reflect-metadata';
import { OnEvent, getOnEventMetadata, ON_EVENT_METADATA_KEY } from './on-event.decorator';

describe('OnEvent decorator', () => {
  it('should define ON_EVENT_METADATA_KEY', () => {
    expect(typeof ON_EVENT_METADATA_KEY).toBe('symbol');
  });

  it('should add metadata for single event', () => {
    class TestHandler {
      @OnEvent('order.created')
      handleOrderCreated(_payload: unknown) {}
    }

    const metadata = getOnEventMetadata(new TestHandler());
    expect(metadata).toHaveLength(1);
    expect(metadata[0].event).toBe('order.created');
    expect(metadata[0].methodName).toBe('handleOrderCreated');
    expect(metadata[0].options).toEqual({ suppressErrors: true });
  });

  it('should add metadata for multiple events on same class', () => {
    class TestHandler {
      @OnEvent('order.created')
      handleCreated(_payload: unknown) {}

      @OnEvent('order.updated')
      handleUpdated(_payload: unknown) {}
    }

    const metadata = getOnEventMetadata(new TestHandler());
    expect(metadata).toHaveLength(2);
    expect(metadata[0].event).toBe('order.created');
    expect(metadata[0].methodName).toBe('handleCreated');
    expect(metadata[1].event).toBe('order.updated');
    expect(metadata[1].methodName).toBe('handleUpdated');
  });

  it('should merge custom options with defaults', () => {
    class TestHandler {
      @OnEvent('test.event', { async: true, suppressErrors: false })
      handleEvent(_payload: unknown) {}
    }

    const metadata = getOnEventMetadata(new TestHandler());
    expect(metadata[0].options).toEqual({
      async: true,
      suppressErrors: false,
    });
  });

  it('should support array of events', () => {
    class TestHandler {
      @OnEvent(['event.a', 'event.b'])
      handleMultiple(_payload: unknown) {}
    }

    const metadata = getOnEventMetadata(new TestHandler());
    expect(metadata[0].event).toEqual(['event.a', 'event.b']);
  });

  it('should support symbol as event', () => {
    const sym = Symbol('custom-event');
    class TestHandler {
      @OnEvent(sym)
      handleSymbol(_payload: unknown) {}
    }

    const metadata = getOnEventMetadata(new TestHandler());
    expect(metadata[0].event).toBe(sym);
  });

  it('should default suppressErrors to true when not provided', () => {
    class TestHandler {
      @OnEvent('test.event', { async: true })
      handleEvent(_payload: unknown) {}
    }

    const metadata = getOnEventMetadata(new TestHandler());
    expect(metadata[0].options?.suppressErrors).toBe(true);
  });
});

describe('getOnEventMetadata', () => {
  it('should return empty array for class without @OnEvent decorators', () => {
    class PlainClass {}
    const metadata = getOnEventMetadata(new PlainClass());
    expect(metadata).toEqual([]);
  });

  it('should return metadata from class constructor', () => {
    class TestHandler {
      @OnEvent('test')
      handle() {}
    }
    const instance = new TestHandler();
    const metadata = getOnEventMetadata(instance);
    expect(metadata).toHaveLength(1);
  });
});
