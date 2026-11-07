/**
 * Replace @hazeljs/core default logger so INFO/WARN from AIEnhancedService stay quiet.
 */
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  http: jest.fn(),
  silly: jest.fn(),
};

jest.mock('@hazeljs/core', () => {
  const actual = jest.requireActual('@hazeljs/core');
  return new Proxy(actual, {
    get(target, prop) {
      if (prop === 'logger' || prop === 'default') return mockLogger;
      return Reflect.get(target, prop);
    },
  });
});
