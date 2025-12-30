import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    fileParallelism: false,
    hookTimeout: 30000,
    testTimeout: 30000,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    env: {
      SST_STAGE: 'test',
      SST_APP: 'test-app',
    },
  },
});
