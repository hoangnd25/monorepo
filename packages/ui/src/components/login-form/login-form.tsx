import { useState } from 'react';
import { Button, Stack, VStack } from '../../chakra';
import { LoginHeader } from './login-header';
import {
  LoginUsernameStep,
  type LoginMethod,
  type LoginMethodsResponse,
} from './login-username-step';
import { LoginPasswordStep } from './login-password-step';
import { LoginMagicLinkStep } from './login-magic-link-step';
import { LoginMessage } from './login-message';
import { LoginFooter } from './login-footer';
import {
  LoginSocialProviders,
  type SocialProvider,
} from './login-social-providers';
import { LoginDivider } from './login-divider';

export interface LoginSuccessMessage {
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
}

export interface LoginFormHeading {
  title?: string;
  subtitle?: string;
  logo?: React.ReactNode;
}

export interface LoginFormMagicLink {
  enabled?: boolean;
  buttonText?: string;
  successMessage?: {
    title?: string;
    description?: (email: string) => string;
    actionText?: string;
  };
}

export interface LoginFormSignUp {
  enabled?: boolean;
  text?: string;
  linkText?: string;
  onLinkClick?: () => void;
}

export interface LoginFormRememberMe {
  enabled?: boolean;
  label?: string;
}

export interface LoginFormPassword {
  enabled?: boolean;
  label?: string;
  forgotPasswordLinkText?: string;
}

export interface LoginFormUsername {
  label?: string;
  placeholder?: string;
  autoFocus?: boolean;
  validate?: (value: string) => string | undefined;
}

export interface LoginFormButtons {
  submit?: string;
  continue?: string;
}

export interface LoginFormProps {
  onSubmit?: (username: string, password: string) => void;
  onMagicLinkRequest?: (username: string) => Promise<void>;
  onForgotPassword?: () => void;
  onSignUp?: () => void;
  onValidateUsername?: (username: string) => string | undefined;
  onUsernameVerified?: (username: string) => Promise<LoginMethodsResponse>;
  socialProviders?: SocialProvider[];
  heading?: LoginFormHeading;
  magicLink?: LoginFormMagicLink;
  signUp?: LoginFormSignUp;
  rememberMe?: LoginFormRememberMe;
  password?: LoginFormPassword;
  username?: LoginFormUsername;
  buttons?: LoginFormButtons;
  isLoading?: boolean;
  passwordError?: string;
  defaultUsername?: string;
  successMessage?: LoginSuccessMessage;
}

