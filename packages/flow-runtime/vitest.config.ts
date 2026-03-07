import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    setupFiles: ['test/setup.ts'],
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'clover'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/main.ts',
        'src/flows/demo_fraud_flow.ts',
        'src/flows/demo_support_flow.ts',
      ],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@hazeljs/core': path.resolve(__dirname, '../core/dist/index.js'),
      '@hazeljs/flow': path.resolve(__dirname, '../flow/dist/index.js'),
    },
  },
});
