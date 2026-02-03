import 'reflect-metadata';

// Global test setup
beforeAll(() => {
  // Suppress console logs during tests unless explicitly needed
  if (!process.env.DEBUG_TESTS) {
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'debug').mockImplementation();
    jest.spyOn(console, 'info').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  }
});

afterAll(() => {
  jest.restoreAllMocks();
});
