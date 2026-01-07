import {
  Box,
  Container,
  HStack,
  Icon,
  SimpleGrid,
  Text,
  VStack,
} from '@lib/ui';
import { Link } from '@tanstack/react-router';
import { LuGithub, LuLinkedin, LuSparkles, LuTwitter } from 'react-icons/lu';

const footerLinks = {
  product: [
    { label: 'Features', href: '/#features' },
    { label: 'Pricing', href: '/#pricing' },
    { label: 'Integrations', href: '#' },
    { label: 'Changelog', href: '#' },
  ],
  company: [
    { label: 'About', href: '/about', isRoute: true },
    { label: 'Blog', href: '#' },
    { label: 'Careers', href: '#' },
    { label: 'Contact', href: '/about#contact', isRoute: false },
  ],
  resources: [
    { label: 'Documentation', href: '#' },
    { label: 'Help Center', href: '#' },
    { label: 'API Reference', href: '#' },
    { label: 'Status', href: '#' },
  ],
  legal: [
    { label: 'Privacy Policy', href: '#' },
    { label: 'Terms of Service', href: '#' },
    { label: 'Cookie Policy', href: '#' },
  ],
};

function FooterLinkGroup({
  title,
  links,
}: {
  title: string;
  links: Array<{ label: string; href: string; isRoute?: boolean }>;
}) {
  return (
    <VStack align="flex-start" gap={3}>
      <Text fontWeight="semibold" color="white" fontSize="sm">
        {title}
      </Text>
      {links.map((link) =>
        link.isRoute ? (
          <Link key={link.label} to={link.href as '/' | '/about'}>
            <Text
              color="gray.400"
              fontSize="sm"
              _hover={{ color: 'white' }}
              transition="color 0.2s"
            >
              {link.label}
            </Text>
          </Link>
        ) : (
          <a key={link.label} href={link.href}>
            <Text
              color="gray.400"
              fontSize="sm"
              _hover={{ color: 'white' }}
              transition="color 0.2s"
            >
              {link.label}
            </Text>
          </a>
        )
      )}
    </VStack>
  );
}

export function Footer() {
  return (
    <Box as="footer" bg="gray.900" color="white" py={16}>
      <Container maxW="container.xl">
        <SimpleGrid
          columns={{ base: 2, md: 5 }}
          gap={{ base: 8, md: 12 }}
          mb={12}
        >
          {/* Brand Column */}
          <VStack
            align="flex-start"
            gap={4}
            gridColumn={{ base: 'span 2', md: 'span 1' }}
          >
            <Link to="/">
              <HStack gap={2}>
                <Box
                  bg="teal.500"
                  color="white"
                  p={1.5}
                  borderRadius="lg"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Icon boxSize={4}>
                    <LuSparkles />
                  </Icon>
                </Box>
                <Text fontWeight="bold" fontSize="xl">
                  Nova AI
                </Text>
              </HStack>
            </Link>
            <Text color="gray.400" fontSize="sm" maxW="200px">
              AI that works for your business. Helping SMBs work smarter, not
              harder.
            </Text>
            <HStack gap={4} pt={2}>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Follow us on Twitter"
              >
                <Icon
                  boxSize={5}
                  color="gray.400"
                  cursor="pointer"
                  _hover={{ color: 'white' }}
                  transition="color 0.2s"
                >
                  <LuTwitter />
                </Icon>
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Connect on LinkedIn"
              >
                <Icon
                  boxSize={5}
                  color="gray.400"
                  cursor="pointer"
                  _hover={{ color: 'white' }}
                  transition="color 0.2s"
                >
                  <LuLinkedin />
                </Icon>
              </a>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="View our GitHub"
              >
                <Icon
                  boxSize={5}
                  color="gray.400"
                  cursor="pointer"
                  _hover={{ color: 'white' }}
                  transition="color 0.2s"
                >
                  <LuGithub />
                </Icon>
              </a>
            </HStack>
          </VStack>

          {/* Link Columns */}
          <FooterLinkGroup title="Product" links={footerLinks.product} />
          <FooterLinkGroup title="Company" links={footerLinks.company} />
          <FooterLinkGroup title="Resources" links={footerLinks.resources} />
          <FooterLinkGroup title="Legal" links={footerLinks.legal} />
        </SimpleGrid>

        {/* Bottom Bar */}
        <Box
          borderTopWidth="1px"
          borderColor="gray.800"
          pt={8}
          display="flex"
          flexDirection={{ base: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems="center"
          gap={4}
        >
          <Text color="gray.500" fontSize="sm">
            &copy; {new Date().getFullYear()} Nova AI. All rights reserved.
          </Text>
          <Text color="gray.500" fontSize="sm">
            Made with care for growing businesses
          </Text>
        </Box>
      </Container>
    </Box>
  );
}
