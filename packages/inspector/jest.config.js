module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@hazeljs/core$': '<rootDir>/../core/dist',
  },
  collectCoverageFrom: [
    'src/registry/**/*.ts',
    'src/config/**/*.ts',
    'src/service/**/*.ts',
    'src/runtime/**/*.ts',
    '!src/**/*.d.ts',
  ],
  coverageThreshold: {
    global: {
      statements: 85,
      branches: 80,
      functions: 85,
      lines: 85,
    },
  },
};
