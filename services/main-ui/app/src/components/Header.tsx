import {
  Avatar,
  Box,
  Button,
  CloseButton,
  Container,
  Drawer,
  Flex,
  HStack,
  Icon,
  IconButton,
  Menu,
  Portal,
  Separator,
  Text,
  VStack,
} from '@lib/ui';
import { Link } from '@tanstack/react-router';
import { useCallback, useState } from 'react';
import { LuMenu, LuSparkles } from 'react-icons/lu';
import { CustomLink } from './CustomLink';
import { useLoginModal } from '~/providers/LoginModalProvider';
import { useAuth } from '~/providers/AuthProvider';
import { getAuthStatus, logout } from '~/server/auth';

export function Header() {
  const { openLoginModal, closeLoginModal } = useLoginModal();
  const { user, isAuthenticated, onLoginSuccess, onLogout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLoginSuccess = useCallback(async () => {
    const status = await getAuthStatus();
    if (status.isAuthenticated) {
      onLoginSuccess(status);
      closeLoginModal();
    }
  }, [onLoginSuccess, closeLoginModal]);

  const handleLogin = useCallback(() => {
    openLoginModal({ onSuccess: handleLoginSuccess });
  }, [openLoginModal, handleLoginSuccess]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      onLogout();
      window.location.href = '/';
    } catch (error) {
      console.error('Logout failed:', error);
      setIsLoggingOut(false);
    }
  };

  return (
    <>
      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        style={{
          position: 'absolute',
          left: '-9999px',
          zIndex: 200,
          padding: '8px 16px',
          backgroundColor: 'var(--chakra-colors-teal-500)',
          color: 'white',
          fontWeight: 600,
          borderRadius: '6px',
        }}
        onFocus={(e) => {
          e.currentTarget.style.left = '16px';
          e.currentTarget.style.top = '16px';
        }}
        onBlur={(e) => {
          e.currentTarget.style.left = '-9999px';
        }}
      >
        Skip to main content
      </a>

      <Box
        as="header"
        bg="bg"
        borderBottomWidth="1px"
        borderColor="border"
        position="sticky"
        top={0}
        zIndex={100}
      >
        <Container maxW="container.xl">
          <Flex h={16} alignItems="center" justifyContent="space-between">
            {/* Logo */}
            <Link to="/">
              <HStack gap={2}>
                <Box
                  bg="teal.500"
                  color="white"
                  p={1.5}
                  borderRadius="lg"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Icon boxSize={4}>
                    <LuSparkles />
                  </Icon>
                </Box>
                <Text fontWeight="bold" fontSize="xl" color="fg">
                  Nova AI
                </Text>
              </HStack>
            </Link>

            {/* Navigation */}
            <HStack
              as="nav"
              gap={8}
              aria-label="Main navigation"
              display={{ base: 'none', md: 'flex' }}
            >
              <CustomLink to="/">Features</CustomLink>
              <a
                href="#pricing"
                style={{ color: 'inherit', textDecoration: 'none' }}
              >
                <Text
                  color="fg.muted"
                  fontWeight="medium"
                  _hover={{ color: 'fg' }}
                  transition="color 0.2s"
                >
                  Pricing
                </Text>
              </a>
              <CustomLink to="/about">About</CustomLink>
              <CustomLink to="/dashboard">Dashboard</CustomLink>
            </HStack>

            {/* Auth */}
            <HStack gap={3}>
              {isAuthenticated ? (
                <Menu.Root>
                  <Menu.Trigger asChild>
                    <Button variant="ghost" size="sm" px={2}>
                      <HStack gap={2}>
                        <Avatar.Root size="xs">
                          {user?.picture && <Avatar.Image src={user.picture} />}
                          <Avatar.Fallback>
                            {user?.name?.[0] ?? user?.email?.[0] ?? '?'}
                          </Avatar.Fallback>
                        </Avatar.Root>
                        <Text display={{ base: 'none', md: 'block' }}>
                          {user?.name ?? user?.email ?? 'User'}
                        </Text>
                      </HStack>
                    </Button>
                  </Menu.Trigger>
                  <Portal>
                    <Menu.Positioner>
                      <Menu.Content>
                        <Menu.Item value="dashboard" asChild>
                          <Link to="/dashboard">Dashboard</Link>
                        </Menu.Item>
                        <Menu.Separator />
                        <Menu.Item
                          value="logout"
                          onClick={handleLogout}
                          disabled={isLoggingOut}
                        >
                          {isLoggingOut ? 'Signing out...' : 'Sign Out'}
                        </Menu.Item>
                      </Menu.Content>
                    </Menu.Positioner>
                  </Portal>
                </Menu.Root>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    onClick={handleLogin}
                    size="sm"
                    display={{ base: 'none', md: 'flex' }}
                  >
                    Login
                  </Button>
                  <Button colorPalette="teal" size="sm">
                    Get Started Free
                  </Button>
                </>
              )}

              {/* Mobile menu button */}
              <IconButton
                aria-label="Open menu"
                variant="ghost"
                size="sm"
                display={{ base: 'flex', md: 'none' }}
                onClick={() => setMobileMenuOpen(true)}
              >
                <Icon>
                  <LuMenu />
                </Icon>
              </IconButton>
            </HStack>
          </Flex>
        </Container>

        {/* Mobile Navigation Drawer */}
        <Drawer.Root
          open={mobileMenuOpen}
          onOpenChange={(e) => setMobileMenuOpen(e.open)}
          placement="end"
        >
          <Portal>
            <Drawer.Backdrop />
            <Drawer.Positioner>
              <Drawer.Content>
                <Drawer.Header borderBottomWidth="1px" borderColor="border">
                  <Drawer.Title>
                    <Link to="/" onClick={() => setMobileMenuOpen(false)}>
                      <HStack gap={2}>
                        <Box
                          bg="teal.500"
                          color="white"
                          p={1.5}
                          borderRadius="lg"
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                        >
                          <Icon boxSize={4}>
                            <LuSparkles />
                          </Icon>
                        </Box>
                        <Text fontWeight="bold" fontSize="xl">
                          Nova AI
                        </Text>
                      </HStack>
                    </Link>
                  </Drawer.Title>
                  <Drawer.CloseTrigger asChild>
                    <CloseButton size="sm" />
                  </Drawer.CloseTrigger>
                </Drawer.Header>
                <Drawer.Body py={6}>
                  <VStack
                    as="nav"
                    align="stretch"
                    gap={1}
                    aria-label="Mobile navigation"
                  >
                    <Link to="/" onClick={() => setMobileMenuOpen(false)}>
                      <Box
                        py={3}
                        px={4}
                        borderRadius="md"
                        _hover={{ bg: 'bg.muted' }}
                        fontWeight="medium"
                      >
                        Features
                      </Box>
                    </Link>
                    <a
                      href="#pricing"
                      onClick={() => setMobileMenuOpen(false)}
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      <Box
                        py={3}
                        px={4}
                        borderRadius="md"
                        _hover={{ bg: 'bg.muted' }}
                        fontWeight="medium"
                      >
                        Pricing
                      </Box>
                    </a>
                    <Link to="/about" onClick={() => setMobileMenuOpen(false)}>
                      <Box
                        py={3}
                        px={4}
                        borderRadius="md"
                        _hover={{ bg: 'bg.muted' }}
                        fontWeight="medium"
                      >
                        About
                      </Box>
                    </Link>
                    <Link
                      to="/dashboard"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Box
                        py={3}
                        px={4}
                        borderRadius="md"
                        _hover={{ bg: 'bg.muted' }}
                        fontWeight="medium"
                      >
                        Dashboard
                      </Box>
                    </Link>

                    <Separator my={4} />

                    {isAuthenticated ? (
                      <>
                        <Box px={4} py={2}>
                          <HStack gap={3}>
                            <Avatar.Root size="sm">
                              {user?.picture && (
                                <Avatar.Image src={user.picture} />
                              )}
                              <Avatar.Fallback>
                                {user?.name?.[0] ?? user?.email?.[0] ?? '?'}
                              </Avatar.Fallback>
                            </Avatar.Root>
                            <Text fontWeight="medium">
                              {user?.name ?? user?.email ?? 'User'}
                            </Text>
                          </HStack>
                        </Box>
                        <Button
                          variant="ghost"
                          justifyContent="flex-start"
                          onClick={() => {
                            setMobileMenuOpen(false);
                            handleLogout();
                          }}
                          disabled={isLoggingOut}
                        >
                          {isLoggingOut ? 'Signing out...' : 'Sign Out'}
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        justifyContent="flex-start"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          handleLogin();
                        }}
                      >
                        Login
                      </Button>
                    )}
                  </VStack>
                </Drawer.Body>
                <Drawer.Footer borderTopWidth="1px" borderColor="border">
                  <Button
                    colorPalette="teal"
                    w="full"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Get Started Free
                  </Button>
                </Drawer.Footer>
              </Drawer.Content>
            </Drawer.Positioner>
          </Portal>
        </Drawer.Root>
      </Box>
    </>
  );
}
