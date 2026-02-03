import { Logger, LogLevel } from '../../src/utils/logger';

describe('Logger', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('log levels', () => {
    it('should log debug messages when level is DEBUG', () => {
      const logger = new Logger({ level: LogLevel.DEBUG });
      logger.debug('Debug message');

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should not log debug messages when level is INFO', () => {
      const logger = new Logger({ level: LogLevel.INFO });
      logger.debug('Debug message');

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should log info messages', () => {
      const logger = new Logger({ level: LogLevel.INFO });
      logger.info('Info message');

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should log warn messages', () => {
      const logger = new Logger({ level: LogLevel.WARN });
      logger.warn('Warning message');

      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should log error messages', () => {
      const logger = new Logger({ level: LogLevel.ERROR });
      logger.error('Error message');

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should log fatal messages', () => {
      const logger = new Logger({ level: LogLevel.FATAL });
      logger.fatal('Fatal message');

      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('context', () => {
    it('should include context in log entry', () => {
      const logger = new Logger({ level: LogLevel.INFO });
      logger.info('Message', { agentId: 'test-agent', executionId: 'exec-1' });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Message')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('test-agent')
      );
    });

    it('should include error in log entry', () => {
      const logger = new Logger({ level: LogLevel.ERROR });
      const error = new Error('Test error');
      logger.error('Error occurred', error);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error occurred')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Test error')
      );
    });

    it('should include error stack in log entry', () => {
      const logger = new Logger({ level: LogLevel.ERROR });
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test.js:1:1';
      logger.error('Error occurred', error);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error: Test error')
      );
    });
  });

  describe('custom handler', () => {
    it('should call custom handler', () => {
      const customHandler = jest.fn();
      const logger = new Logger({ level: LogLevel.INFO, customHandler });
      logger.info('Test message');

      expect(customHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Test message',
          level: 'INFO',
        })
      );
    });

    it('should include error in custom handler entry', () => {
      const customHandler = jest.fn();
      const logger = new Logger({ level: LogLevel.ERROR, customHandler });
      const error = new Error('Test error');
      logger.error('Error occurred', error);

      expect(customHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            name: 'Error',
            message: 'Test error',
          }),
        })
      );
    });
  });

  describe('JSON output', () => {
    it('should output JSON when enableJson is true', () => {
      const logger = new Logger({ level: LogLevel.INFO, enableJson: true });
      logger.info('Test message');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/^{.*"message":"Test message".*}$/)
      );
    });

    it('should not output JSON when enableJson is false', () => {
      const logger = new Logger({ level: LogLevel.INFO, enableJson: false });
      logger.info('Test message');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.not.stringMatching(/^{.*"message".*}$/)
      );
    });
  });

  describe('console output', () => {
    it('should not output to console when enableConsole is false', () => {
      const logger = new Logger({
        level: LogLevel.INFO,
        enableConsole: false,
      });
      logger.info('Test message');

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should output to console when enableConsole is true', () => {
      const logger = new Logger({
        level: LogLevel.INFO,
        enableConsole: true,
      });
      logger.info('Test message');

      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('setLevel and getLevel', () => {
    it('should set and get log level', () => {
      const logger = new Logger({ level: LogLevel.INFO });
      expect(logger.getLevel()).toBe(LogLevel.INFO);

      logger.setLevel(LogLevel.DEBUG);
      expect(logger.getLevel()).toBe(LogLevel.DEBUG);
    });
  });

  describe('fatal with error', () => {
    it('should log fatal messages with error', () => {
      const logger = new Logger({ level: LogLevel.FATAL });
      const error = new Error('Fatal error');
      logger.fatal('Fatal occurred', error);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Fatal occurred')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Fatal error')
      );
    });
  });

  describe('timestamp', () => {
    it('should include timestamp in log entry', () => {
      const customHandler = jest.fn();
      const logger = new Logger({ level: LogLevel.INFO, customHandler });
      logger.info('Test message');

      expect(customHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(String),
        })
      );
    });
  });
});

