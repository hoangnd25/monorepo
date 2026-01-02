import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    fileParallelism: false,
    hookTimeout: 60000,
    testTimeout: 30000,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // No global setup for unit tests
    coverage: {
      provider: 'v8',
      reporter: [['lcov', { projectRoot: '../../../' }], 'text'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/index.ts',
      ],
    },
  },
});
