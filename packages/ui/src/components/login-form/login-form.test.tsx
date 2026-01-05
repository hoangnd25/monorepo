import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { LoginForm } from './login-form';
import type { LoginMethodsResponse } from './login-username-step';

// Helper to render with ChakraProvider
function renderLoginForm(props = {}) {
  return render(
    <ChakraProvider value={defaultSystem}>
      <LoginForm {...props} />
    </ChakraProvider>
  );
}

describe('LoginForm', () => {
  describe('Username Validation', () => {
    it('should show error when submitting empty username', async () => {
      const user = userEvent.setup();
      renderLoginForm();

      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      expect(
        await screen.findByText('Please enter your email address')
      ).toBeInTheDocument();
    });

    it('should show error when submitting invalid email format', async () => {
      const user = userEvent.setup();
      renderLoginForm();

      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'notanemail');

      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      expect(
        await screen.findByText('Please enter a valid email address')
      ).toBeInTheDocument();
    });

    it('should clear error when user starts typing', async () => {
      const user = userEvent.setup();
      renderLoginForm();

      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      expect(
        await screen.findByText('Please enter your email address')
      ).toBeInTheDocument();

      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 't');

      expect(
        screen.queryByText('Please enter your email address')
      ).not.toBeInTheDocument();
    });

    it('should use custom validation when onValidateUsername is provided', async () => {
      const user = userEvent.setup();
      const customValidate = vi.fn((username: string) => {
        if (username === 'blocked@example.com') {
          return 'This username is blocked';
        }
        return undefined;
      });

      renderLoginForm({ onValidateUsername: customValidate });

      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'blocked@example.com');

      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      expect(
        await screen.findByText('This username is blocked')
      ).toBeInTheDocument();
      expect(customValidate).toHaveBeenCalledWith('blocked@example.com');
    });

    it('should proceed to password step with valid email', async () => {
      const user = userEvent.setup();
      renderLoginForm();

      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'user@example.com');

      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      // Should now be on password step
      await waitFor(() => {
        expect(screen.getByLabelText('Password')).toBeInTheDocument();
      });

      // Username should be shown in disabled input
      const disabledEmailInput = screen.getByDisplayValue('user@example.com');
      expect(disabledEmailInput).toBeDisabled();
    });
  });

  describe('Two-Step Navigation', () => {
    it('should navigate back to username step when edit button is clicked', async () => {
      const user = userEvent.setup();
      renderLoginForm();

      // Navigate to password step
      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'user@example.com');

      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      await waitFor(() => {
        expect(screen.getByLabelText('Password')).toBeInTheDocument();
      });

      // Click edit button
      const editButton = screen.getByRole('button', { name: /edit/i });
      await user.click(editButton);

      // Should be back on username step
      await waitFor(() => {
        const usernameInput = screen.getByLabelText(/email/i);
        expect(usernameInput).toBeInTheDocument();
        expect(usernameInput).not.toBeDisabled();
        expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
      });

      // Username should be preserved
      const emailInputAgain = screen.getByLabelText(/email/i);
      expect(emailInputAgain).toHaveValue('user@example.com');
    });
  });

  describe('Async Username Verification', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should show loading state during username verification', async () => {
      const user = userEvent.setup();
      const onUsernameVerified = vi.fn(
        async (): Promise<LoginMethodsResponse> => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return { methods: ['password'] };
        }
      );

      renderLoginForm({ onUsernameVerified });

      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'user@example.com');

      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      // Button should show loading state
      expect(continueButton).toBeDisabled();

      // Wait for verification to complete
      await waitFor(() => {
        expect(screen.getByLabelText('Password')).toBeInTheDocument();
      });

      // Verify callback was called with correct username
      expect(onUsernameVerified).toHaveBeenCalledWith('user@example.com');
    });

    it('should handle verification error', async () => {
      const user = userEvent.setup();
      const onUsernameVerified = vi.fn(
        async (): Promise<LoginMethodsResponse> => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return {
            methods: [],
            error: 'Account not found',
          };
        }
      );

      renderLoginForm({ onUsernameVerified });

      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'user@example.com');

      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      // Should show error and stay on username step
      expect(await screen.findByText('Account not found')).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    });

    it('should handle empty methods array', async () => {
      const user = userEvent.setup();
      const onUsernameVerified = vi.fn(
        async (): Promise<LoginMethodsResponse> => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return { methods: [] };
        }
      );

      renderLoginForm({ onUsernameVerified });

      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'user@example.com');

      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      // Should show error for empty methods
      expect(
        await screen.findByText(
          'This email is not registered. Please sign up first.'
        )
      ).toBeInTheDocument();
    });

    it('should handle verification exception', async () => {
      const user = userEvent.setup();
      const onUsernameVerified = vi.fn(async () => {
        throw new Error('Network error');
      });

      renderLoginForm({ onUsernameVerified });

      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'user@example.com');

      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      // Should show generic error message
      expect(
        await screen.findByText(
          'We could not verify your email. Please try again.'
        )
      ).toBeInTheDocument();
    });
  });

  describe('Dynamic Login Methods', () => {
    it('should show only password input when methods contain password only', async () => {
      const user = userEvent.setup();
      const onUsernameVerified = vi.fn(
        async (): Promise<LoginMethodsResponse> => ({
          methods: ['password'],
        })
      );

      renderLoginForm({ onUsernameVerified });

      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'user@example.com');

      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      await waitFor(() => {
        expect(screen.getByLabelText('Password')).toBeInTheDocument();
      });

      // Should not show magic link button
      expect(
        screen.queryByRole('button', { name: /send me a login link/i })
      ).not.toBeInTheDocument();
    });

    it('should show only magic link button when methods contain magic-link only', async () => {
      const user = userEvent.setup();
      const onUsernameVerified = vi.fn(
        async (): Promise<LoginMethodsResponse> => ({
          methods: ['magic-link'],
        })
      );
      const onMagicLinkRequest = vi.fn();

      renderLoginForm({
        magicLink: { enabled: true },
        onUsernameVerified,
        onMagicLinkRequest,
      });

      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'user@example.com');

      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /send me a login link/i })
        ).toBeInTheDocument();
      });

      // Should not show password input
      expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    });

    it('should show both password and magic link when methods contain both', async () => {
      const user = userEvent.setup();
      const onUsernameVerified = vi.fn(
        async (): Promise<LoginMethodsResponse> => ({
          methods: ['password', 'magic-link'],
        })
      );
      const onMagicLinkRequest = vi.fn();

      renderLoginForm({
        magicLink: { enabled: true },
        onUsernameVerified,
        onMagicLinkRequest,
      });

      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'user@example.com');

      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      await waitFor(() => {
        expect(screen.getByLabelText('Password')).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: /send me a login link/i })
        ).toBeInTheDocument();
      });
    });

    it('should call onMagicLinkRequest when magic link button is clicked', async () => {
      const user = userEvent.setup();
      const onUsernameVerified = vi.fn(
        async (): Promise<LoginMethodsResponse> => ({
          methods: ['magic-link'],
        })
      );
      const onMagicLinkRequest = vi.fn(async () => {
        // Simulate async operation
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      renderLoginForm({
        magicLink: { enabled: true },
        onUsernameVerified,
        onMagicLinkRequest,
      });

      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'user@example.com');

      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /send me a login link/i })
        ).toBeInTheDocument();
      });

      const magicLinkButton = screen.getByRole('button', {
        name: /send me a login link/i,
      });
      await user.click(magicLinkButton);

      expect(onMagicLinkRequest).toHaveBeenCalledWith('user@example.com');
    });

    it('should show loading state when sending magic link', async () => {
      const user = userEvent.setup();
      const onUsernameVerified = vi.fn(
        async (): Promise<LoginMethodsResponse> => ({
          methods: ['magic-link'],
        })
      );
      const onMagicLinkRequest = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      renderLoginForm({
        magicLink: { enabled: true },
        onUsernameVerified,
        onMagicLinkRequest,
      });

      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'user@example.com');

      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /send me a login link/i })
        ).toBeInTheDocument();
      });

      const magicLinkButton = screen.getByRole('button', {
        name: /send me a login link/i,
      });
      await user.click(magicLinkButton);

      // Button should be disabled during loading
      expect(magicLinkButton).toBeDisabled();

      // Wait for request to complete
      await waitFor(
        () => {
          expect(screen.getByText(/check your email/i)).toBeInTheDocument();
        },
        { timeout: 2000 }
      );
    });

    it('should show success message after magic link is sent', async () => {
      const user = userEvent.setup();
      const onUsernameVerified = vi.fn(
        async (): Promise<LoginMethodsResponse> => ({
          methods: ['magic-link'],
        })
      );
      const onMagicLinkRequest = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      renderLoginForm({
        magicLink: { enabled: true },
        onUsernameVerified,
        onMagicLinkRequest,
      });

      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'user@example.com');

      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /send me a login link/i })
        ).toBeInTheDocument();
      });

      const magicLinkButton = screen.getByRole('button', {
        name: /send me a login link/i,
      });
      await user.click(magicLinkButton);

      // Should show success message
      await waitFor(() => {
        expect(screen.getByText(/check your email/i)).toBeInTheDocument();
        expect(
          screen.getByText(/we've sent a login link to user@example\.com/i)
        ).toBeInTheDocument();
      });

      // Magic link button should no longer be visible
      expect(
        screen.queryByRole('button', { name: /send me a login link/i })
      ).not.toBeInTheDocument();
    });

    it('should allow user to try again from success message', async () => {
      const user = userEvent.setup();
      const onUsernameVerified = vi.fn(
        async (): Promise<LoginMethodsResponse> => ({
          methods: ['magic-link'],
        })
      );
      const onMagicLinkRequest = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      renderLoginForm({
        magicLink: { enabled: true },
        onUsernameVerified,
        onMagicLinkRequest,
      });

      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'user@example.com');

      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /send me a login link/i })
        ).toBeInTheDocument();
      });

      const magicLinkButton = screen.getByRole('button', {
        name: /send me a login link/i,
      });
      await user.click(magicLinkButton);

      // Wait for success message
      await waitFor(() => {
        expect(screen.getByText(/check your email/i)).toBeInTheDocument();
      });

      // Click "try again" button
      const tryAgainButton = screen.getByRole('button', { name: /try again/i });
      await user.click(tryAgainButton);

      // Should go back to username step
      await waitFor(() => {
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
        expect(screen.queryByText(/check your email/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Password Validation', () => {
    it('should show error when submitting empty password', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();

      renderLoginForm({ onSubmit, defaultUsername: 'user@example.com' });

      // Should start on password step due to defaultUsername
      expect(screen.getByLabelText('Password')).toBeInTheDocument();

      const submitButton = screen.getByRole('button', { name: /sign in/i });
      await user.click(submitButton);

      expect(
        await screen.findByText('Please enter your password')
      ).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('should clear password error when user starts typing', async () => {
      const user = userEvent.setup();
      renderLoginForm({ defaultUsername: 'user@example.com' });

      const submitButton = screen.getByRole('button', { name: /sign in/i });
      await user.click(submitButton);

      expect(
        await screen.findByText('Please enter your password')
      ).toBeInTheDocument();

      const passwordInput = screen.getByLabelText('Password');
      await user.type(passwordInput, 'p');

      expect(
        screen.queryByText('Please enter your password')
      ).not.toBeInTheDocument();
    });

    it('should call onSubmit with username and password when form is valid', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();

      renderLoginForm({ onSubmit, defaultUsername: 'user@example.com' });

      const passwordInput = screen.getByLabelText('Password');
      await user.type(passwordInput, 'mypassword123');

      const submitButton = screen.getByRole('button', { name: /sign in/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(
          'user@example.com',
          'mypassword123'
        );
      });
    });

    it('should show custom password error from prop', () => {
      renderLoginForm({
        defaultUsername: 'user@example.com',
        passwordError: 'Password must be at least 8 characters',
      });

      expect(
        screen.getByText('Password must be at least 8 characters')
      ).toBeInTheDocument();
    });
  });

  describe('Default Username Prop', () => {
    it('should start on password step when defaultUsername is provided', () => {
      renderLoginForm({ defaultUsername: 'user@example.com' });

      // Should be on password step
      expect(screen.getByLabelText('Password')).toBeInTheDocument();

      // Username should be shown in disabled input
      const usernameInput = screen.getByDisplayValue('user@example.com');
      expect(usernameInput).toBeDisabled();
    });

    it('should start on username step when defaultUsername is not provided', () => {
      renderLoginForm();

      // Should be on username step
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    });

    it('should allow editing username when starting with defaultUsername', async () => {
      const user = userEvent.setup();
      renderLoginForm({ defaultUsername: 'user@example.com' });

      // Click edit button
      const editButton = screen.getByRole('button', { name: /edit/i });
      await user.click(editButton);

      // Should be back on username step
      await waitFor(() => {
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      });

      // Username should be preserved
      const usernameInput = screen.getByLabelText(/email/i);
      expect(usernameInput).toHaveValue('user@example.com');
    });
  });

  describe('Loading State', () => {
    it('should disable submit button when isLoading is true on password step', () => {
      renderLoginForm({
        isLoading: true,
        defaultUsername: 'user@example.com',
      });

      const buttons = screen.getAllByRole('button');
      const submitButton = buttons.find(
        (btn) => btn.getAttribute('type') === 'submit'
      );
      expect(submitButton).toBeDisabled();
    });

    it('should disable continue button when isLoading is true on username step', () => {
      renderLoginForm({ isLoading: true });

      const buttons = screen.getAllByRole('button');
      const continueButton = buttons.find(
        (btn) => btn.getAttribute('type') === 'submit'
      );
      expect(continueButton).toBeDisabled();
    });
  });

  describe('Optional Features', () => {
    it('should hide title when heading.title is not provided', () => {
      renderLoginForm({ heading: {} });

      expect(screen.queryByText('Welcome back')).not.toBeInTheDocument();
    });

    it('should hide subtitle when heading.subtitle is not provided', () => {
      renderLoginForm({ heading: { title: 'Welcome back' } });

      expect(
        screen.queryByText('Sign in to your account to continue')
      ).not.toBeInTheDocument();
    });

    it('should hide remember me when rememberMe.enabled is false', () => {
      renderLoginForm({
        rememberMe: { enabled: false },
        defaultUsername: 'user@example.com',
      });

      expect(screen.queryByText('Keep me signed in')).not.toBeInTheDocument();
    });

    it('should hide forgot password when password is disabled', () => {
      renderLoginForm({
        password: {
          enabled: false,
        },
        magicLink: {
          enabled: true,
        },
        defaultUsername: 'user@example.com',
        onUsernameVerified: async () => ({ methods: ['magic-link'] }),
      });

      expect(screen.queryByText('Forgot password?')).not.toBeInTheDocument();
    });

    it('should hide sign up link when signUp.enabled is false', () => {
      renderLoginForm({ signUp: { enabled: false } });

      expect(
        screen.queryByText("Don't have an account?")
      ).not.toBeInTheDocument();
    });
  });

  describe('Callbacks', () => {
    it('should call onForgotPassword when forgot password link is clicked', async () => {
      const user = userEvent.setup();
      const onForgotPassword = vi.fn();

      renderLoginForm({
        onForgotPassword,
        defaultUsername: 'user@example.com',
      });

      const forgotPasswordLink = screen.getByText('Forgot password?');
      await user.click(forgotPasswordLink);

      expect(onForgotPassword).toHaveBeenCalled();
    });

    it('should call onSignUp when sign up link is clicked', async () => {
      const user = userEvent.setup();
      const onSignUp = vi.fn();

      renderLoginForm({ onSignUp });

      const signUpLink = screen.getByText('Create account');
      await user.click(signUpLink);

      expect(onSignUp).toHaveBeenCalled();
    });
  });
});
