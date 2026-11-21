/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  setupFiles: ['reflect-metadata'],
  globalSetup: '<rootDir>/tests/global-setup.js',
  reporters: ['default', '<rootDir>/tests/conformance-reporter.js'],
  testTimeout: 90_000,
  maxWorkers: 1,
  // HazeldServer leaves timers/metrics handles; same as other hazeljs packages.
  forceExit: true,
};
