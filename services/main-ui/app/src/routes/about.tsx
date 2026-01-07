import { createFileRoute } from '@tanstack/react-router';
import {
  Alert,
  Box,
  Button,
  Card,
  Container,
  Flex,
  HStack,
  Heading,
  Icon,
  Image,
  Input,
  SimpleGrid,
  Stack,
  Stat,
  Text,
  Textarea,
  VStack,
} from '@lib/ui';
import { useState } from 'react';
import {
  LuArrowRight,
  LuGlobe,
  LuHeart,
  LuLightbulb,
  LuLock,
  LuMail,
  LuMapPin,
  LuRocket,
  LuSparkles,
  LuUsers,
} from 'react-icons/lu';
import { Footer } from '~/components/Footer';
import { Header } from '~/components/Header';

export const Route = createFileRoute('/about')({
  component: RouteComponent,
  head: () => ({
    meta: [
      {
        title: 'About - Nova AI',
      },
      {
        name: 'description',
        content:
          'Learn about Nova AI, our mission to democratize AI for small businesses, and the team behind the product.',
      },
    ],
  }),
});

const teamMembers = [
  {
    name: 'Alex Chen',
    role: 'Co-founder & CEO',
    bio: 'Former product lead at Stripe. Passionate about making technology accessible to everyone.',
    image: 'https://i.pravatar.cc/400?u=alex-chen',
  },
  {
    name: 'Maria Santos',
    role: 'Co-founder & CTO',
    bio: 'Ex-Google AI researcher. Building AI that actually helps real people.',
    image: 'https://i.pravatar.cc/400?u=maria-santos',
  },
  {
    name: 'Jordan Park',
    role: 'Head of Product',
    bio: 'Previously at HubSpot. Obsessed with delightful user experiences.',
    image: 'https://i.pravatar.cc/400?u=jordan-park',
  },
  {
    name: 'Sam Williams',
    role: 'Head of Customer Success',
    bio: 'Small business owner turned tech advocate. Speaks your language.',
    image: 'https://i.pravatar.cc/400?u=sam-williams',
  },
];

const values = [
  {
    icon: LuHeart,
    title: 'Customer Obsessed',
    description:
      'Every decision starts with our customers. We build what helps businesses succeed, not what looks impressive.',
  },
  {
    icon: LuLightbulb,
    title: 'Simple by Design',
    description:
      'Power should not mean complexity. We work hard to make Nova so simple your grandma could use it.',
  },
  {
    icon: LuLock,
    title: 'Privacy First',
    description:
      'Your data is yours. We never sell it, never use it for training, and protect it like our own.',
  },
  {
    icon: LuRocket,
    title: 'Always Improving',
    description:
      'We ship updates every week. Your feedback shapes our roadmap. We grow with you.',
  },
];

const stats = [
  { value: '2,000+', label: 'Businesses' },
  { value: '50+', label: 'Integrations' },
  { value: '99.9%', label: 'Uptime' },
  { value: '4.9/5', label: 'Rating' },
];

