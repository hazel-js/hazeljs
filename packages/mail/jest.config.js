/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['reflect-metadata'],
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          skipLibCheck: true,
        },
      },
    ],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/index.ts',
    '!src/providers/index.ts',
    '!src/render/mjml.renderer.ts',
    '!src/render/handlebars.adapter.ts',
    '!src/providers/smtp.provider.ts',
    '!src/providers/ses.provider.ts',
    '!src/providers/resend.provider.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'clover'],
  coverageThreshold: {
    global: {
      branches: 55,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  verbose: true,
  forceExit: true,
  detectOpenHandles: false,
};
