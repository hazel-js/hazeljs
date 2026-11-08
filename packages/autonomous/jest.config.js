/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['reflect-metadata'],
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
        },
      },
    ],
  },
  // Resolve workspace packages from dist (built) — avoids rootDir conflicts with source paths.
  moduleNameMapper: {
    '^@hazeljs/core$': '<rootDir>/../core/dist/index.js',
    '^@hazeljs/agent$': '<rootDir>/../agent/dist/index.js',
    '^@hazeljs/agent-gatekeeper$': '<rootDir>/../agent-gatekeeper/dist/index.js',
    '^@hazeljs/agent-vm$': '<rootDir>/../agent-vm/dist/index.js',
    '^@hazeljs/decision$': '<rootDir>/../decision/dist/index.js',
    '^@hazeljs/event-emitter$': '<rootDir>/../event-emitter/dist/index.js',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'clover'],
  verbose: true,
  forceExit: true,
};
