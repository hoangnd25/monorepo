import { Text, ChakraLink } from '../../chakra';

export interface LoginFooterSignUp {
  enabled?: boolean;
  text?: string;
  linkText?: string;
  onLinkClick?: () => void;
}

export interface LoginFooterProps {
  signUp?: LoginFooterSignUp;
}

export function LoginFooter({
  signUp = {
    enabled: true,
    text: "Don't have an account?",
    linkText: 'Create account',
  },
}: LoginFooterProps) {
  if (!signUp?.enabled) {
    return null;
  }

  return (
    <Text textAlign="center" color="fg.muted">
      {signUp?.text}{' '}
      <ChakraLink
        colorPalette="teal"
        fontWeight="medium"
        onClick={signUp?.onLinkClick}
        cursor="pointer"
      >
        {signUp?.linkText}
      </ChakraLink>
    </Text>
  );
}
