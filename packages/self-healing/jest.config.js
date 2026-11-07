module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['reflect-metadata', '<rootDir>/jest.env.js'],
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/__tests__/**',
    '!src/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 70,
      lines: 80,
      statements: 80,
    },
  },
  forceExit: true,
  detectOpenHandles: false,
};
