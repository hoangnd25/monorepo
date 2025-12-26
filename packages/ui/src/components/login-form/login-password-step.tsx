import { Button, Checkbox, Field, Flex, Stack } from '../../chakra';
import { PasswordInput } from '../password-input';
import { LoginDivider } from './login-divider';

export type LoginMethod = 'password' | 'magic-link';

export interface LoginPasswordStepPassword {
  error?: string;
  label?: string;
  forgotPasswordLinkText?: string;
}

export interface LoginPasswordStepButtons {
  submit?: string;
  magicLink?: string;
}

export interface LoginPasswordStepRememberMe {
  show?: boolean;
  label?: string;
}

export interface LoginPasswordStepProps {
  password?: LoginPasswordStepPassword;
  buttons?: LoginPasswordStepButtons;
  rememberMe?: LoginPasswordStepRememberMe;
  availableMethods?: LoginMethod[];
  isLoading?: boolean;
  onForgotPassword?: () => void;
  onMagicLinkRequest?: () => void;
  onPasswordChange?: () => void;
}

export function LoginPasswordStep({
  password = {
    label: 'Password',
    forgotPasswordLinkText: 'Forgot password?',
  },
  buttons = {
    submit: 'Sign in',
    magicLink: 'Send me a login link',
  },
  rememberMe = {
    show: true,
    label: 'Keep me signed in',
  },
  availableMethods = ['password'],
  isLoading = false,
  onForgotPassword,
  onMagicLinkRequest,
  onPasswordChange,
}: LoginPasswordStepProps) {
  const showPassword = availableMethods.includes('password');
  const showMagicLink = availableMethods.includes('magic-link');

  return (
    <>
      {showPassword && (
        <Stack gap={4}>
          <Field.Root invalid={!!password?.error}>
            <Field.Label>{password?.label}</Field.Label>
            <PasswordInput
              name="password"
              disabled={isLoading}
              size="lg"
              autoFocus
              onChange={onPasswordChange}
            />
            {password?.error && (
              <Field.ErrorText>{password.error}</Field.ErrorText>
            )}
          </Field.Root>
        </Stack>
      )}

      {showPassword && rememberMe?.show !== false && (
        <Flex justify="space-between" align="center">
          {rememberMe?.show && (
            <Checkbox.Root defaultChecked size="sm">
              <Checkbox.HiddenInput name="remember" />
              <Checkbox.Control />
              <Checkbox.Label>{rememberMe?.label}</Checkbox.Label>
            </Checkbox.Root>
          )}
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

      {showPassword && (
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
      )}

      {showPassword && showMagicLink && <LoginDivider text="or" />}

      {showMagicLink && (
        <Button
          type="button"
          width="full"
          variant="outline"
          size="lg"
          onClick={onMagicLinkRequest}
          disabled={isLoading}
        >
          {buttons?.magicLink}
        </Button>
      )}
    </>
  );
}
