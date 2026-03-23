/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: { skipLibCheck: true, isolatedModules: true },
    }],
  },
  moduleNameMapper: {
    '^@hazeljs/core$': '<rootDir>/../core/src/index.ts',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/index.ts',
    '!src/connectors/csv.connector.ts',
    '!src/connectors/http.connector.ts',
    '!src/connectors/postgres.connector.ts',
    '!src/connectors/connector.interface.ts',
    '!src/connectors/index.ts',
    '!src/streaming/flink/flink.client.ts',
    '!src/flink.service.ts',
    '!src/data.module.ts',
    '!src/telemetry/telemetry.ts',
    '!src/testing/index.ts',
    '!src/decorators/index.ts',
    '!src/decorators/pii.decorator.ts',
    '!src/streaming/flink/flink.job.ts',
    '!src/streaming/flink/flink.operators.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },
  coverageDirectory: 'coverage',
  verbose: true,
  forceExit: true,
  testTimeout: 10000,
};
