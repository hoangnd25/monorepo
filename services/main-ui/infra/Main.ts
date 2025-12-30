import { StackContext } from 'sst/constructs';
import { NitroSite } from '@lib/sst-constructs';

export interface MainProps {
  appPath?: string;
}

export function Main(context: StackContext, props?: MainProps) {
  const { stack } = context;
  const appPath = props?.appPath ?? './app';

  const mainSite = new NitroSite(stack, 'MainSite', {
    path: appPath,
    buildCommand: 'pnpm build:app',
    dev: {
      deploy: false,
      url: 'http://localhost:3000',
    },
  });

  stack.addOutputs({
    MainSiteUrl: mainSite.url,
  });
}
