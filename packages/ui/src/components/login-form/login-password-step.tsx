import { useState } from 'react';
import { Button, Checkbox, Field, Flex, Stack } from '../../chakra';
import { PasswordInput } from '../password-input';

interface PasswordFieldConfig {
  label?: string;
  forgotPasswordLinkText?: string;
}

interface RememberMeConfig {
  enabled?: boolean;
  label?: string;
}

export interface LoginPasswordStepProps {
  password?: PasswordFieldConfig;
  buttons?: {
    submit?: string;
  };
  rememberMe?: RememberMeConfig;
  isLoading?: boolean;
  externalError?: string;
  onForgotPassword?: () => void;
  onSubmit: (password: string, rememberMe: boolean) => void;
}

export function LoginPasswordStep({
  password = {
    label: 'Password',
    forgotPasswordLinkText: 'Forgot password?',
  },
  buttons = {
    submit: 'Sign in',
  },
  rememberMe = {
    enabled: true,
    label: 'Keep me signed in',
  },
  isLoading = false,
  externalError,
  onForgotPassword,
  onSubmit,
}: LoginPasswordStepProps) {
  const [currentError, setCurrentError] = useState<string | undefined>();

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const passwordValue = formData.get('password') as string;
    const rememberValue = formData.get('remember') === 'on';

    // Validate password is not empty
    if (!passwordValue || passwordValue.trim() === '') {
      setCurrentError('Please enter your password');
      return;
    }

    setCurrentError(undefined);
    onSubmit(passwordValue, rememberValue);
  };

  const displayError = currentError || externalError;

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap={3}>
        <Field.Root invalid={!!displayError}>
          <Field.Label>{password?.label}</Field.Label>
          <PasswordInput
            name="password"
            disabled={isLoading}
            size="lg"
            autoFocus
            onChange={() => setCurrentError(undefined)}
          />
          {displayError && <Field.ErrorText>{displayError}</Field.ErrorText>}
        </Field.Root>

        {rememberMe?.enabled !== false && (
          <Flex justify="space-between" align="center">
            <Checkbox.Root defaultChecked size="sm">
              <Checkbox.HiddenInput name="remember" />
              <Checkbox.Control />
              <Checkbox.Label>{rememberMe?.label}</Checkbox.Label>
            </Checkbox.Root>
            <Button
              variant="plain"
              size="sm"
              colorPalette="teal"
              onClick={onForgotPassword}
              type="button"
            >
              {password?.forgotPasswordLinkText}
            </Button>
          </Flex>
        )}

        <Button
          type="submit"
          width="full"
          colorPalette="teal"
          size="lg"
          loading={isLoading}
          disabled={isLoading}
        >
          {buttons?.submit}
        </Button>
      </Stack>
    </form>
  );
}
