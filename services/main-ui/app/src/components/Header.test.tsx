import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Header } from './Header';
import type { AuthStatus } from '~/providers/AuthProvider';
import { LoginModalProvider } from '~/providers/LoginModalProvider';
import { AuthProvider } from '~/providers/AuthProvider';
import { render } from '~/test/test-utils';

// Mock initial auth status for tests
const mockInitialAuthStatus: AuthStatus = {
  isAuthenticated: false,
  canRefresh: false,
  expiresAt: null,
  user: null,
};

// Helper to render with router context and providers
async function renderWithRouter(authStatus = mockInitialAuthStatus) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const rootRoute = createRootRoute({
    component: () => (
      <QueryClientProvider client={queryClient}>
        <AuthProvider initialStatus={authStatus}>
          <LoginModalProvider>
            <Header />
            <Outlet />
          </LoginModalProvider>
        </AuthProvider>
      </QueryClientProvider>
    ),
  });

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => <div>Home Page</div>,
  });

  const aboutRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/about',
    component: () => <div>About Page</div>,
  });

  const dashboardRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/dashboard',
    component: () => <div>Dashboard Page</div>,
  });

  const routeTree = rootRoute.addChildren([
    indexRoute,
    aboutRoute,
    dashboardRoute,
  ]);

  const router = createRouter({
    routeTree,
    history: createMemoryHistory({
      initialEntries: ['/'],
    }),
  });

  render(<RouterProvider router={router} />);

  // Wait for the router to render the header
  await waitFor(() => {
    expect(screen.getByText('Nova AI')).toBeInTheDocument();
  });
}

describe('Header', () => {
  it('renders the header component with Nova AI branding', async () => {
    await renderWithRouter();

    // Check for branding
    expect(screen.getByText('Nova AI')).toBeInTheDocument();

    // Check for header element
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('displays navigation content', async () => {
    await renderWithRouter();

    // Navigation links are in the DOM (even if hidden on mobile viewport)
    expect(screen.getByText('Features')).toBeInTheDocument();
    expect(screen.getByText('About')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Pricing')).toBeInTheDocument();
  });

  it('has logo linking to home', async () => {
    await renderWithRouter();

    const logoLink = screen.getByRole('link', { name: /nova ai/i });
    expect(logoLink).toHaveAttribute('href', '/');
  });

  it('renders header container as banner landmark', async () => {
    await renderWithRouter();

    const header = screen.getByRole('banner');
    expect(header).toBeInTheDocument();
  });

  it('has Get Started Free CTA button', async () => {
    await renderWithRouter();

    expect(
      screen.getByRole('button', { name: /get started free/i })
    ).toBeInTheDocument();
  });

  it('has mobile menu button', async () => {
    await renderWithRouter();

    expect(
      screen.getByRole('button', { name: /open menu/i })
    ).toBeInTheDocument();
  });

  it('shows user menu when authenticated', async () => {
    const authenticatedStatus = {
      isAuthenticated: true,
      canRefresh: true,
      expiresAt: Date.now() + 3600000,
      user: {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        picture: null,
      },
    };

    await renderWithRouter(authenticatedStatus);

    // Should show user name or email instead of Login button
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('has skip-to-content link for accessibility', async () => {
    await renderWithRouter();

    const skipLink = screen.getByText('Skip to main content');
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute('href', '#main-content');
  });
});
