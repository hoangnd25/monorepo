import { createFileRoute } from '@tanstack/react-router';
import { Box, Card, Center, VStack } from '@lib/ui';
import z from 'zod';
import { LoginFormContainer } from '~/components/LoginFormContainer';

export const Route = createFileRoute('/login')({
  validateSearch: z.object({
    redirect: z.string().optional(),
  }),
  component: RouteComponent,
  head: () => ({
    meta: [
      {
        title: 'Sign In',
      },
      {
        name: 'description',
        content: 'Sign in to your account',
      },
    ],
  }),
});

function RouteComponent() {
  const { redirect } = Route.useSearch();

  return (
    <Center minH="100vh" bg="gray.50">
      <Box w="full" maxW="lg" p={8}>
        <Card.Root>
          <Card.Body>
            <VStack gap={6}>
              <LoginFormContainer redirectPath={redirect || '/'} />
            </VStack>
          </Card.Body>
        </Card.Root>
      </Box>
    </Center>
  );
}
