/**
 * Dashboard - Example protected route
 *
 * This route is protected by the _authenticated layout.
 * Users must be logged in to access it.
 *
 * User info is accessed via useAuth() hook from the shared AuthProvider,
 * avoiding duplicate auth status fetches.
 */

import { createFileRoute } from '@tanstack/react-router';
import {
  Avatar,
  Box,
  Button,
  Card,
  Flex,
  HStack,
  Heading,
  Sidebar,
  SidebarNavGroup,
  SidebarNavItem,
  Text,
  VStack,
} from '@lib/ui';
import { useState } from 'react';
import {
  LuBookmark,
  LuChartBar,
  LuFileText,
  LuHistory,
  LuImage,
  LuLayoutDashboard,
  LuLogOut,
  LuMenu,
  LuSettings,
  LuUsers,
} from 'react-icons/lu';
import { logout } from '~/server/auth';
import { useAuth } from '~/providers/AuthProvider';

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: DashboardPage,
  head: () => ({
    meta: [
      { title: 'Dashboard' },
      { name: 'description', content: 'Your personal dashboard' },
    ],
  }),
});

// Logo component for sidebar header
function LogoIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="32" height="32" rx="6" fill="#319795" />
      <path
        d="M16 8L22 12V20L16 24L10 20V12L16 8Z"
        fill="white"
        fillOpacity="0.9"
      />
    </svg>
  );
}

// Sidebar header with logo
function SidebarHeader() {
  return (
    <HStack gap={3}>
      <LogoIcon />
      <Text fontWeight="bold" fontSize="lg">
        My App
      </Text>
    </HStack>
  );
}

// Sidebar navigation content
function SidebarNavContent() {
  return (
    <>
      <SidebarNavGroup title="Dashboard">
        <SidebarNavItem icon={<LuLayoutDashboard />} label="Overview" active />
        <SidebarNavItem icon={<LuChartBar />} label="Analytics" />
        <SidebarNavItem icon={<LuHistory />} label="History" />
        <SidebarNavItem icon={<LuBookmark />} label="Favorites" />
      </SidebarNavGroup>

      <SidebarNavGroup title="Content">
        <SidebarNavItem icon={<LuFileText />} label="Documents" />
        <SidebarNavItem icon={<LuImage />} label="Media" />
        <SidebarNavItem icon={<LuUsers />} label="Users" />
        <SidebarNavItem icon={<LuSettings />} label="Settings" />
      </SidebarNavGroup>
    </>
  );
}

// Main dashboard content
function DashboardContent() {
  const { user, onLogout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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
    <Box ml={{ base: 0, md: '280px' }} minH="100vh" bg="bg.subtle">
      {/* Top bar */}
      <Flex
        px={4}
        py={3}
        bg="bg"
        borderBottomWidth="1px"
        borderColor="border"
        alignItems="center"
        justifyContent="space-between"
      >
        <HStack gap={4}>
          <Sidebar.Trigger icon={LuMenu} />
          <Heading size="lg" display={{ base: 'none', sm: 'block' }}>
            Dashboard
          </Heading>
        </HStack>

        <HStack gap={3}>
          <HStack gap={2}>
            <Avatar.Root size="sm">
              {user?.picture && <Avatar.Image src={user.picture} />}
              <Avatar.Fallback>
                {user?.name?.[0] ?? user?.email?.[0] ?? '?'}
              </Avatar.Fallback>
            </Avatar.Root>
            <Text fontSize="sm" display={{ base: 'none', md: 'block' }}>
              {user?.name ?? user?.email ?? 'User'}
            </Text>
          </HStack>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            loading={isLoggingOut}
            aria-label="Sign out"
          >
            <LuLogOut />
            <Text display={{ base: 'none', sm: 'inline' }} ml={1}>
              Sign Out
            </Text>
          </Button>
        </HStack>
      </Flex>

      {/* Main content */}
      <Box p={{ base: 4, md: 6 }}>
        <VStack gap={6} align="stretch">
          <Card.Root>
            <Card.Header>
              <Heading size="md">Welcome!</Heading>
            </Card.Header>
            <Card.Body>
              <VStack gap={4} align="start">
                {user?.email ? (
                  <Text>
                    Signed in as: <strong>{user.email}</strong>
                  </Text>
                ) : user?.name ? (
                  <Text>
                    Signed in as: <strong>{user.name}</strong>
                  </Text>
                ) : (
                  <Text color="fg.muted">User info not available</Text>
                )}
                <Text color="fg.muted">
                  This is a protected page. Your session will automatically
                  refresh in the background. If your session expires, you will
                  be prompted to sign in again.
                </Text>
              </VStack>
            </Card.Body>
          </Card.Root>

          <Card.Root>
            <Card.Header>
              <Heading size="md">Token Refresh Info</Heading>
            </Card.Header>
            <Card.Body>
              <Text color="fg.muted" fontSize="sm">
                Your access tokens are automatically refreshed 5 minutes before
                they expire. If you leave this tab in the background, the
                refresh timer pauses. When you return, the app checks if your
                session is still valid and refreshes if needed.
              </Text>
            </Card.Body>
          </Card.Root>
        </VStack>
      </Box>
    </Box>
  );
}

function DashboardPage() {
  return (
    <Sidebar.Root header={<SidebarHeader />} mainContent={<DashboardContent />}>
      <SidebarNavContent />
    </Sidebar.Root>
  );
}
