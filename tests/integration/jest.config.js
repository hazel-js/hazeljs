/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/*.integration.test.ts'],
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
    '^@hazeljs/core$': '<rootDir>/../../packages/core/src/index.ts',
    '^@hazeljs/config$': '<rootDir>/../../packages/config/src/index.ts',
    '^@hazeljs/auth$': '<rootDir>/../../packages/auth/src/index.ts',
    '^@hazeljs/cache$': '<rootDir>/../../packages/cache/src/index.ts',
    '^@hazeljs/ai$': '<rootDir>/../../packages/ai/src/index.ts',
    '^@hazeljs/prompts$': '<rootDir>/../../packages/prompts/src/index.ts',
  },
  verbose: true,
  forceExit: true,
  detectOpenHandles: false,
};
