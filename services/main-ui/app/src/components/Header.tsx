import { useState } from 'react';
import { Box, Button, Flex, HStack, LoginDialog } from '@lib/ui';
import { FaGoogle } from 'react-icons/fa';
import { CustomLink } from './CustomLink';

export function Header() {
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  return (
    <>
      <Box
        as="header"
        bg="blue.500"
        color="white"
        px={4}
        borderBottom="1px solid"
        borderColor="blue.600"
      >
        <Flex h={16} alignItems="center" justifyContent="space-between">
          <HStack as="nav" gap={4} aria-label="Main navigation">
            <CustomLink to="/">Home</CustomLink>
            <CustomLink to="/about">About</CustomLink>
          </HStack>

          <Button
            variant="subtle"
            onClick={() => setIsLoginOpen(true)}
            size="sm"
          >
            Login
          </Button>
        </Flex>
      </Box>

      <LoginDialog
        showSignUpLink={false}
        socialProviders={[
          {
            id: 'google',
            label: 'Sign in with Google',
            icon: <FaGoogle />,
            onClick: () => {},
          },
        ]}
        open={isLoginOpen}
        onOpenChange={setIsLoginOpen}
        onSubmit={(_email, _password) => {}}
      />
    </>
  );
}
