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
        'src/examples/**',
        'src/generated/**',
        'src/types/FlowTypes.ts',
        'src/types/Events.ts',
        'src/persistence/prisma.ts',
        'src/persistence/prismaClient.ts',
      ],
      thresholds: {
        statements: 80,
        branches: 78,
        functions: 80,
        lines: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
