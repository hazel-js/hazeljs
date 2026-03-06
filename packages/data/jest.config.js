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
  ],
  coverageThreshold: {
    global: {
      branches: 40,
      functions: 45,
      lines: 50,
      statements: 50,
    },
  },
  coverageDirectory: 'coverage',
  verbose: true,
  forceExit: true,
  testTimeout: 10000,
};
