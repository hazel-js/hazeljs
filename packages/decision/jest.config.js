module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['reflect-metadata'],
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.jest.json',
      },
    ],
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/index.ts'],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'clover'],
  verbose: true,
  moduleNameMapper: {
    '^@hazeljs/agent$': '<rootDir>/../agent/src',
    '^@hazeljs/agent-gatekeeper$': '<rootDir>/../agent-gatekeeper/src',
    '^@hazeljs/skillgate$': '<rootDir>/../skillgate/src',
    '^@hazeljs/core$': '<rootDir>/../core/src',
  },
};
