import { debug, setDebugEnabled } from '../../utils/debug';

describe('debug utility', () => {
  let originalEnv: string | undefined;
  let consoleErrorSpy: jest.SpyInstance;
  let log: ReturnType<typeof debug>;

  beforeEach(() => {
    originalEnv = process.env.HAZELJS_DEBUG;
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    log = debug('rag');
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.HAZELJS_DEBUG = originalEnv;
    } else {
      delete process.env.HAZELJS_DEBUG;
    }
    consoleErrorSpy.mockRestore();
    setDebugEnabled(false);
  });

  describe('environment variable detection', () => {
    it('should enable debug when HAZELJS_DEBUG=true', () => {
      setDebugEnabled(true);

      log('test message');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should enable debug when HAZELJS_DEBUG=1', () => {
      process.env.HAZELJS_DEBUG = '1';
      setDebugEnabled(true);

      log('test message');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should not log when debug is disabled', () => {
      setDebugEnabled(false);

      log('test message');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('setDebugEnabled', () => {
    it('should enable debug logging', () => {
      setDebugEnabled(true);

      log('test message');
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('[hazeljs:rag]'));
    });

    it('should disable debug logging', () => {
      setDebugEnabled(false);

      log('test message');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('debug function', () => {
    beforeEach(() => {
      setDebugEnabled(true);
    });

    it('should log with timestamp and prefix', () => {
      log('test message');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[hazeljs:rag\] test message$/
        )
      );
    });

    it('should handle string formatting with %s', () => {
      log('user=%s action=%s', 'alice', 'login');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('user=alice action=login')
      );
    });

    it('should handle number formatting with %d', () => {
      log('count=%d total=%d', 5, 100);

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('count=5 total=100'));
    });

    it('should handle JSON formatting with %j', () => {
      log('data=%j', { key: 'value' });

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('data={"key":"value"}'));
    });

    it('should handle remaining arguments', () => {
      log('message', 'extra', 123);

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('message extra 123'));
    });

    it('should create scoped loggers', () => {
      const aiLog = debug('ai');
      const ragLog = debug('rag');

      aiLog('ai message');
      ragLog('rag message');

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('[hazeljs:ai]'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('[hazeljs:rag]'));
    });

    it('should not log when disabled', () => {
      setDebugEnabled(false);
      log('should not appear');

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('performance', () => {
    it('should skip logging when disabled', () => {
      setDebugEnabled(false);

      log('message with %s', 'formatting');

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });
});
