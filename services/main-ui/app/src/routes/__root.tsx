/// <reference types="vite/client" />
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router';
import { UIProvider } from '@lib/ui';
import React, { useEffect } from 'react';
import type { AuthStatus } from '~/providers/AuthProvider';
import type { RouterContext } from '~/router';
import { AuthProvider } from '~/providers/AuthProvider';
import { LoginModalProvider } from '~/providers/LoginModalProvider';
import { fetchAuthStatus } from '~/queries/auth/authStatus';

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  beforeLoad: async ({ context }) => {
    // Fetch auth status with caching - only makes server call on first load
    // Subsequent navigations use cached data
    const auth = await fetchAuthStatus(context.queryClient);
    return { auth };
  },
});

function RootComponent() {
  const { auth } = Route.useRouteContext();

  return (
    <RootDocument initialAuthStatus={auth}>
      <Outlet />
    </RootDocument>
  );
}

interface RootDocumentProps {
  children: React.ReactNode;
  initialAuthStatus: AuthStatus;
}

/**
 * Load Amazon Cognito Advanced Security script on client only.
 * This script is used for device fingerprinting in adaptive authentication.
 * Loading client-side avoids SSR hydration mismatches from injected classes.
 */
function useCognitoAdvancedSecurity() {
  useEffect(() => {
    const scriptId = 'cognito-advanced-security';
    if (document.getElementById(scriptId)) return;

    const script = document.createElement('script');
    script.id = scriptId;
    script.src =
      'https://amazon-cognito-assets.us-east-1.amazoncognito.com/amazon-cognito-advanced-security-data.min.js';
    document.body.appendChild(script);
  }, []);
}

function RootDocument({ children, initialAuthStatus }: RootDocumentProps) {
  useCognitoAdvancedSecurity();

  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <HeadContent />
      </head>
      <body>
        <UIProvider>
          <AuthProvider initialStatus={initialAuthStatus}>
            <LoginModalProvider>{children}</LoginModalProvider>
          </AuthProvider>
        </UIProvider>

        <ReactQueryDevtools buttonPosition="bottom-left" />
        <TanStackRouterDevtools position="bottom-right" />
        <Scripts />
      </body>
    </html>
  );
}
