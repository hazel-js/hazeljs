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
        },
      },
    ],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/index.ts',
    '!src/realtime.module.ts',
    '!src/realtime-bootstrap.service.ts',
    '!src/providers/openai/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'clover'],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    './src/realtime.gateway.ts': {
      branches: 50,
    },
  },
  verbose: true,
  forceExit: true,
  detectOpenHandles: false,
  testTimeout: 10000,
  moduleNameMapper: {
    '^@hazeljs/core$': '<rootDir>/../core/src',
    '^@hazeljs/websocket$': '<rootDir>/../websocket/dist',
  },
};