function RouteComponent() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
  });
  const [showAlert, setShowAlert] = useState(false);

  const handleSubmit = () => {
    setShowAlert(true);
    setFormData({ name: '', email: '', message: '' });
  };

  return (
    <>
      <Header />
      <Box as="main" id="main-content">
        {/* Hero Section */}
        <Box bg="bg" py={{ base: 16, md: 24 }}>
          <Container maxW="container.xl">
            <VStack gap={6} textAlign="center" maxW="4xl" mx="auto">
              <Text
                color="teal.500"
                fontWeight="semibold"
                textTransform="uppercase"
                letterSpacing="wide"
                fontSize="sm"
              >
                About Nova AI
              </Text>
              <Heading
                as="h1"
                size={{ base: '3xl', md: '4xl', lg: '5xl' }}
                fontWeight="bold"
                letterSpacing="tight"
                lineHeight="1.1"
              >
                Built for businesses
                <br />
                <Text as="span" color="teal.500">
                  like yours
                </Text>
              </Heading>
              <Text
                fontSize={{ base: 'lg', md: 'xl' }}
                color="fg.muted"
                maxW="2xl"
              >
                We started Nova because we believe every business deserves
                access to AI — not just the ones with big tech budgets.
              </Text>
            </VStack>
          </Container>
        </Box>

        {/* Story Section */}
        <Box bg="bg.muted" py={{ base: 16, md: 24 }}>
          <Container maxW="container.xl">
            <Flex
              direction={{ base: 'column', lg: 'row' }}
              gap={12}
              align="center"
            >
              <Box flex="1">
                <Image
                  src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&h=600&fit=crop"
                  alt="Team collaboration"
                  borderRadius="2xl"
                  w="full"
                  h={{ base: '300px', md: '400px' }}
                  objectFit="cover"
                />
              </Box>
              <VStack
                flex="1"
                align={{ base: 'center', lg: 'flex-start' }}
                gap={6}
              >
                <Text
                  color="teal.500"
                  fontWeight="semibold"
                  textTransform="uppercase"
                  letterSpacing="wide"
                  fontSize="sm"
                >
                  Our Story
                </Text>
                <Heading as="h2" size={{ base: '2xl', md: '3xl' }}>
                  From frustration to innovation
                </Heading>
                <Text
                  color="fg.muted"
                  fontSize="lg"
                  textAlign={{ base: 'center', lg: 'left' }}
                >
                  We saw small businesses struggling to keep up. Big companies
                  had AI teams, data scientists, and million-dollar tools. Local
                  shops, growing agencies, and family businesses? They were left
                  behind.
                </Text>
                <Text
                  color="fg.muted"
                  fontSize="lg"
                  textAlign={{ base: 'center', lg: 'left' }}
                >
                  That did not sit right with us. So we built Nova — AI that is
                  powerful enough for enterprise, but simple enough for anyone.
                  Because great technology should lift everyone up.
                </Text>
              </VStack>
            </Flex>
          </Container>
        </Box>

        {/* Stats Section */}
        <Box bg="teal.600" color="white" py={{ base: 12, md: 16 }}>
          <Container maxW="container.xl">
            <SimpleGrid columns={{ base: 2, md: 4 }} gap={8}>
              {stats.map((stat) => (
                <VStack key={stat.label}>
                  <Stat.Root textAlign="center">
                    <Stat.ValueText
                      fontSize={{ base: '3xl', md: '4xl' }}
                      fontWeight="bold"
                    >
                      {stat.value}
                    </Stat.ValueText>
                    <Stat.Label fontSize="md" color="whiteAlpha.800">
                      {stat.label}
                    </Stat.Label>
                  </Stat.Root>
                </VStack>
              ))}
            </SimpleGrid>
          </Container>
        </Box>

        {/* Values Section */}
        <Box bg="bg" py={{ base: 16, md: 24 }}>
          <Container maxW="container.xl">
            <VStack gap={16}>
              <VStack gap={4} textAlign="center" maxW="2xl" mx="auto">
                <Text
                  color="teal.500"
                  fontWeight="semibold"
                  textTransform="uppercase"
                  letterSpacing="wide"
                  fontSize="sm"
                >
                  Our Values
                </Text>
                <Heading as="h2" size={{ base: '2xl', md: '4xl' }}>
                  What we believe in
                </Heading>
                <Text color="fg.muted" fontSize="lg">
                  These principles guide everything we do, from product
                  decisions to how we support our customers.
                </Text>
              </VStack>

              <SimpleGrid columns={{ base: 1, md: 2 }} gap={8} w="full">
                {values.map((value) => (
                  <Card.Root key={value.title} variant="outline" p={8}>
                    <Card.Body p={0}>
                      <HStack gap={4} align="flex-start">
                        <Box
                          p={3}
                          bg="teal.50"
                          borderRadius="xl"
                          color="teal.500"
                        >
                          <Icon boxSize={6}>
                            <value.icon />
                          </Icon>
                        </Box>
                        <VStack align="flex-start" gap={2}>
                          <Heading as="h3" size="md">
                            {value.title}
                          </Heading>
                          <Text color="fg.muted">{value.description}</Text>
                        </VStack>
                      </HStack>
                    </Card.Body>
                  </Card.Root>
                ))}
              </SimpleGrid>
            </VStack>
          </Container>
        </Box>

        {/* Team Section */}
        <Box bg="bg.muted" py={{ base: 16, md: 24 }}>
          <Container maxW="container.xl">
            <VStack gap={16}>
              <VStack gap={4} textAlign="center" maxW="2xl" mx="auto">
                <Text
                  color="teal.500"
                  fontWeight="semibold"
                  textTransform="uppercase"
                  letterSpacing="wide"
                  fontSize="sm"
                >
                  Our Team
                </Text>
                <Heading as="h2" size={{ base: '2xl', md: '4xl' }}>
                  Meet the humans behind Nova
                </Heading>
                <Text color="fg.muted" fontSize="lg">
                  We are a small team with big ambitions. Every one of us is
                  here because we care about helping businesses succeed.
                </Text>
              </VStack>

              <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} gap={8} w="full">
                {teamMembers.map((member) => (
                  <Card.Root
                    key={member.name}
                    variant="outline"
                    overflow="hidden"
                  >
                    <Image
                      src={member.image}
                      alt={member.name}
                      w="full"
                      h="280px"
                      objectFit="cover"
                    />
                    <Card.Body p={6}>
                      <VStack align="flex-start" gap={2}>
                        <Heading as="h3" size="md">
                          {member.name}
                        </Heading>
                        <Text
                          color="teal.500"
                          fontSize="sm"
                          fontWeight="medium"
                        >
                          {member.role}
                        </Text>
                        <Text color="fg.muted" fontSize="sm">
                          {member.bio}
                        </Text>
                      </VStack>
                    </Card.Body>
                  </Card.Root>
                ))}
              </SimpleGrid>

              <Card.Root variant="outline" w="full" maxW="2xl" mx="auto" p={8}>
                <Card.Body p={0}>
                  <VStack gap={4} textAlign="center">
                    <Icon boxSize={10} color="teal.500">
                      <LuUsers />
                    </Icon>
                    <Heading as="h3" size="lg">
                      Join our team
                    </Heading>
                    <Text color="fg.muted">
                      We are always looking for talented people who care about
                      making technology accessible. Check out our open roles.
                    </Text>
                    <Button variant="outline" mt={2}>
                      View Open Positions
                      <Icon>
                        <LuArrowRight />
                      </Icon>
                    </Button>
                  </VStack>
                </Card.Body>
              </Card.Root>
            </VStack>
          </Container>
        </Box>

        {/* Contact Section */}
        <Box bg="bg" py={{ base: 16, md: 24 }} id="contact">
          <Container maxW="container.xl">
            <Flex
              direction={{ base: 'column', lg: 'row' }}
              gap={12}
              align="flex-start"
            >
              {/* Contact Info */}
              <VStack
                flex="1"
                align={{ base: 'center', lg: 'flex-start' }}
                gap={6}
              >
                <Text
                  color="teal.500"
                  fontWeight="semibold"
                  textTransform="uppercase"
                  letterSpacing="wide"
                  fontSize="sm"
                >
                  Contact Us
                </Text>
                <Heading as="h2" size={{ base: '2xl', md: '3xl' }}>
                  Let&apos;s talk
                </Heading>
                <Text
                  color="fg.muted"
                  fontSize="lg"
                  textAlign={{ base: 'center', lg: 'left' }}
                >
                  Have questions about Nova? Want to see a demo? We would love
                  to hear from you.
                </Text>

                <Stack gap={4} pt={4}>
                  <HStack gap={3}>
                    <Box p={2} bg="teal.50" borderRadius="lg" color="teal.500">
                      <Icon boxSize={5}>
                        <LuMail />
                      </Icon>
                    </Box>
                    <VStack align="flex-start" gap={0}>
                      <Text fontWeight="medium">Email</Text>
                      <Text color="fg.muted" fontSize="sm">
                        hello@nova-ai.com
                      </Text>
                    </VStack>
                  </HStack>
                  <HStack gap={3}>
                    <Box p={2} bg="teal.50" borderRadius="lg" color="teal.500">
                      <Icon boxSize={5}>
                        <LuMapPin />
                      </Icon>
                    </Box>
                    <VStack align="flex-start" gap={0}>
                      <Text fontWeight="medium">Location</Text>
                      <Text color="fg.muted" fontSize="sm">
                        San Francisco, CA (Remote-first)
                      </Text>
                    </VStack>
                  </HStack>
                  <HStack gap={3}>
                    <Box p={2} bg="teal.50" borderRadius="lg" color="teal.500">
                      <Icon boxSize={5}>
                        <LuGlobe />
                      </Icon>
                    </Box>
                    <VStack align="flex-start" gap={0}>
                      <Text fontWeight="medium">Support</Text>
                      <Text color="fg.muted" fontSize="sm">
                        Available 24/7 for Business plans
                      </Text>
                    </VStack>
                  </HStack>
                </Stack>
              </VStack>

              {/* Contact Form */}
              <Card.Root
                flex="1"
                w="full"
                maxW={{ lg: '500px' }}
                variant="outline"
              >
                <Card.Body p={8}>
                  {showAlert && (
                    <Alert.Root status="success" mb={6} borderRadius="md">
                      <Alert.Indicator />
                      <Alert.Title>Message sent!</Alert.Title>
                      <Alert.Description>
                        We will get back to you within 24 hours.
                      </Alert.Description>
                    </Alert.Root>
                  )}

                  <Stack gap={5}>
                    <Box>
                      <Text mb={2} fontWeight="medium" fontSize="sm">
                        Name
                      </Text>
                      <Input
                        placeholder="Your name"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                      />
                    </Box>
                    <Box>
                      <Text mb={2} fontWeight="medium" fontSize="sm">
                        Email
                      </Text>
                      <Input
                        placeholder="you@company.com"
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                      />
                    </Box>
                    <Box>
                      <Text mb={2} fontWeight="medium" fontSize="sm">
                        Message
                      </Text>
                      <Textarea
                        placeholder="Tell us how we can help..."
                        rows={4}
                        value={formData.message}
                        onChange={(e) =>
                          setFormData({ ...formData, message: e.target.value })
                        }
                      />
                    </Box>
                    <Button
                      colorPalette="teal"
                      size="lg"
                      onClick={handleSubmit}
                    >
                      Send Message
                      <Icon>
                        <LuArrowRight />
                      </Icon>
                    </Button>
                  </Stack>
                </Card.Body>
              </Card.Root>
            </Flex>
          </Container>
        </Box>

        {/* CTA Section */}
        <Box bg="teal.600" color="white" py={{ base: 16, md: 24 }}>
          <Container maxW="container.xl">
            <VStack gap={8} textAlign="center">
              <HStack gap={2}>
                <Icon boxSize={8}>
                  <LuSparkles />
                </Icon>
              </HStack>
              <Heading as="h2" size={{ base: '2xl', md: '4xl' }}>
                Ready to transform your business?
              </Heading>
              <Text fontSize="xl" opacity={0.9} maxW="2xl">
                Join thousands of businesses already using Nova AI. Start free
                today — no credit card required.
              </Text>
              <HStack gap={4} pt={4} flexWrap="wrap" justify="center">
                <Button
                  size="lg"
                  bg="white"
                  color="teal.600"
                  _hover={{ bg: 'gray.100' }}
                >
                  Get Started Free
                  <Icon>
                    <LuArrowRight />
                  </Icon>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  borderColor="whiteAlpha.500"
                  color="white"
                  _hover={{ bg: 'whiteAlpha.200' }}
                >
                  Schedule a Demo
                </Button>
              </HStack>
            </VStack>
          </Container>
        </Box>

        <Footer />
      </Box>
    </>
  );
}
