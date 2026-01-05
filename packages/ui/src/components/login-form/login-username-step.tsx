import { useState } from 'react';
import {
  Button,
  Field,
  IconButton,
  Input,
  InputGroup,
  Stack,
} from '../../chakra';
import { LuPencil } from 'react-icons/lu';

export type LoginMethod = 'password' | 'magic-link';

export interface LoginMethodsResponse {
  methods: LoginMethod[];
  error?: string;
}

interface UsernameFieldConfig {
  label?: string;
  placeholder?: string;
  autoFocus?: boolean;
  validate?: (value: string) => string | undefined;
}

export interface LoginUsernameStepProps {
  username?: UsernameFieldConfig;
  continueButtonText?: string;
  isLoading?: boolean;
  showEditButton?: boolean;
  defaultValue?: string;
  onEdit?: () => void;
  onValidateUsername?: (username: string) => string | undefined;
  onUsernameVerified?: (
    username: string
  ) => Promise<LoginMethodsResponse | undefined>;
  onSubmit: (username: string, methods: LoginMethod[]) => void;
}

export function LoginUsernameStep({
  username,
  continueButtonText = 'Continue',
  isLoading = false,
  showEditButton = false,
  defaultValue = '',
  onEdit,
  onValidateUsername,
  onUsernameVerified,
  onSubmit,
}: LoginUsernameStepProps) {
  const [currentError, setCurrentError] = useState<string | undefined>();
  const [isVerifying, setIsVerifying] = useState(false);

  const label = username?.label || 'Username';

  const defaultValidateUsername = (value: string): string | undefined => {
    if (!value || value.trim() === '') {
      return `Please enter your ${label.toLowerCase()}`;
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

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const usernameInput = formData.get('username') as string;

    const validationError = validateUsername(usernameInput);
    if (validationError) {
      setCurrentError(validationError);
      return;
    }

    setCurrentError(undefined);

    // If onUsernameVerified callback is provided, call it to get available login methods
    let methodsToUse: LoginMethod[] = ['password']; // default
    if (onUsernameVerified) {
      setIsVerifying(true);
      try {
        const response = await onUsernameVerified(usernameInput);
        if (response?.error) {
          setCurrentError(response.error);
          setIsVerifying(false);
          return;
        }
        // Check if methods array is empty
        if (!response?.methods || response.methods.length === 0) {
          setCurrentError(
            'This email is not registered. Please sign up first.'
          );
          setIsVerifying(false);
          return;
        }
        methodsToUse = response.methods;
        setIsVerifying(false);
      } catch {
        setCurrentError('We could not verify your email. Please try again.');
        setIsVerifying(false);
        return;
      }
    }

    onSubmit(usernameInput, methodsToUse);
  };

  const isDisabled = isLoading || isVerifying;

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap={4}>
        <Field.Root invalid={!!currentError}>
          <Field.Label>{label}</Field.Label>
          {showEditButton ? (
            <InputGroup
              endElement={
                <IconButton
                  tabIndex={-1}
                  me="-2"
                  aspectRatio="square"
                  size="sm"
                  variant="ghost"
                  height="calc(100% - {spacing.2})"
                  aria-label={`Edit ${label.toLowerCase()}`}
                  onClick={onEdit}
                >
                  <LuPencil />
                </IconButton>
              }
            >
              <Input value={defaultValue} disabled size="lg" />
            </InputGroup>
          ) : (
            <Input
              name="username"
              disabled={isDisabled}
              size="lg"
              defaultValue={defaultValue}
              placeholder={username?.placeholder}
              autoFocus={username?.autoFocus}
              onChange={() => setCurrentError(undefined)}
            />
          )}
          {currentError && <Field.ErrorText>{currentError}</Field.ErrorText>}
        </Field.Root>

        {!showEditButton && (
          <Button
            type="submit"
            width="full"
            colorPalette="teal"
            size="lg"
            disabled={isDisabled}
            loading={isDisabled}
          >
            {continueButtonText}
          </Button>
        )}
      </Stack>
    </form>
  );
}
