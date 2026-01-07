import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Box, Card, Center, Heading, Spinner, Text, VStack } from '@lib/ui';
import { processMagicLink } from '~/server/auth';
import { useCognitoContextData } from '~/hooks/useCognitoContextData';

export const Route = createFileRoute('/auth/magic-link')({
  // No validateSearch - we parse hash fragment on client side
  component: RouteComponent,
  head: () => ({
    meta: [
      { title: 'Signing In...' },
      { name: 'description', content: 'Completing your sign in' },
    ],
  }),
});

function RouteComponent() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading'
  );
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const { getEncodedData, isCognitoContextReady } = useCognitoContextData();

  useEffect(() => {
    const completeAuth = async () => {
      // Extract hash from URL - all processing logic is on server
      const hash = window.location.hash.slice(1); // Remove leading '#'
      const redirectUri = `${window.location.origin}/auth/magic-link`;

      // Extract username from hash for device fingerprinting
      // The hash format is: base64url(JSON).signature
      let username = '';
      try {
        const [messageB64] = hash.split('.');
        if (messageB64) {
          const message = JSON.parse(
            atob(messageB64.replace(/-/g, '+').replace(/_/g, '/'))
          );
          username = message.userName || '';
        }
      } catch {
        // If parsing fails, proceed without username (fingerprint will be less accurate)
      }

      // Collect device fingerprint data for Cognito adaptive authentication
      const encodedData = getEncodedData(username);

      const result = await processMagicLink({
        data: { hash, redirectUri, encodedData },
      });

      if (result.success) {
        // Clean up URL (remove hash fragment)
        window.history.replaceState(null, '', window.location.pathname);
        setStatus('success');

        // Full page redirect to ensure fresh auth state is loaded
        // Client-side navigation would keep stale AuthProvider state
        window.location.href = result.redirectPath;
      } else {
        console.error('Magic link processing failed:', result.error);
        setStatus('error');
        setErrorMessage(result.error);
      }
    };

    isCognitoContextReady && completeAuth();
  }, [getEncodedData, isCognitoContextReady]);

  return (
    <Center minH="100vh" bg="gray.50">
      <Box w="full" maxW="md" p={8}>
        <Card.Root>
          <Card.Body>
            <VStack gap={6} textAlign="center">
              {status === 'loading' && (
                <>
                  <Spinner size="xl" color="blue.500" />
                  <Heading size="lg">Signing you in...</Heading>
                  <Text color="gray.600">Please wait a moment</Text>
                </>
              )}

              {status === 'success' && (
                <>
                  <Heading size="lg">Success!</Heading>
                  <Text color="gray.600">
                    You&apos;ve been signed in. Redirecting...
                  </Text>
                </>
              )}

              {status === 'error' && (
                <>
                  <Heading size="lg" color="red.600">
                    Sign in failed
                  </Heading>
                  <Text color="gray.600">{errorMessage}</Text>
                  <Text fontSize="sm" color="gray.500">
                    Please try requesting a new magic link.
                  </Text>
                </>
              )}
            </VStack>
          </Card.Body>
        </Card.Root>
      </Box>
    </Center>
  );
}
