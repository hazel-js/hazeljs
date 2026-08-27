import '@hazeljs/core';

// Global test setup — replace console methods so Jest does not reprint expected error noise
beforeAll(() => {
  if (!process.env.DEBUG_TESTS) {
    const noop = (): void => undefined;
    console.log = noop;
    console.debug = noop;
    console.info = noop;
    console.warn = noop;
    console.error = noop;
  }
});
