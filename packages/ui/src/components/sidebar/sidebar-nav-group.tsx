'use client';

import { Box, Text, VStack, Collapsible } from '../../chakra';
import type { ReactNode } from 'react';

// Chevron icon for collapsible indicator
function ChevronIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export interface SidebarNavGroupProps {
  /** Group title/label */
  title: string;
  /** Child navigation items */
  children: ReactNode;
  /** Whether the group is collapsible */
  collapsible?: boolean;
  /** Whether the group is expanded by default (only applies when collapsible is true, uncontrolled mode) */
  defaultExpanded?: boolean;
  /** Controlled expanded state (only applies when collapsible is true) */
  expanded?: boolean;
  /** Callback when expanded state changes (only applies when collapsible is true) */
  onExpandedChange?: (expanded: boolean) => void;
}

export function SidebarNavGroup({
  title,
  children,
  collapsible = false,
  defaultExpanded = true,
  expanded,
  onExpandedChange,
}: SidebarNavGroupProps) {
  // Non-collapsible version (original behavior)
  if (!collapsible) {
    return (
      <Box>
        <Text
          fontSize="xs"
          fontWeight="semibold"
          color="fg.muted"
          textTransform="uppercase"
          letterSpacing="wider"
          mb={2}
          px={3}
        >
          {title}
        </Text>
        <VStack gap={1} align="stretch">
          {children}
        </VStack>
      </Box>
    );
  }

  // Collapsible version
  // Determine if we're in controlled mode
  const isControlled = expanded !== undefined;
  const collapsibleProps = isControlled
    ? {
        open: expanded,
        onOpenChange: (details: { open: boolean }) =>
          onExpandedChange?.(details.open),
      }
    : {
        defaultOpen: defaultExpanded,
        onOpenChange: (details: { open: boolean }) =>
          onExpandedChange?.(details.open),
      };

  return (
    <Collapsible.Root {...collapsibleProps}>
      <Collapsible.Trigger
        display="flex"
        alignItems="center"
        gap={1}
        width="100%"
        px={3}
        mb={2}
        cursor="pointer"
        _hover={{ color: 'fg' }}
      >
        <Collapsible.Indicator
          transition="transform 0.2s"
          _open={{ transform: 'rotate(90deg)' }}
          color="fg.muted"
        >
          <ChevronIcon />
        </Collapsible.Indicator>
        <Text
          fontSize="xs"
          fontWeight="semibold"
          color="fg.muted"
          textTransform="uppercase"
          letterSpacing="wider"
        >
          {title}
        </Text>
      </Collapsible.Trigger>
      <Collapsible.Content>
        <VStack gap={1} align="stretch">
          {children}
        </VStack>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
