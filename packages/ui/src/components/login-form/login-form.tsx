import {
  Box,
  Button,
  Field,
  Input,
  Stack,
  VStack,
  Heading,
} from '../../chakra';

export interface LoginFormProps {
  onSubmit?: (email: string, password: string) => void;
  title?: string;
  emailLabel?: string;
  emailPlaceholder?: string;
  passwordLabel?: string;
  passwordPlaceholder?: string;
  submitButtonText?: string;
  isLoading?: boolean;
  emailError?: string;
  passwordError?: string;
  showTitle?: boolean;
}

export function LoginForm({
  onSubmit,
  title = 'Login',
  emailLabel = 'Email',
  emailPlaceholder = 'Enter your email',
  passwordLabel = 'Password',
  passwordPlaceholder = 'Enter your password',
  submitButtonText = 'Sign In',
  isLoading = false,
  emailError,
  passwordError,
  showTitle = true,
}: LoginFormProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    onSubmit?.(email, password);
  };

  return (
    <Box
      as="form"
      onSubmit={handleSubmit}
      width="full"
      maxWidth="md"
      padding={8}
      borderRadius="lg"
      borderWidth="1px"
      borderColor="gray.200"
    >
      <VStack gap={6} align="stretch">
        {showTitle && (
          <Heading size="xl" textAlign="center">
            {title}
          </Heading>
        )}

        <Stack gap={4}>
          <Field.Root required invalid={!!emailError}>
            <Field.Label>
              {emailLabel}
              <Field.RequiredIndicator />
            </Field.Label>
            <Input
              name="email"
              type="email"
              placeholder={emailPlaceholder}
              disabled={isLoading}
            />
            {emailError && <Field.ErrorText>{emailError}</Field.ErrorText>}
          </Field.Root>

          <Field.Root required invalid={!!passwordError}>
            <Field.Label>
              {passwordLabel}
              <Field.RequiredIndicator />
            </Field.Label>
            <Input
              name="password"
              type="password"
              placeholder={passwordPlaceholder}
              disabled={isLoading}
            />
            {passwordError && (
              <Field.ErrorText>{passwordError}</Field.ErrorText>
            )}
          </Field.Root>
        </Stack>

        <Button
          type="submit"
          width="full"
          colorPalette="blue"
          size="lg"
          loading={isLoading}
          disabled={isLoading}
        >
          {submitButtonText}
        </Button>
      </VStack>
    </Box>
  );
}
