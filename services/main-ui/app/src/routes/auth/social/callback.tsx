import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import * as z from 'zod';
import { Box, Card, Center, Heading, Spinner, Text, VStack } from '@lib/ui';
import { processSocialCallback } from '~/server/auth';

// OAuth callback can have either success params (code, state) or error params
const searchSchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

type SearchParams = z.infer<typeof searchSchema>;

export const Route = createFileRoute('/auth/social/callback')({
  validateSearch: (search): SearchParams => searchSchema.parse(search),
  component: RouteComponent,
  head: () => ({
    meta: [
      { title: 'Signing In...' },
      { name: 'description', content: 'Completing your social sign in' },
    ],
  }),
});

function RouteComponent() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading'
  );
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  useEffect(() => {
    const completeAuth = async () => {
      // Check for OAuth error from provider
      if (search.error) {
        setStatus('error');
        setErrorMessage(
          search.error_description ||
            search.error ||
            'Authentication was cancelled or failed'
        );
        return;
      }

      // Validate required params for success case
      if (!search.code || !search.state) {
        setStatus('error');
        setErrorMessage('Missing required callback parameters');
        return;
      }

      // Process the callback with auth service
      const result = await processSocialCallback({
        data: {
          code: search.code,
          state: search.state,
        },
      });

      if (result.success) {
        // Clean up URL (remove query params)
        window.history.replaceState(null, '', window.location.pathname);
        setStatus('success');

        // Redirect to the original destination
        navigate({ to: result.redirectPath });
      } else {
        console.error('Social login processing failed:', result.error);
        setStatus('error');
        setErrorMessage(result.error);
      }
    };

    completeAuth();
  }, [navigate, search]);

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
                    Please try signing in again.
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
