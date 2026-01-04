import type {} from '../.sst/types/index';

declare module 'sst/node/config' {
  export interface ParameterResources {
    COGNITO_USER_POOL_ID: {
      value: string;
    };
    COGNITO_CLIENT_ID: {
      value: string;
    };
  }
}
