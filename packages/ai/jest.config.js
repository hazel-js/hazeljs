/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        skipLibCheck: true,
        isolatedModules: true, // Faster compilation, skips type checking
        rootDir: '.', // Use package root instead of src
      },
    }],
  },
  moduleNameMapper: {
    '^@hazeljs/cache$': '<rootDir>/../cache/src/index.ts',
    '^@hazeljs/core$': '<rootDir>/../core/src/index.ts',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/__tests__/**',
    // Pure re-export barrels (no executable logic)
    '!src/index.ts',
    '!src/facades/index.ts',
    '!src/platform/index.ts',
    '!src/platform/hcel/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'clover'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  verbose: true,
  forceExit: true,
  detectOpenHandles: false,
  testTimeout: 10000,
};

