// Mock logger from @hazeljs/core - consumer imports `import logger from '@hazeljs/core'`
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  http: jest.fn(),
};

jest.mock('@hazeljs/core', () => {
  const actual = jest.requireActual('@hazeljs/core');
  return new Proxy(actual, {
    get(target, prop) {
      if (prop === 'logger' || prop === 'default') return mockLogger;
      return target[prop];
    },
  });
});

// Mock @hazeljs/kafka decorators for tests that load messaging-kafka.consumer
jest.mock('@hazeljs/kafka', () => ({
  KafkaConsumer: () => () => {},
  KafkaSubscribe: () => (target, key, descriptor) => descriptor,
  KafkaMessagePayload: {},
}));
