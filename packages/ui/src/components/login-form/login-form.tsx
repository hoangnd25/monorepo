import { useState } from 'react';
import { Box, Stack, VStack } from '../../chakra';
import { LoginHeader } from './login-header';
import { LoginUsernameStep } from './login-username-step';
import { LoginPasswordStep } from './login-password-step';
import { LoginFooter } from './login-footer';
import {
  LoginSocialProviders,
  type SocialProvider,
} from './login-social-providers';
import { LoginDivider } from './login-divider';

export type LoginMethod = 'password' | 'magic-link';

export interface LoginMethodsResponse {
  methods: LoginMethod[];
  error?: string;
}

export interface LoginFormHeading {
  title?: string;
  subtitle?: string;
  logo?: React.ReactNode;
}

export interface LoginFormMagicLink {
  enabled?: boolean;
  buttonText?: string;
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
  onMagicLinkRequest?: (username: string) => void;
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
  magicLink = {
    enabled: false,
    buttonText: 'Send me a login link',
  },
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
}: LoginFormProps) {
  const [step, setStep] = useState<'username' | 'password'>(
    defaultUsername ? 'password' : 'username'
  );
  const [usernameValue, setUsernameValue] = useState(defaultUsername || '');
  const [currentUsernameError, setCurrentUsernameError] = useState<
    string | undefined
  >();
  const [currentPasswordError, setCurrentPasswordError] = useState<
    string | undefined
  >();
  const [isVerifyingUsername, setIsVerifyingUsername] = useState(false);
  const [availableMethods, setAvailableMethods] = useState<LoginMethod[]>([
    'password',
  ]);

  // Determine final available methods based on configuration and API response
  const finalAvailableMethods = availableMethods.filter((method) => {
    if (method === 'magic-link') {
      return magicLink?.enabled !== false;
    }
    if (method === 'password') {
      return password?.enabled !== false;
    }
    return true;
  });

  const defaultValidateUsername = (value: string): string | undefined => {
    if (!value || value.trim() === '') {
      return `Please enter your ${username?.label?.toLowerCase() || 'username'}`;
    }
    return undefined;
  };

  const validateUsername = (value: string): string | undefined => {
    // Priority: onValidateUsername prop > username.validate > default validation
    if (onValidateUsername) {
      return onValidateUsername(value);
    }
    if (username?.validate) {
      return username.validate(value);
    }
    return defaultValidateUsername(value);
  };

  const handleUsernameSubmit: React.FormEventHandler<HTMLFormElement> = async (
    e
  ) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const usernameInput = formData.get('username') as string;

    const validationError = validateUsername(usernameInput);
    if (validationError) {
      setCurrentUsernameError(validationError);
      return;
    }

    setCurrentUsernameError(undefined);
    setUsernameValue(usernameInput);

    // If onUsernameVerified callback is provided, call it to get available login methods
    if (onUsernameVerified) {
      setIsVerifyingUsername(true);
      try {
        const response = await onUsernameVerified(usernameInput);
        if (response.error) {
          setCurrentUsernameError(response.error);
          setIsVerifyingUsername(false);
          return;
        }
        // Check if methods array is empty
        if (!response.methods || response.methods.length === 0) {
          setCurrentUsernameError(
            'This email is not registered. Please sign up first.'
          );
          setIsVerifyingUsername(false);
          return;
        }
        setAvailableMethods(response.methods);
        setIsVerifyingUsername(false);
      } catch {
        setCurrentUsernameError(
          'We could not verify your email. Please try again.'
        );
        setIsVerifyingUsername(false);
        return;
      }
    }

    setStep('password');
  };

  const handlePasswordSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const password = formData.get('password') as string;

    // Validate password is not empty
    if (!password || password.trim() === '') {
      setCurrentPasswordError('Please enter your password');
      return;
    }

    setCurrentPasswordError(undefined);
    onSubmit?.(usernameValue, password);
  };

  const handleMagicLinkRequest = () => {
    onMagicLinkRequest?.(usernameValue);
  };

  const handleBack = () => {
    setStep('username');
  };

  const isUsernameStep = step === 'username';
  const formHandler = isUsernameStep
    ? handleUsernameSubmit
    : handlePasswordSubmit;

  return (
    <Box
      as="form"
      onSubmit={
        formHandler as unknown as React.FormEventHandler<HTMLDivElement>
      }
      width="full"
    >
      <VStack gap={8} align="stretch">
        <LoginHeader
          logo={heading?.logo}
          title={heading?.title}
          subtitle={heading?.subtitle}
        />

        <Stack gap={3}>
          <LoginUsernameStep
            usernameField={{
              value: usernameValue,
              error: currentUsernameError,
              label: username?.label,
              placeholder: username?.placeholder,
              autoFocus: username?.autoFocus,
              disabled: isUsernameStep
                ? isLoading || isVerifyingUsername
                : undefined,
              onChange: isUsernameStep
                ? () => setCurrentUsernameError(undefined)
                : undefined,
            }}
            continueButtonText={buttons?.continue}
            isLoading={
              isUsernameStep ? isLoading || isVerifyingUsername : false
            }
            showEditButton={!isUsernameStep}
            onEdit={!isUsernameStep ? handleBack : undefined}
          />

          {isUsernameStep && socialProviders && socialProviders.length > 0 && (
            <>
              <LoginDivider text="other methods" />
              <LoginSocialProviders
                providers={socialProviders}
                disabled={isLoading || isVerifyingUsername}
              />
            </>
          )}

          {!isUsernameStep && (
            <LoginPasswordStep
              password={{
                error: currentPasswordError || passwordError,
                label: password?.label,
                forgotPasswordLinkText: password?.forgotPasswordLinkText,
              }}
              buttons={{
                submit: buttons?.submit || 'Sign in',
                magicLink: magicLink?.buttonText || 'Send me a login link',
              }}
              rememberMe={{
                show: rememberMe?.enabled !== false,
                label: rememberMe?.label,
              }}
              availableMethods={finalAvailableMethods}
              isLoading={isLoading}
              onForgotPassword={onForgotPassword}
              onMagicLinkRequest={handleMagicLinkRequest}
              onPasswordChange={() => setCurrentPasswordError(undefined)}
            />
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
    </Box>
  );
}
