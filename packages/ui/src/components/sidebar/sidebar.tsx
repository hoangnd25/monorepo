'use client';

import {
  createContext,
  useContext,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import {
  Box,
  Flex,
  VStack,
  Drawer,
  Portal,
  CloseButton,
  IconButton,
} from '../../chakra';

// Default menu icon component (hamburger)
function DefaultMenuIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}

// Context for sidebar state
interface SidebarContextValue {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onToggle: () => void;
}

const SidebarContext = createContext<SidebarContextValue | undefined>(
  undefined
);

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}

export interface SidebarProps {
  /** Header content (logo, title, etc.) */
  header?: ReactNode;
  /** Footer content (user profile, etc.) */
  footer?: ReactNode;
  /** Main navigation content */
  children: ReactNode;
  /** Width of the sidebar */
  width?: string | number;
  /** Background color */
  bg?: string;
  /** Border color */
  borderColor?: string;
}

interface SidebarContentProps {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  bg?: string;
  borderColor?: string;
  width?: string | number;
  showCloseButton?: boolean;
  onClose?: () => void;
}

function SidebarContent({
  header,
  footer,
  children,
  bg = 'bg',
  borderColor = 'border',
  width = '280px',
  showCloseButton = false,
  onClose,
}: SidebarContentProps) {
  return (
    <Flex
      direction="column"
      h="100%"
      w={width}
      bg={bg}
      borderRightWidth="1px"
      borderColor={borderColor}
    >
      {/* Header */}
      {header && (
        <Flex px={4} py={4} alignItems="center" justifyContent="space-between">
          <Box flex={1}>{header}</Box>
          {showCloseButton && onClose && (
            <CloseButton size="sm" onClick={onClose} />
          )}
        </Flex>
      )}

      {/* Navigation */}
      <VStack flex={1} overflowY="auto" py={4} px={2} gap={6} align="stretch">
        {children}
      </VStack>

      {/* Footer */}
      {footer && (
        <Box px={4} py={4}>
          {footer}
        </Box>
      )}
    </Flex>
  );
}

export interface SidebarRootProps extends SidebarProps {
  /** Controlled open state */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Default open state for uncontrolled mode */
  defaultOpen?: boolean;
  /** Additional content rendered outside the sidebar (like main content with trigger) */
  mainContent?: ReactNode;
}

export function SidebarRoot({
  header,
  footer,
  children,
  width = '280px',
  bg = 'bg',
  borderColor = 'border',
  open: controlledOpen,
  onOpenChange,
  defaultOpen = false,
  mainContent,
}: SidebarRootProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const handleOpenChange = (newOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(newOpen);
    }
    onOpenChange?.(newOpen);
  };

  const contextValue: SidebarContextValue = {
    isOpen,
    onOpen: () => handleOpenChange(true),
    onClose: () => handleOpenChange(false),
    onToggle: () => handleOpenChange(!isOpen),
  };

  return (
    <SidebarContext.Provider value={contextValue}>
      {/* Desktop sidebar - always visible on md+ */}
      <Box
        display={{ base: 'none', md: 'block' }}
        position="fixed"
        left={0}
        top={0}
        h="100vh"
        zIndex={10}
      >
        <SidebarContent
          header={header}
          footer={footer}
          bg={bg}
          borderColor={borderColor}
          width={width}
        >
          {children}
        </SidebarContent>
      </Box>

      {/* Mobile drawer */}
      <Drawer.Root
        open={isOpen}
        onOpenChange={(e) => handleOpenChange(e.open)}
        placement="start"
        size="xs"
      >
        <Portal>
          <Drawer.Backdrop />
          <Drawer.Positioner>
            <Drawer.Content bg={bg}>
              <SidebarContent
                header={header}
                footer={footer}
                bg={bg}
                borderColor={borderColor}
                width="100%"
                showCloseButton
                onClose={() => handleOpenChange(false)}
              >
                {children}
              </SidebarContent>
            </Drawer.Content>
          </Drawer.Positioner>
        </Portal>
      </Drawer.Root>

      {/* Main content area (optional) */}
      {mainContent}
    </SidebarContext.Provider>
  );
}

export interface SidebarTriggerProps {
  /** Custom trigger element. If not provided, a hamburger menu button is rendered */
  children?: ReactNode;
  /** Custom icon component to use for the trigger button */
  icon?: ComponentType;
  /** Additional className */
  className?: string;
}

export function SidebarTrigger({ children, icon: Icon }: SidebarTriggerProps) {
  const { onToggle } = useSidebar();

  if (children) {
    return (
      <Box onClick={onToggle} cursor="pointer">
        {children}
      </Box>
    );
  }

  return (
    <Box display={{ base: 'block', md: 'none' }}>
      <IconButton
        aria-label="Open sidebar"
        variant="ghost"
        size="md"
        onClick={onToggle}
      >
        {Icon ? <Icon /> : <DefaultMenuIcon />}
      </IconButton>
    </Box>
  );
}

// Compound component API
export const Sidebar = {
  Root: SidebarRoot,
  Trigger: SidebarTrigger,
};
