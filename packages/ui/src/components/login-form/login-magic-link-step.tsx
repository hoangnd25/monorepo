import { useState } from 'react';
import { Button, VStack, Box, Text } from '../../chakra';

export interface LoginMagicLinkStepButtons {
  send?: string;
  tryAgain?: string;
}

export interface LoginMagicLinkStepProps {
  buttons?: LoginMagicLinkStepButtons;
  email?: string;
  isSent?: boolean;
  onSendMagicLink?: (email: string) => Promise<void>;
  onTryAgain?: () => void;
}

export function LoginMagicLinkStep({
  buttons = {
    send: 'Send me a login link',
    tryAgain: 'try again',
  },
  email = '',
  isSent = false,
  onSendMagicLink,
  onTryAgain,
}: LoginMagicLinkStepProps) {
  const [isSending, setIsSending] = useState(false);

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    if (!onSendMagicLink) return;

    setIsSending(true);
    try {
      await onSendMagicLink(email);
    } catch (error) {
      console.error('Failed to send magic link:', error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <VStack gap={4} align="stretch">
        {!isSent ? (
          <>
            <Box>
              <Text fontSize="sm" color="gray.600" mb={3}>
                We&apos;ll send you a secure link to sign in without a password.
              </Text>
            </Box>
            <Button
              type="submit"
              width="full"
              colorPalette="teal"
              size="lg"
              disabled={isSending}
              loading={isSending}
            >
              {buttons?.send}
            </Button>
          </>
        ) : (
          <Text fontSize="sm" color="gray.600" textAlign="center">
            Didn&apos;t receive the email? Check your spam folder or{' '}
            <Button
              variant="plain"
              size="xs"
              colorPalette="teal"
              onClick={onTryAgain}
              display="inline"
              verticalAlign="baseline"
              height="auto"
              minHeight="auto"
              p={0}
            >
              {buttons?.tryAgain}
            </Button>
          </Text>
        )}
      </VStack>
    </form>
  );
}
