import type { Meta, StoryObj } from '@storybook/react-vite';
import { LoginForm } from './login-form';

const meta = {
  title: 'Components/LoginForm',
  component: LoginForm,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    onSubmit: { action: 'submitted' },
    title: {
      control: 'text',
    },
    emailLabel: {
      control: 'text',
    },
    passwordLabel: {
      control: 'text',
    },
    submitButtonText: {
      control: 'text',
    },
    isLoading: {
      control: 'boolean',
    },
    showTitle: {
      control: 'boolean',
    },
  },
} satisfies Meta<typeof LoginForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const CustomLabels: Story = {
  args: {
    title: 'Welcome Back',
    emailLabel: 'Email Address',
    emailPlaceholder: 'your.email@example.com',
    passwordLabel: 'Your Password',
    passwordPlaceholder: '********',
    submitButtonText: 'Login',
  },
};

export const Loading: Story = {
  args: {
    isLoading: true,
  },
};

export const WithErrors: Story = {
  args: {
    emailError: 'Please enter a valid email address',
    passwordError: 'Password must be at least 8 characters',
  },
};

export const WithoutTitle: Story = {
  args: {
    showTitle: false,
  },
};

export const CustomTitle: Story = {
  args: {
    title: 'Sign In to Your Account',
    submitButtonText: 'Continue',
  },
};
