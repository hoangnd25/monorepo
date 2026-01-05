import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Box, Card, Center, Heading, Spinner, Text, VStack } from '@lib/ui';
import {
  completeMagicLink,
  getRedirectPath,
  initiateMagicLink,
} from '~/server/auth';

export const Route = createFileRoute('/auth/callback')({
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
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading'
  );
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  useEffect(() => {
    const completeAuth = async () => {
      try {
        // Parse hash fragment for magic link secret
        const hash = window.location.hash.slice(1); // Remove leading '#'
        if (!hash) {
          throw new Error('No magic link data found in URL');
        }

        // Extract email from secret for cross-browser fallback
        const [messageB64] = hash.split('.');
        const message = JSON.parse(
          Buffer.from(messageB64, 'base64url').toString()
        );
        const email = message.userName;

        // First attempt: Try to complete with session from HttpOnly cookie (same-browser)
        let result = await completeMagicLink({
          data: { secret: hash },
        });

        // Cross-browser case: No session cookie exists, initiate new auth to get session
        if (
          !result.success &&
          result.error &&
          result.error.includes('No session found')
        ) {
          const redirectUri = `${window.location.origin}/auth/callback`;
          const initiateResult = await initiateMagicLink({
            data: { email, redirectUri },
          });

          if (!initiateResult.success) {
            throw new Error('Failed to initiate authentication session');
          }

          // Try again with the session we just obtained (stored in HttpOnly cookie by server)
          result = await completeMagicLink({
            data: { secret: hash },
          });
        }

        if (!result.success) {
          throw new Error(result.error || 'Authentication failed');
        }

        // Store tokens
        // TODO: Consider using httpOnly cookies set by the server for token storage
        localStorage.setItem('authTokens', JSON.stringify(result.tokens));

        // Get redirect path from server (reads from HttpOnly cookie)
        const redirectPath = await getRedirectPath();

        // Clean up URL (remove hash fragment)
        window.history.replaceState(null, '', window.location.pathname);

        setStatus('success');

        // Redirect to the original destination
        setTimeout(() => {
          navigate({ to: redirectPath });
        }, 1000);
      } catch (error) {
        console.error('Magic link completion failed:', error);
        setStatus('error');
        setErrorMessage(
          error instanceof Error ? error.message : 'Authentication failed'
        );
      }
    };

    completeAuth();
  }, [navigate]);

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
