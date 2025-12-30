import nodeConfig from '@config/eslint/node';

export default [
  ...nodeConfig,
  {
    ignores: ['sst-env.d.ts', 'sst.config.ts'],
  },
];
