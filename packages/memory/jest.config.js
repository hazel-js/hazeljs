/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { skipLibCheck: true } }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/__tests__/**',
    '!src/generated/**',
    '!src/prisma.ts',
    '!src/prisma-client.ts',
    '!src/store/adapters/postgres.store.ts',
    '!src/store/adapters/redis.store.ts',
    '!src/store/adapters/prisma.store.ts',
    '!src/store/adapters/vector-episodic.store.ts',
    '!src/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'clover'],
  coverageThreshold: {
    global: { branches: 80, functions: 85, lines: 85, statements: 85 },
  },
  verbose: true,
  forceExit: true,
  detectOpenHandles: false,
};
