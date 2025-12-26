import { Button, Field, IconButton, Input, InputGroup } from '../../chakra';
import { LuPencil } from 'react-icons/lu';

interface LoginUsernameField {
  value: string;
  error?: string;
  label?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  placeholder?: string;
  onChange?: () => void;
}

export interface LoginUsernameStepProps {
  usernameField: LoginUsernameField;
  continueButtonText?: string;
  isLoading?: boolean;
  showEditButton?: boolean;
  onEdit?: () => void;
}

export function LoginUsernameStep({
  usernameField,
  continueButtonText = 'Continue',
  isLoading = false,
  showEditButton = false,
  onEdit,
}: LoginUsernameStepProps) {
  const {
    label = 'Username',
    value,
    error,
    disabled,
    placeholder,
    autoFocus,
    onChange,
  } = usernameField;

  return (
    <>
      <Field.Root invalid={!!error}>
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
                aria-label={`Edit ${label?.toLowerCase() || 'username'}`}
                onClick={onEdit}
              >
                <LuPencil />
              </IconButton>
            }
          >
            <Input value={value} disabled size="lg" />
          </InputGroup>
        ) : (
          <Input
            name="username"
            disabled={disabled}
            size="lg"
            defaultValue={value}
            placeholder={placeholder}
            autoFocus={autoFocus}
            onChange={onChange}
          />
        )}
        {error && <Field.ErrorText>{error}</Field.ErrorText>}
      </Field.Root>

      {!showEditButton && (
        <Button
          type="submit"
          width="full"
          colorPalette="teal"
          size="lg"
          disabled={isLoading}
          loading={isLoading}
        >
          {continueButtonText}
        </Button>
      )}
    </>
  );
}
