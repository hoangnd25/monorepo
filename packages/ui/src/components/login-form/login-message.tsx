import { Box, Text } from '../../chakra';

export type LoginMessageType = 'success' | 'error';

export interface LoginMessageProps {
  type: LoginMessageType;
  title: string;
  description: string;
}

export function LoginMessage({ type, title, description }: LoginMessageProps) {
  const bgColor = type === 'success' ? 'green.50' : 'red.50';
  const borderColor = type === 'success' ? 'green.200' : 'red.200';
  const titleColor = type === 'success' ? 'green.800' : 'red.800';
  const descriptionColor = type === 'success' ? 'green.700' : 'red.700';

  return (
    <Box
      borderWidth="1px"
      borderRadius="md"
      p={4}
      bg={bgColor}
      borderColor={borderColor}
    >
      <Text fontWeight="medium" color={titleColor} mb={2}>
        {title}
      </Text>
      <Text fontSize="sm" color={descriptionColor}>
        {description}
      </Text>
    </Box>
  );
}
