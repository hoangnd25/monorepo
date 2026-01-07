import { Box, HStack, Text, ChakraLink } from '../../chakra';
import type { ReactNode } from 'react';

export interface SidebarNavItemProps {
  /** Icon to display before the label */
  icon?: ReactNode;
  /** Label text */
  label: string;
  /** Whether this item is currently active/selected */
  active?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Optional href for link-based navigation */
  href?: string;
}

export function SidebarNavItem({
  icon,
  label,
  active = false,
  onClick,
  href,
}: SidebarNavItemProps) {
  const content = (
    <HStack
      gap={3}
      px={3}
      py={2}
      borderRadius="md"
      cursor="pointer"
      bg={active ? 'bg.muted' : 'transparent'}
      color={active ? 'fg' : 'fg.muted'}
      fontWeight={active ? 'medium' : 'normal'}
      _hover={{
        bg: 'bg.muted',
        color: 'fg',
      }}
      transition="all 0.2s"
      onClick={onClick}
    >
      {icon && (
        <Box flexShrink={0} color={active ? 'colorPalette.600' : 'fg.muted'}>
          {icon}
        </Box>
      )}
      <Text fontSize="sm">{label}</Text>
    </HStack>
  );

  if (href) {
    return (
      <ChakraLink href={href} textDecoration="none" display="block">
        {content}
      </ChakraLink>
    );
  }

  return content;
}
