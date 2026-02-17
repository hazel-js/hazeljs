/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          skipLibCheck: true,
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
        },
      },
    ],
  },
  moduleNameMapper: {
    '^@hazeljs/ai$': '<rootDir>/../ai/src/index.ts',
    '^@hazeljs/core$': '<rootDir>/../core/src/index.ts',
    '^@hazeljs/queue$': '<rootDir>/../queue/src/index.ts',
    '^@hazeljs/rag$': '<rootDir>/../rag/src/index.ts',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/__tests__/**',
  ],
  coverageThreshold: {
    global: {
      branches: 45,
      functions: 60,
      lines: 70,
      statements: 72,
    },
  },
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'clover'],
  verbose: true,
  forceExit: true,
  detectOpenHandles: false,
};
