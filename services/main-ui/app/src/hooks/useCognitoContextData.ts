import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cognitoConfigQueryOptions } from '~/queries/cognito/cognitoConfig';

/**
 * Maximum time to wait for the Cognito Advanced Security library to load (in ms)
 */
const LIBRARY_LOAD_TIMEOUT = 1000;

/**
 * Interval to check for library availability (in ms)
 */
const LIBRARY_CHECK_INTERVAL = 100;

/**
 * Augment the global Window interface with the Cognito Advanced Security library
 */
declare global {
  interface Window {
    AmazonCognitoAdvancedSecurityData?: {
      /**
       * Collects device fingerprint data for Cognito adaptive authentication
       * @param username - The username (email) being authenticated
       * @param userPoolId - The Cognito User Pool ID
       * @param clientId - The Cognito App Client ID
       * @returns Base64-encoded device fingerprint data
       */
      getData: (
        username: string,
        userPoolId: string,
        clientId: string
      ) => string;
    };
  }
}

/**
 * Hook to collect Cognito context data for adaptive authentication
 *
 * Uses the Amazon Cognito Advanced Security library (loaded via CDN in __root.tsx)
 * to collect device fingerprint data that helps Cognito assess sign-in risk.
 *
 * The Cognito configuration (User Pool ID, Client ID) is prefetched during SSR
 * in __root.tsx beforeLoad, then accessed via useQuery. This approach avoids
 * suspending inside Dialogs which would interfere with Zag.js DOM references.
 *
 * @see https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pool-settings-adaptive-authentication.html
 *
 * @example
 * ```tsx
 * const { getEncodedData } = useCognitoContextData();
 *
 * const handleLogin = async (email: string) => {
 *   const encodedData = getEncodedData(email);
 *   await initiateMagicLink({ email, encodedData });
 * };
 * ```
 */
export function useCognitoContextData() {
  const { data: cognitoConfig, isLoading: isLoadingCognitoConfig } = useQuery(
    cognitoConfigQueryOptions
  );

  const [isLibraryLoaded, setIsLibraryLoaded] = useState(() => {
    // Check if already available on initial render (client-side only)
    if (typeof window !== 'undefined') {
      return !!window.AmazonCognitoAdvancedSecurityData;
    }
    return false;
  });

  useEffect(() => {
    // Skip if already loaded or in SSR
    if (isLibraryLoaded || typeof window === 'undefined') {
      return;
    }

    // Poll for the library to become available
    // Check immediately on first interval tick, then continue polling
    const startTime = Date.now();
    const intervalId = setInterval(() => {
      if (window.AmazonCognitoAdvancedSecurityData) {
        setIsLibraryLoaded(true);
        clearInterval(intervalId);
      } else if (Date.now() - startTime >= LIBRARY_LOAD_TIMEOUT) {
        // Give up after timeout
        console.warn(
          'Cognito Advanced Security library did not load within timeout. Device fingerprinting disabled.'
        );
        clearInterval(intervalId);
      }
    }, LIBRARY_CHECK_INTERVAL);

    return () => clearInterval(intervalId);
  }, [isLibraryLoaded]);

  /**
   * Get encoded device fingerprint data for the given username
   *
   * @param username - The username (typically email) being authenticated.
   *                   Can be empty string if username is not yet known (e.g., social login initiation)
   * @returns Encoded device fingerprint data, or undefined if library not loaded or config unavailable
   */
  const getEncodedData = useCallback(
    (username: string): string | undefined => {
      if (typeof window === 'undefined') {
        // SSR context - no window available
        return undefined;
      }

      if (!window.AmazonCognitoAdvancedSecurityData) {
        // Library not loaded (possibly blocked by ad blocker or not yet loaded)
        console.warn(
          'Cognito Advanced Security library not loaded. Device fingerprinting disabled.'
        );
        return undefined;
      }

      try {
        if (
          !cognitoConfig ||
          !cognitoConfig.userPoolId ||
          !cognitoConfig.clientId
        ) {
          console.warn(
            'Cognito User Pool ID or Client ID not configured. Device fingerprinting disabled.'
          );
          return undefined;
        }

        return window.AmazonCognitoAdvancedSecurityData.getData(
          username,
          cognitoConfig.userPoolId,
          cognitoConfig.clientId
        );
      } catch (error) {
        console.error('Error collecting Cognito context data:', error);
        return undefined;
      }
    },
    [cognitoConfig]
  );

  return {
    getEncodedData,
    isLoadingCognitoConfig,
    isLibraryLoaded,
    isCognitoContextReady:
      isLibraryLoaded && !isLoadingCognitoConfig && !!cognitoConfig,
  };
}
