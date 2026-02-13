/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  transform: { '^.+\\.tsx?$': 'ts-jest' },
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/kyc/store/pgKycStore.ts',
    '!src/kyc/store/prismaKycStore.ts',
    '!src/audit/sinks/pgAuditSink.ts',
    '!src/audit/sinks/prismaAuditSink.ts',
    '!src/kyc/providers/fetchHttpProvider.ts',
  ],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      statements: 85,
      branches: 70,
      functions: 80,
      lines: 85,
    },
  },
  verbose: true,
  maxWorkers: 1,
  forceExit: true,
};
