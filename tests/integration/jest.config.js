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
        // Path aliases are resolved via moduleNameMapper; skip TS module resolution noise.
        diagnostics: false,
        tsconfig: {
          skipLibCheck: true,
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
        },
      },
    ],
  },
  moduleNameMapper: {
    // Resolve from this package (CI installs via `npm ci` in tests/integration).
    '^zod$': '<rootDir>/node_modules/zod',
    '^@hazeljs/core$': '<rootDir>/../../packages/core/src/index.ts',
    '^@hazeljs/config$': '<rootDir>/../../packages/config/src/index.ts',
    '^@hazeljs/auth$': '<rootDir>/../../packages/auth/src/index.ts',
    '^@hazeljs/cache$': '<rootDir>/../../packages/cache/src/index.ts',
    '^@hazeljs/ai$': '<rootDir>/../../packages/ai/src/index.ts',
    '^@hazeljs/prompts$': '<rootDir>/../../packages/prompts/src/index.ts',
    // Upgrade-smoke suite imports built packages (CI builds before integration).
    '^@hazeljs/agent-gatekeeper$': '<rootDir>/../../packages/agent-gatekeeper/dist/index.js',
    '^@hazeljs/decision$': '<rootDir>/../../packages/decision/dist/index.js',
    '^@hazeljs/observability$': '<rootDir>/../../packages/observability/dist/index.js',
    '^@hazeljs/flow$': '<rootDir>/../../packages/flow/dist/index.js',
    '^@hazeljs/flow/prisma$': '<rootDir>/../../packages/flow/dist/prisma.js',
    '^@hazeljs/flow-runtime$': '<rootDir>/../../packages/flow-runtime/dist/index.js',
  },
  verbose: true,
  forceExit: true,
  detectOpenHandles: false,
};
