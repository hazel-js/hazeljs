import { BaseService } from '../service';
import logger from '../logger';
import 'reflect-metadata';

// Mock logger
jest.mock('../logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('BaseService', () => {
  class TestService extends BaseService {
    constructor() {
      super();
    }

    testLogError(error: Error) {
      this.logError('testMethod', error);
    }

    testLogInfo(message: string) {
      this.logInfo('testMethod', message);
    }

    testLogDebug(message: string, data?: unknown) {
      this.logDebug('testMethod', message, data);
    }
  }

  let service: TestService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TestService();
  });

  describe('constructor', () => {
    it('should log initialization', () => {
      expect(logger.info).toHaveBeenCalledWith('Initializing service: TestService');
    });
  });

  describe('logError', () => {
    it('should log error message', () => {
      const error = new Error('Test error');
      service.testLogError(error);

      expect(logger.error).toHaveBeenCalledWith('[TestService.testMethod] Error: Test error');
    });

    it('should log stack trace in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new Error('Test error');
      error.stack = 'Error stack trace';
      service.testLogError(error);

      expect(logger.debug).toHaveBeenCalledWith('Error stack trace');

      process.env.NODE_ENV = originalEnv;
    });

    it('should not log stack trace in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('Test error');
      error.stack = 'Error stack trace';
      service.testLogError(error);

      expect(logger.debug).not.toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('logInfo', () => {
    it('should log info message', () => {
      service.testLogInfo('Test message');

      expect(logger.info).toHaveBeenCalledWith('[TestService.testMethod] Test message');
    });

    it('should include service and method name', () => {
      service.testLogInfo('Operation completed');

      expect(logger.info).toHaveBeenCalledWith('[TestService.testMethod] Operation completed');
    });
  });

  describe('logDebug', () => {
    it('should log debug message', () => {
      service.testLogDebug('Debug message');

      expect(logger.debug).toHaveBeenCalledWith('[TestService.testMethod] Debug message', undefined);
    });

    it('should log debug message with data', () => {
      const data = { userId: 123, action: 'create' };
      service.testLogDebug('User action', data);

      expect(logger.debug).toHaveBeenCalledWith('[TestService.testMethod] User action', data);
    });

    it('should handle complex data objects', () => {
      const complexData = {
        user: { id: 1, name: 'John' },
        items: [1, 2, 3],
        metadata: { timestamp: Date.now() },
      };
      service.testLogDebug('Complex operation', complexData);

      expect(logger.debug).toHaveBeenCalledWith('[TestService.testMethod] Complex operation', complexData);
    });
  });

  describe('inheritance', () => {
    it('should work with multiple service classes', () => {
      class AnotherService extends BaseService {
        constructor() {
          super();
        }
      }

      jest.clearAllMocks();
      new AnotherService();

      expect(logger.info).toHaveBeenCalledWith('Initializing service: AnotherService');
    });

    it('should maintain separate logging contexts', () => {
      class UserService extends BaseService {
        constructor() {
          super();
        }

        logUserAction() {
          this.logInfo('getUser', 'Fetching user');
        }
      }

      jest.clearAllMocks();
      const userService = new UserService();
      userService.logUserAction();

      expect(logger.info).toHaveBeenCalledWith('[UserService.getUser] Fetching user');
    });
  });
});
