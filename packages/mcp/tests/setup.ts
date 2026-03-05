// Global test setup for @hazeljs/mcp
// Keep process.exit from actually terminating the test runner
jest.spyOn(process, 'exit').mockImplementation(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (() => { /* noop */ }) as any,
);
