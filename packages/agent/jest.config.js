module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
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
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/decorators/approval.decorator.ts',
    '!src/testing/**',
    '!src/evaluation/**',
    // Covered by tests/platform/*; k8s client needs a live cluster and dilutes the global gate.
    '!src/platform/**',
  ],
  coverageThreshold: {
    global: {
      branches: 74,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'clover'],
  verbose: true,
  moduleNameMapper: {
    '^@hazeljs/core$': '<rootDir>/../core/src',
    '^@hazeljs/rag$': '<rootDir>/../rag/src',
    '^@hazeljs/eval$': '<rootDir>/src/testing/mocks/hazeljs-eval.ts',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
};
