import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Sidebar, SidebarNavItem, SidebarNavGroup } from './index';
import { Box, Flex, HStack, Text, Avatar } from '../../chakra';
import {
  LuLayoutDashboard,
  LuChartBar,
  LuHistory,
  LuBookmark,
  LuFileText,
  LuImage,
  LuUsers,
  LuSettings,
  LuMenu,
} from 'react-icons/lu';

function LogoIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="32" height="32" rx="6" fill="#319795" />
      <path
        d="M16 8L22 12V20L16 24L10 20V12L16 8Z"
        fill="white"
        fillOpacity="0.9"
      />
    </svg>
  );
}

// Header component for sidebar
function SidebarHeader() {
  return (
    <HStack gap={3}>
      <LogoIcon />
      <Text fontWeight="bold" fontSize="lg">
        Acme Inc
      </Text>
    </HStack>
  );
}

// Footer component for sidebar with user info
function SidebarFooter() {
  return (
    <HStack gap={3}>
      <Avatar.Root size="sm">
        <Avatar.Fallback name="John Doe" />
        <Avatar.Image src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=32&h=32&fit=crop&crop=face" />
      </Avatar.Root>
      <Box flex={1}>
        <Text fontSize="sm" fontWeight="medium">
          John Doe
        </Text>
        <Text fontSize="xs" color="fg.muted">
          john@chakra-ui.com
        </Text>
      </Box>
    </HStack>
  );
}

// Full sidebar content with navigation groups
function SidebarNavContent() {
  return (
    <>
      <SidebarNavGroup title="Dashboard">
        <SidebarNavItem icon={<LuLayoutDashboard />} label="Dashboard" />
        <SidebarNavItem icon={<LuChartBar />} label="Analytics" active />
        <SidebarNavItem icon={<LuHistory />} label="History" />
        <SidebarNavItem icon={<LuBookmark />} label="Favorites" />
      </SidebarNavGroup>

      <SidebarNavGroup title="Content">
        <SidebarNavItem icon={<LuFileText />} label="Documents" />
        <SidebarNavItem icon={<LuImage />} label="Media" />
        <SidebarNavItem icon={<LuUsers />} label="Users" />
        <SidebarNavItem icon={<LuSettings />} label="Settings" />
      </SidebarNavGroup>
    </>
  );
}

// Main content wrapper
function MainContent({
  title,
  sidebarWidth = '280px',
  description,
}: {
  title: string;
  sidebarWidth?: string;
  description: string;
}) {
  return (
    <Box ml={{ base: 0, md: sidebarWidth }} p={4}>
      <Flex justify="space-between" align="center" mb={6}>
        <Sidebar.Trigger icon={LuMenu} />
        <Text fontSize="2xl" fontWeight="bold">
          {title}
        </Text>
        <Box w="40px" />
      </Flex>
      <Box p={6} bg="bg" borderRadius="lg" shadow="sm">
        <Text color="fg.muted">{description}</Text>
      </Box>
    </Box>
  );
}

const meta = {
  title: 'Components/Sidebar',
  component: Sidebar.Root,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  argTypes: {
    width: {
      control: 'text',
      description: 'Width of the sidebar',
    },
    bg: {
      control: 'text',
      description: 'Background color',
    },
    borderColor: {
      control: 'text',
      description: 'Border color',
    },
    open: {
      control: 'boolean',
      description: 'Controlled open state (for mobile drawer)',
    },
    defaultOpen: {
      control: 'boolean',
      description: 'Default open state',
    },
  },
} satisfies Meta<typeof Sidebar.Root>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    header: <SidebarHeader />,
    footer: <SidebarFooter />,
    children: <SidebarNavContent />,
  },
  render: (args) => (
    <Box minH="100vh" bg="bg.subtle">
      <Sidebar.Root
        {...args}
        mainContent={
          <MainContent
            title="Dashboard"
            description="This is the main content area. On mobile (below md breakpoint), the sidebar is hidden and can be opened via the hamburger menu button. On desktop, the sidebar is always visible."
          />
        }
      />
    </Box>
  ),
};

export const WithCustomWidth: Story = {
  args: {
    header: <SidebarHeader />,
    footer: <SidebarFooter />,
    children: <SidebarNavContent />,
    width: '320px',
  },
  render: (args) => (
    <Box minH="100vh" bg="bg.subtle">
      <Sidebar.Root
        {...args}
        mainContent={
          <MainContent
            title="Wide Sidebar"
            sidebarWidth="320px"
            description="This example shows a wider sidebar (320px instead of 280px)."
          />
        }
      />
    </Box>
  ),
};

export const MinimalSidebar: Story = {
  args: {
    children: <SidebarNavContent />,
  },
  render: (args) => (
    <Box minH="100vh" bg="bg.subtle">
      <Sidebar.Root
        {...args}
        mainContent={
          <MainContent
            title="Minimal"
            description="This example shows a minimal sidebar without header or footer."
          />
        }
      />
    </Box>
  ),
};

export const NavigationItemStates: Story = {
  args: {
    header: <SidebarHeader />,
    children: (
      <SidebarNavGroup title="Navigation States">
        <SidebarNavItem icon={<LuLayoutDashboard />} label="Default Item" />
        <SidebarNavItem icon={<LuChartBar />} label="Active Item" active />
        <SidebarNavItem
          icon={<LuSettings />}
          label="Clickable Item"
          onClick={() => alert('Clicked!')}
        />
        <SidebarNavItem
          icon={<LuFileText />}
          label="Link Item"
          href="https://chakra-ui.com"
        />
      </SidebarNavGroup>
    ),
  },
  render: (args) => (
    <Box minH="100vh" bg="bg.subtle">
      <Sidebar.Root
        {...args}
        mainContent={
          <MainContent
            title="Nav States"
            description="This example demonstrates different navigation item states: default, active, clickable (with onClick), and link-based (with href)."
          />
        }
      />
    </Box>
  ),
};

