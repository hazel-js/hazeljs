// Mock logger to suppress logs during tests
jest.mock('./src/logger', () => {
  const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    http: jest.fn(),
    silly: jest.fn(),
  };
  return {
    __esModule: true,
    default: mockLogger,
  };
});