export function LoginForm({
  onSubmit,
  onMagicLinkRequest,
  onForgotPassword,
  onSignUp,
  onValidateUsername,
  onUsernameVerified,
  socialProviders,
  heading = {
    title: 'Welcome back',
    subtitle: 'Sign in to your account to continue',
  },
  magicLink,
  signUp = {
    enabled: true,
    text: "Don't have an account?",
    linkText: 'Create account',
  },
  rememberMe = {
    enabled: true,
    label: 'Keep me signed in',
  },
  password = {
    enabled: true,
    label: 'Password',
    forgotPasswordLinkText: 'Forgot password?',
  },
  username = {
    label: 'Email',
    placeholder: 'you@example.com',
    validate: (value: string) => {
      if (!value || value.trim() === '') {
        return 'Please enter your email address';
      }
      if (!/\S+@\S+\.\S+/.test(value)) {
        return 'Please enter a valid email address';
      }
      return undefined;
    },
  },
  buttons = {
    submit: 'Sign in',
    continue: 'Continue',
  },
  isLoading = false,
  passwordError,
  defaultUsername,
  successMessage,
}: LoginFormProps) {
  // Merge magic link defaults with deep merge for successMessage
  const magicLinkConfig: LoginFormMagicLink = {
    enabled: magicLink?.enabled ?? false,
    buttonText: magicLink?.buttonText ?? 'Send me a login link',
    successMessage: {
      title: magicLink?.successMessage?.title ?? 'Check your email',
      description:
        magicLink?.successMessage?.description ??
        ((email: string) =>
          `We've sent a login link to ${email}. Click the link in the email to sign in.`),
      actionText: magicLink?.successMessage?.actionText ?? 'try again',
    },
  };
  const [step, setStep] = useState<'username' | 'password' | 'magic-link'>(
    defaultUsername ? 'password' : 'username'
  );
  const [usernameValue, setUsernameValue] = useState(defaultUsername || '');
  const [availableMethods, setAvailableMethods] = useState<LoginMethod[]>([
    'password',
  ]);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  // Determine final available methods based on configuration and API response
  const finalAvailableMethods = availableMethods.filter((method) => {
    if (method === 'magic-link') {
      return magicLinkConfig?.enabled !== false;
    }
    if (method === 'password') {
      return password?.enabled !== false;
    }
    return true;
  });

  const handleUsernameSubmit = (
    username: string,
    methods: LoginMethod[]
  ): void => {
    setUsernameValue(username);
    setAvailableMethods(methods);

    // After username verification, determine which step to show
    // Filter methods based on configuration
    const finalMethods = methods.filter((method) => {
      if (method === 'magic-link') {
        return magicLinkConfig?.enabled !== false;
      }
      if (method === 'password') {
        return password?.enabled !== false;
      }
      return true;
    });

    // Default to password if available, otherwise magic-link
    if (finalMethods.includes('password')) {
      setStep('password');
    } else if (finalMethods.includes('magic-link')) {
      setStep('magic-link');
    }
  };

  const handlePasswordSubmit = (
    passwordValue: string,
    _rememberMe: boolean
  ): void => {
    onSubmit?.(usernameValue, passwordValue);
    // Note: rememberMe value is available but not used in the current implementation
    // It can be passed to onSubmit if needed in the future
  };

  const handleMagicLinkRequest = async (email: string) => {
    if (!onMagicLinkRequest) return;
    await onMagicLinkRequest(email);
    // Show success message after sending magic link
    setShowSuccessMessage(true);
  };

  const handleSwitchToMagicLink = () => {
    setStep('magic-link');
  };

  const handleSwitchToPassword = () => {
    setStep('password');
  };

  const handleBack = () => {
    setStep('username');
    setShowSuccessMessage(false);
  };

  const handleSuccessAction = () => {
    // Default action: go back to username step
    setShowSuccessMessage(false);
    setStep('username');
    successMessage?.onAction?.();
  };

  const isUsernameStep = step === 'username';
  const isPasswordStep = step === 'password';
  const isMagicLinkStep = step === 'magic-link';

  // Build success message from either explicit prop or magic link config
  const displaySuccessMessage: LoginSuccessMessage | undefined =
    successMessage ||
    (magicLinkConfig?.successMessage
      ? {
          title: magicLinkConfig.successMessage.title || 'Check your email',
          description:
            magicLinkConfig.successMessage.description?.(usernameValue) ||
            `We've sent a login link to ${usernameValue}. Click the link in the email to sign in.`,
          actionText: magicLinkConfig.successMessage.actionText || 'try again',
          onAction: handleSuccessAction,
        }
      : undefined);

  return (
    <VStack gap={8} align="stretch" width="full">
      <LoginHeader
        logo={heading?.logo}
        title={heading?.title}
        subtitle={heading?.subtitle}
      />

      {showSuccessMessage && displaySuccessMessage && (
        <LoginMessage
          type="success"
          title={displaySuccessMessage.title}
          description={displaySuccessMessage.description}
        />
      )}

      <Stack gap={3}>
        {isUsernameStep && (
          <LoginUsernameStep
            username={username}
            continueButtonText={buttons?.continue}
            isLoading={isLoading}
            showEditButton={false}
            defaultValue={usernameValue}
            onValidateUsername={onValidateUsername}
            onUsernameVerified={onUsernameVerified}
            onSubmit={handleUsernameSubmit}
          />
        )}

        {!isUsernameStep && !showSuccessMessage && (
          <LoginUsernameStep
            username={username}
            isLoading={false}
            showEditButton={true}
            defaultValue={usernameValue}
            onEdit={handleBack}
            onSubmit={handleUsernameSubmit}
          />
        )}

        {isUsernameStep && socialProviders && socialProviders.length > 0 && (
          <>
            <LoginDivider text="other methods" />
            <LoginSocialProviders
              providers={socialProviders}
              disabled={isLoading}
            />
          </>
        )}

        {isPasswordStep && (
          <>
            <LoginPasswordStep
              password={{
                label: password?.label,
                forgotPasswordLinkText: password?.forgotPasswordLinkText,
              }}
              buttons={{
                submit: buttons?.submit || 'Sign in',
              }}
              rememberMe={{
                enabled: rememberMe?.enabled,
                label: rememberMe?.label,
              }}
              isLoading={isLoading}
              externalError={passwordError}
              onForgotPassword={onForgotPassword}
              onSubmit={handlePasswordSubmit}
            />
            {finalAvailableMethods.includes('magic-link') && (
              <>
                <LoginDivider text="or" />
                <Button
                  type="button"
                  width="full"
                  variant="outline"
                  size="lg"
                  onClick={handleSwitchToMagicLink}
                  disabled={isLoading}
                >
                  {magicLinkConfig?.buttonText || 'Send me a login link'}
                </Button>
              </>
            )}
          </>
        )}

        {isMagicLinkStep && (
          <>
            <LoginMagicLinkStep
              buttons={{
                send: magicLinkConfig?.buttonText || 'Send me a login link',
                tryAgain:
                  magicLinkConfig?.successMessage?.actionText || 'try again',
              }}
              email={usernameValue}
              isSent={showSuccessMessage}
              onSendMagicLink={handleMagicLinkRequest}
              onTryAgain={handleSuccessAction}
            />
            {!showSuccessMessage &&
              finalAvailableMethods.includes('password') && (
                <>
                  <LoginDivider text="or" />
                  <Button
                    type="button"
                    width="full"
                    variant="outline"
                    size="lg"
                    onClick={handleSwitchToPassword}
                  >
                    Sign in with password
                  </Button>
                </>
              )}
          </>
        )}
      </Stack>

      <LoginFooter
        signUp={{
          enabled: signUp?.enabled,
          text: signUp?.text,
          linkText: signUp?.linkText,
          onLinkClick: onSignUp,
        }}
      />
    </VStack>
  );
}