export const MobileView: Story = {
  args: {
    header: <SidebarHeader />,
    footer: <SidebarFooter />,
    children: <SidebarNavContent />,
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
  render: (args) => (
    <Box minH="100vh" bg="bg.subtle">
      <Sidebar.Root
        {...args}
        mainContent={
          <Box p={4}>
            <Flex justify="space-between" align="center" mb={6}>
              <Sidebar.Trigger icon={LuMenu} />
              <Text fontSize="xl" fontWeight="bold">
                Mobile
              </Text>
              <Box w="40px" />
            </Flex>
            <Box p={6} bg="bg" borderRadius="lg" shadow="sm">
              <Text color="fg.muted">
                This is the mobile view. Click the hamburger menu button to open
                the sidebar as a slide-out drawer.
              </Text>
            </Box>
          </Box>
        }
      />
    </Box>
  ),
};

// Collapsible navigation content
function CollapsibleNavContent() {
  return (
    <>
      <SidebarNavGroup title="Dashboard" collapsible defaultExpanded>
        <SidebarNavItem icon={<LuLayoutDashboard />} label="Dashboard" />
        <SidebarNavItem icon={<LuChartBar />} label="Analytics" active />
        <SidebarNavItem icon={<LuHistory />} label="History" />
        <SidebarNavItem icon={<LuBookmark />} label="Favorites" />
      </SidebarNavGroup>

      <SidebarNavGroup title="Content" collapsible defaultExpanded>
        <SidebarNavItem icon={<LuFileText />} label="Documents" />
        <SidebarNavItem icon={<LuImage />} label="Media" />
        <SidebarNavItem icon={<LuUsers />} label="Users" />
        <SidebarNavItem icon={<LuSettings />} label="Settings" />
      </SidebarNavGroup>

      <SidebarNavGroup
        title="Collapsed by Default"
        collapsible
        defaultExpanded={false}
      >
        <SidebarNavItem icon={<LuFileText />} label="Hidden Item 1" />
        <SidebarNavItem icon={<LuFileText />} label="Hidden Item 2" />
        <SidebarNavItem icon={<LuFileText />} label="Hidden Item 3" />
      </SidebarNavGroup>
    </>
  );
}

export const CollapsibleGroups: Story = {
  args: {
    header: <SidebarHeader />,
    footer: <SidebarFooter />,
    children: <CollapsibleNavContent />,
  },
  render: (args) => (
    <Box minH="100vh" bg="bg.subtle">
      <Sidebar.Root
        {...args}
        mainContent={
          <MainContent
            title="Collapsible Groups"
            description="This example demonstrates collapsible navigation groups. Click on a group title to expand or collapse it. The first two groups are expanded by default, while the third is collapsed."
          />
        }
      />
    </Box>
  ),
};

// Controlled collapsible navigation content with accordion-like behavior
function ControlledAccordionNavContent() {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(
    'dashboard'
  );

  const handleGroupChange = (groupId: string) => (expanded: boolean) => {
    // Accordion behavior: only one group open at a time
    setExpandedGroup(expanded ? groupId : null);
  };

  return (
    <>
      <SidebarNavGroup
        title="Dashboard"
        collapsible
        expanded={expandedGroup === 'dashboard'}
        onExpandedChange={handleGroupChange('dashboard')}
      >
        <SidebarNavItem icon={<LuLayoutDashboard />} label="Dashboard" />
        <SidebarNavItem icon={<LuChartBar />} label="Analytics" active />
        <SidebarNavItem icon={<LuHistory />} label="History" />
        <SidebarNavItem icon={<LuBookmark />} label="Favorites" />
      </SidebarNavGroup>

      <SidebarNavGroup
        title="Content"
        collapsible
        expanded={expandedGroup === 'content'}
        onExpandedChange={handleGroupChange('content')}
      >
        <SidebarNavItem icon={<LuFileText />} label="Documents" />
        <SidebarNavItem icon={<LuImage />} label="Media" />
        <SidebarNavItem icon={<LuUsers />} label="Users" />
        <SidebarNavItem icon={<LuSettings />} label="Settings" />
      </SidebarNavGroup>

      <SidebarNavGroup
        title="Administration"
        collapsible
        expanded={expandedGroup === 'admin'}
        onExpandedChange={handleGroupChange('admin')}
      >
        <SidebarNavItem icon={<LuUsers />} label="Team Members" />
        <SidebarNavItem icon={<LuSettings />} label="Permissions" />
        <SidebarNavItem icon={<LuFileText />} label="Audit Logs" />
      </SidebarNavGroup>
    </>
  );
}

export const ControlledAccordionGroups: Story = {
  args: {
    header: <SidebarHeader />,
    footer: <SidebarFooter />,
    children: <ControlledAccordionNavContent />,
  },
  render: (args) => (
    <Box minH="100vh" bg="bg.subtle">
      <Sidebar.Root
        {...args}
        mainContent={
          <MainContent
            title="Controlled Accordion"
            description="This example demonstrates controlled collapsible groups with accordion-like behavior. Only one group can be expanded at a time. Click on a group title to expand it and automatically collapse the previously open group."
          />
        }
      />
    </Box>
  ),
};
