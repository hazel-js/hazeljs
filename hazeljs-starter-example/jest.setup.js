const winston = require('winston');

// Create a custom logger for tests
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf(({ level, message, timestamp }) => {
      const now = new Date();
      return `[${now.toLocaleDateString()} ${now.toLocaleTimeString()}] ${level}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Add custom matchers
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});

// Add custom test utilities
global.testUtils = {
  async waitFor(condition, timeout = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await condition()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Condition not met within ${timeout}ms`);
  },
};
// Add test lifecycle hooks
beforeAll(() => {
  const now = new Date();
  logger.info('\n' + '='.repeat(80));
  logger.info(`Test Suite Started at: ${now.toLocaleString()}`);
  logger.info(`Date: ${now.toLocaleDateString()}`);
  logger.info(`Time: ${now.toLocaleTimeString()}`);
  logger.info('='.repeat(80) + '\n');
  logger.info('🚀 Starting test suite...');
});

afterAll(() => {
  const now = new Date();
  logger.info('\n' + '='.repeat(80));
  logger.info(`Test Suite Completed at: ${now.toLocaleString()}`);
  logger.info(`Date: ${now.toLocaleDateString()}`);
  logger.info(`Time: ${now.toLocaleTimeString()}`);
  logger.info('='.repeat(80) + '\n');
  logger.info('✨ Test suite completed!');
});

beforeEach(() => {
  const now = new Date();
  logger.info(`\n[${now.toLocaleTimeString()}] 📝 Running test...`);
});

afterEach(() => {
  const now = new Date();
  logger.info(`[${now.toLocaleTimeString()}] ✅ Test completed!`);
}); 