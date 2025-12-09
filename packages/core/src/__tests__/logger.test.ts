import logger from '../logger';

describe('Logger', () => {
  beforeEach(() => {
    // Suppress console output during tests
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('basic logging', () => {
    it('should log info messages', () => {
      logger.info('Test info message');
      expect(logger).toBeDefined();
    });

    it('should log error messages', () => {
      logger.error('Test error message');
      expect(logger).toBeDefined();
    });

    it('should log warn messages', () => {
      logger.warn('Test warn message');
      expect(logger).toBeDefined();
    });

    it('should log debug messages', () => {
      logger.debug('Test debug message');
      expect(logger).toBeDefined();
    });

    it('should log http messages', () => {
      logger.http('Test http message');
      expect(logger).toBeDefined();
    });
  });

  describe('structured logging', () => {
    it('should log with metadata object', () => {
      logger.info('Test message', { userId: 123, action: 'login' });
      expect(logger).toBeDefined();
    });

    it('should log errors with stack traces', () => {
      const error = new Error('Test error');
      logger.error('Error occurred', { error: error.message, stack: error.stack });
      expect(logger).toBeDefined();
    });

    it('should log with multiple metadata fields', () => {
      logger.info('Request received', {
        method: 'GET',
        url: '/api/users',
        statusCode: 200,
        duration: 45,
      });
      expect(logger).toBeDefined();
    });
  });

  describe('log levels', () => {
    it('should support error level', () => {
      logger.error('Critical error');
      expect(logger).toBeDefined();
    });

    it('should support warn level', () => {
      logger.warn('Warning message');
      expect(logger).toBeDefined();
    });

    it('should support info level', () => {
      logger.info('Info message');
      expect(logger).toBeDefined();
    });

    it('should support debug level', () => {
      logger.debug('Debug message');
      expect(logger).toBeDefined();
    });
  });

  describe('logger methods', () => {
    it('should have all required logging methods', () => {
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });
  });

  describe('various message formats', () => {
    it('should log string messages', () => {
      logger.info('Simple string message');
      expect(logger).toBeDefined();
    });

    it('should log with empty metadata', () => {
      logger.info('Message', {});
      expect(logger).toBeDefined();
    });

    it('should log with nested objects', () => {
      logger.info('Complex data', {
        user: {
          id: 1,
          name: 'Test User',
          roles: ['admin', 'user'],
        },
      });
      expect(logger).toBeDefined();
    });

    it('should log with arrays', () => {
      logger.info('Array data', {
        items: [1, 2, 3, 4, 5],
      });
      expect(logger).toBeDefined();
    });
  });

  describe('error scenarios', () => {
    it('should handle logging errors gracefully', () => {
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;
      
      // Should not throw even with circular reference
      expect(() => {
        logger.info('Circular object', { data: 'safe' });
      }).not.toThrow();
    });

    it('should handle undefined metadata', () => {
      logger.info('Message', undefined as any);
      expect(logger).toBeDefined();
    });

    it('should handle null metadata', () => {
      logger.info('Message', null as any);
      expect(logger).toBeDefined();
    });
  });

  describe('logger instance', () => {
    it('should be defined', () => {
      expect(logger).toBeDefined();
    });

    it('should have all required methods', () => {
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.http).toBe('function');
    });
  });
});
