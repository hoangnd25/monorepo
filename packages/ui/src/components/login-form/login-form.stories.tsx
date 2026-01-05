import type { Meta, StoryObj } from '@storybook/react-vite';
import { LoginForm } from './login-form';
import { Box } from '../../chakra';

import { FaGoogle, FaGithub, FaMicrosoft } from 'react-icons/fa';

const meta = {
  title: 'Components/LoginForm',
  component: LoginForm,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  argTypes: {
    onSubmit: { action: 'submitted' },
    onForgotPassword: { action: 'forgot-password' },
    onSignUp: { action: 'sign-up' },
    heading: {
      control: 'object',
    },
    magicLink: {
      control: 'object',
    },
    signUp: {
      control: 'object',
    },
    rememberMe: {
      control: 'object',
    },
    password: {
      control: 'object',
    },
    username: {
      control: 'object',
    },
    buttons: {
      control: 'object',
    },
    isLoading: {
      control: 'boolean',
    },
    socialProviders: {
      control: false,
    },
  },
} satisfies Meta<typeof LoginForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const WithSocialProviders: Story = {
  args: {
    socialProviders: [
      {
        id: 'google',
        label: 'Sign in with Google',
        icon: <FaGoogle />,
        onClick: () => alert('Signing in with Google'),
        show: true,
      },
      {
        id: 'github',
        label: 'Sign in with GitHub',
        icon: <FaGithub />,
        onClick: () => alert('Signing in with GitHub'),
        show: true,
      },
      {
        id: 'microsoft',
        label: 'Sign in with Microsoft',
        icon: <FaMicrosoft />,
        onClick: () => alert('Signing in with Microsoft'),
        show: false,
      },
    ],
  },
};

export const CustomContent: Story = {
  args: {
    heading: {
      logo: (
        <Box
          width="12"
          height="12"
          bg="teal.500"
          borderRadius="md"
          display="inline-flex"
          alignItems="center"
          justifyContent="center"
          color="white"
          fontWeight="bold"
        >
          Logo
        </Box>
      ),
      title: 'Sign In',
      subtitle: 'Access your account',
    },
    buttons: {
      submit: 'Continue',
    },
  },
};

export const Loading: Story = {
  args: {
    isLoading: true,
  },
};

export const WithErrors: Story = {
  args: {
    passwordError: 'Password must be at least 8 characters',
    defaultUsername: 'user@example.com',
  },
};

export const MinimalConfiguration: Story = {
  args: {
    heading: {},
    rememberMe: {
      enabled: false,
    },
    signUp: {
      enabled: false,
    },
  },
};

export const WithValidation: Story = {
  args: {
    onValidateUsername: (username: string) => {
      if (!username || username.trim() === '') {
        return 'Email address is required';
      }
      if (!/\S+@\S+\.\S+/.test(username)) {
        return 'Please enter a valid email address';
      }
      return undefined;
    },
    onUsernameVerified: async (username: string) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (username === 'blocked@example.com') {
        return {
          methods: [],
          error: 'This account has been blocked',
        };
      }

      return {
        methods: ['password'],
      };
    },
  },
  render: (args) => (
    <Box>
      <LoginForm {...args} />
      <Box mt={4} p={4} bg="gray.50" borderRadius="md">
        <Box fontSize="sm" color="gray.600">
          Try submitting with:
          <ul style={{ marginTop: '8px', marginLeft: '20px' }}>
            <li>Empty email (validation error)</li>
            <li>Invalid format: &quot;notanemail&quot; (validation error)</li>
            <li>&quot;blocked@example.com&quot; (verification error)</li>
            <li>Valid email: &quot;user@example.com&quot; (success)</li>
          </ul>
        </Box>
      </Box>
    </Box>
  ),
};

export const WithDefaultUsername: Story = {
  args: {
    defaultUsername: 'user@example.com',
  },
  render: (args) => (
    <Box>
      <LoginForm {...args} />
      <Box mt={4} p={4} bg="gray.50" borderRadius="md">
        <Box fontSize="sm" color="gray.600">
          This story demonstrates skipping step 1 by providing a defaultUsername
          prop. The form starts directly at the password step. Click the edit
          icon to go back and change the username.
        </Box>
      </Box>
    </Box>
  ),
};

export const WithLoginMethods: Story = {
  args: {
    magicLink: {
      enabled: true,
      buttonText: 'Send me a login link',
      successMessage: {
        title: 'Check your email',
        description: (email: string) =>
          `We've sent a login link to ${email}. Click the link in the email to sign in.`,
        actionText: 'try again',
      },
    },
    onUsernameVerified: async (_username: string) => {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Return available login methods
      return {
        methods: ['password', 'magic-link'],
      };
    },
    onMagicLinkRequest: async (_username: string) => {
      // Simulate sending magic link
      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.log(`Magic link sent to ${_username}`);
    },
  },
  render: (args) => (
    <Box>
      <LoginForm {...args} />
      <Box mt={4} p={4} bg="gray.50" borderRadius="md">
        <Box fontSize="sm" color="gray.600">
          This story demonstrates async username verification. After entering a
          username, the form will verify it (simulated 1.5s delay) and show both
          password and magic link options. Click &quot;Send me a login
          link&quot; to see the success message and &quot;try again&quot;
          functionality.
        </Box>
      </Box>
    </Box>
  ),
};

export const PasswordlessLogin: Story = {
  args: {
    password: {
      enabled: false,
    },
    magicLink: {
      enabled: true,
      buttonText: 'Send magic link',
      successMessage: {
        title: 'Check your inbox',
        description: (email: string) =>
          `We sent a secure login link to ${email}`,
        actionText: 'resend link',
      },
    },
    onUsernameVerified: async (username: string) => {
      console.log('Username verified:', username);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return { methods: ['magic-link'] };
    },
    onMagicLinkRequest: async (username: string) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      console.log(`Magic link sent to ${username}!`);
    },
  },
  render: (args) => (
    <Box>
      <LoginForm {...args} />
      <Box mt={4} p={4} bg="gray.50" borderRadius="md">
        <Box fontSize="sm" color="gray.600">
          This story demonstrates passwordless login using magic links only. The
          password field is completely disabled, and users can only authenticate
          via magic link sent to their email. Try clicking &quot;Send magic
          link&quot; to see the custom success message and &quot;resend
          link&quot; button.
        </Box>
      </Box>
    </Box>
  ),
};

export const CustomUsernameField: Story = {
  args: {
    username: {
      label: 'Phone number',
      placeholder: '+1 (555) 000-0000',
      validate: (value: string) => {
        if (!value || value.trim() === '') {
          return 'Please enter your phone number';
        }
        return undefined;
      },
    },
    onSubmit: (username: string, password: string) => {
      alert(`Login successful!\nPhone: ${username}\nPassword: ${password}`);
    },
  },
  render: (args) => (
    <Box>
      <LoginForm {...args} />
      <Box mt={4} p={4} bg="gray.50" borderRadius="md">
        <Box fontSize="sm" color="gray.600">
          This story shows phone number as username with custom label,
          placeholder, and validation.
        </Box>
      </Box>
    </Box>
  ),
};
