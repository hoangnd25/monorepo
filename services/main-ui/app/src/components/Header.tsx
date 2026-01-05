import { useState } from 'react';
import {
  Box,
  Button,
  CloseButton,
  Dialog,
  Flex,
  HStack,
  Portal,
} from '@lib/ui';
import { CustomLink } from './CustomLink';
import { LoginFormContainer } from './LoginFormContainer';

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

      <Portal>
        <Dialog.Root
          open={isLoginOpen}
          onOpenChange={(e) => setIsLoginOpen(e.open)}
          closeOnEscape={true}
          closeOnInteractOutside={true}
          placement="center"
          size={{ mdDown: 'full', base: 'sm' }}
        >
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.CloseTrigger
                position="absolute"
                top="2"
                insetEnd="2"
                asChild
              >
                <CloseButton />
              </Dialog.CloseTrigger>
              <Dialog.Body p={{ base: 6, md: 8 }}>
                <LoginFormContainer
                  redirectPath="/"
                  onSuccess={() => setIsLoginOpen(false)}
                />
              </Dialog.Body>
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Root>
      </Portal>
    </>
  );
}
