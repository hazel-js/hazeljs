import { debug, setDebugEnabled } from './debug';

describe('Debug Utility', () => {
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  let debugLogger: ReturnType<typeof debug>;

  beforeEach(() => {
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    logSpy = jest.spyOn(console, 'log').mockImplementation();
    errorSpy = jest.spyOn(console, 'error').mockImplementation();
    debugLogger = debug('ai');
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    logSpy.mockRestore();
    errorSpy.mockRestore();
    // Reset debug state
    setDebugEnabled(false);
  });

  describe('debug function', () => {
    it('should not log when debug is disabled', () => {
      setDebugEnabled(false);

      debugLogger('Test message');
      debugLogger('Another message', { data: 'test' });

      expect(errorSpy).not.toHaveBeenCalled();
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('should log when debug is enabled', () => {
      setDebugEnabled(true);

      debugLogger('Test message');

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('[hazeljs:ai] Test message'));
    });

    it('should log with data when debug is enabled', () => {
      setDebugEnabled(true);

      const data = { key: 'value', number: 42 };
      debugLogger('Test message', data);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[hazeljs:ai] Test message {"key":"value","number":42}')
      );
    });

    it('should handle format strings', () => {
      setDebugEnabled(true);

      debugLogger('Processing %s with %d tokens', 'request', 100);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[hazeljs:ai] Processing request with 100 tokens')
      );
    });

    it('should stringify %o placeholders', () => {
      setDebugEnabled(true);
      debugLogger('obj %o', { a: 1 });
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('"a":1'));
    });

    it('should stringify %j placeholders', () => {
      setDebugEnabled(true);
      debugLogger('json %j', [1, 2]);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('[1,2]'));
    });

    it('should handle empty message', () => {
      setDebugEnabled(true);

      debugLogger('');

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('[hazeljs:ai] '));
    });

    it('should handle undefined message', () => {
      setDebugEnabled(true);

      debugLogger(undefined as any);

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('[hazeljs:ai] undefined'));
    });

    it('should handle null message', () => {
      setDebugEnabled(true);

      debugLogger(null as any);

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('[hazeljs:ai] null'));
    });

    it('should handle complex objects', () => {
      setDebugEnabled(true);

      const complexObject = {
        user: { name: 'John', age: 30 },
        items: [1, 2, 3],
        nested: { deep: { value: 'test' } },
      };

      debugLogger('Complex data', complexObject);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[hazeljs:ai\] Complex data.*"user".*"John"/)
      );
    });

    it('should handle errors', () => {
      setDebugEnabled(true);

      const error = new Error('Test error');
      debugLogger('Error occurred', error);

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('[hazeljs:ai] Error occurred'));
    });

    it('should not affect performance when disabled', () => {
      setDebugEnabled(false);

      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        debugLogger('Test message', { data: 'test', iteration: i });
      }
      const end = performance.now();

      // Should be very fast when disabled
      expect(end - start).toBeLessThan(10);
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });

  describe('setDebugEnabled', () => {
    it('should enable debug when called with true', () => {
      setDebugEnabled(true);

      debugLogger('Test message');

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('[hazeljs:ai] Test message'));
    });

    it('should disable debug when called with false', () => {
      setDebugEnabled(true);
      debugLogger('Should appear');

      setDebugEnabled(false);
      debugLogger('Should not appear');

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('[hazeljs:ai] Should appear'));
    });

    it('should handle multiple calls', () => {
      setDebugEnabled(true);
      setDebugEnabled(false);
      setDebugEnabled(true);

      debugLogger('Should appear');

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('[hazeljs:ai] Should appear'));
    });

    it('should return undefined', () => {
      const result = setDebugEnabled(true);

      expect(result).toBeUndefined();
    });

    it('should handle boolean-like values', () => {
      setDebugEnabled(1 as any);
      debugLogger('Should appear');
      expect(errorSpy).toHaveBeenCalled();

      errorSpy.mockClear();

      setDebugEnabled(0 as any);
      debugLogger('Should not appear');
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle circular references', () => {
      setDebugEnabled(true);

      const circular: any = { name: 'test' };
      circular.self = circular;

      // debug() is a factory; create a scoped logger
      const log = debug('ai');
      log('Circular reference', circular);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[hazeljs:ai] Circular reference')
      );
    });

    it('should handle very long messages', () => {
      setDebugEnabled(true);

      const longMessage = 'A'.repeat(1000);
      debugLogger(longMessage);

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('[hazeljs:ai] ' + longMessage));
    });

    it('should handle functions', () => {
      setDebugEnabled(true);

      const func = () => 'test';
      debugLogger('Function', func);

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('[hazeljs:ai] Function'));
    });

    it('should handle symbols', () => {
      setDebugEnabled(true);

      const symbol = Symbol('test');
      debugLogger('Symbol', symbol);

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('[hazeljs:ai] Symbol'));
    });

    it('should handle Date objects', () => {
      setDebugEnabled(true);

      const date = new Date('2023-01-01');
      debugLogger('Date', date);

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('[hazeljs:ai] Date'));
    });

    it('should handle RegExp objects', () => {
      setDebugEnabled(true);

      const regex = /test/g;
      debugLogger('Regex', regex);

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('[hazeljs:ai] Regex'));
    });
  });

  describe('Performance', () => {
    it('should be fast when disabled', () => {
      setDebugEnabled(false);

      const iterations = 10000;
      const start = performance.now();
      const log = debug('ai');

      for (let i = 0; i < iterations; i++) {
        log('iteration %d', i);
      }

      const end = performance.now();
      const timePerCall = (end - start) / iterations;

      // Should be less than 0.001ms per call when disabled
      expect(timePerCall).toBeLessThan(0.001);
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('should handle rapid enable/disable changes', () => {
      const iterations = 100;
      const log = debug('ai');

      for (let i = 0; i < iterations; i++) {
        setDebugEnabled(i % 2 === 0);
        log(`iteration ${i}`);
      }

      // Should have logged roughly half the messages
      expect(errorSpy).toHaveBeenCalledTimes(iterations / 2);
    });
  });

  describe('Integration with other modules', () => {
    it('should work with imported debug function', () => {
      setDebugEnabled(true);

      // Create a scoped logger using the factory
      const debugFn = debug('ai');
      debugFn('Imported debug test');

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[hazeljs:ai] Imported debug test')
      );
    });

    it('should maintain state across multiple imports', () => {
      setDebugEnabled(true);

      const log1 = debug('ai');
      log1('First message');

      // Simulate re-import: create another logger
      const log2 = debug('ai');
      setDebugEnabled(false);
      log2('Second message');

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('[hazeljs:ai] First message'));
    });
  });
});
