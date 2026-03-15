module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@hazeljs/core$': '<rootDir>/../core/src',
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/ui/**', '!src/**/*.d.ts'],
};
