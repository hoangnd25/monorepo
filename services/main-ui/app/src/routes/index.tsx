import { createFileRoute } from '@tanstack/react-router';
import {
  Accordion,
  Badge,
  Box,
  Button,
  Card,
  Container,
  Flex,
  HStack,
  Heading,
  Icon,
  Image,
  SimpleGrid,
  Span,
  Stack,
  Text,
  VStack,
} from '@lib/ui';
import {
  LuArrowRight,
  LuBolt,
  LuChartColumn,
  LuCheck,
  LuMessageSquare,
  LuPlus,
  LuPuzzle,
  LuShield,
  LuSparkles,
  LuZap,
} from 'react-icons/lu';
import { Footer } from '~/components/Footer';
import { Header } from '~/components/Header';

export const Route = createFileRoute('/')({
  component: RouteComponent,
  head: () => ({
    meta: [
      {
        title: 'Nova AI - AI That Works for Your Business',
      },
      {
        name: 'description',
        content:
          'Nova AI helps small and medium businesses automate workflows, get insights from data, and work smarter. No technical team required.',
      },
    ],
  }),
});

const features = [
  {
    icon: LuMessageSquare,
    title: 'Smart AI Assistant',
    description:
      'Chat with your business data. Ask questions, get insights, and make decisions faster with our intelligent assistant.',
  },
  {
    icon: LuBolt,
    title: 'Workflow Automation',
    description:
      'Automate repetitive tasks and processes. Save hours every week and let your team focus on what matters.',
  },
  {
    icon: LuChartColumn,
    title: 'Business Insights',
    description:
      'Turn your data into actionable insights. Understand trends, spot opportunities, and grow your business.',
  },
  {
    icon: LuPuzzle,
    title: 'Easy Integrations',
    description:
      'Connect with the tools you already use. Seamlessly integrate with 50+ popular business applications.',
  },
];

const howItWorks = [
  {
    step: '01',
    title: 'Connect your tools',
    description:
      'Link your existing business apps in minutes. No coding or technical setup required.',
  },
  {
    step: '02',
    title: 'Tell Nova what you need',
    description:
      'Describe your goals in plain English. Nova learns your business and adapts to your workflow.',
  },
  {
    step: '03',
    title: 'Watch the magic happen',
    description:
      'Nova automates tasks, surfaces insights, and helps your team work smarter every day.',
  },
];

const testimonials = [
  {
    quote:
      "Nova saved us 15 hours a week on manual data entry. It's like having an extra team member who never sleeps.",
    name: 'Sarah Mitchell',
    role: 'Operations Manager',
    company: 'Bloom Bakery',
    image: 'https://i.pravatar.cc/150?u=sarah-m',
  },
  {
    quote:
      "We finally understand our customer data. Nova's insights helped us increase retention by 40%.",
    name: 'Marcus Chen',
    role: 'Founder',
    company: 'Velocity Marketing',
    image: 'https://i.pravatar.cc/150?u=marcus-c',
  },
  {
    quote:
      'Setting up automations used to take days with other tools. With Nova, I did it in an afternoon.',
    name: 'Elena Rodriguez',
    role: 'Owner',
    company: 'Casa Verde Shop',
    image: 'https://i.pravatar.cc/150?u=elena-r',
  },
];

const pricingPlans = [
  {
    name: 'Starter',
    price: 'Free',
    description: 'Perfect for trying out Nova',
    features: [
      'Up to 100 AI queries/month',
      '2 integrations',
      'Basic analytics',
      'Email support',
      'Community access',
    ],
    cta: 'Get Started',
    popular: false,
  },
  {
    name: 'Growth',
    price: '$29',
    period: '/month',
    description: 'For growing businesses',
    features: [
      'Unlimited AI queries',
      '10 integrations',
      'Advanced analytics',
      'Workflow automation',
      'Priority support',
      'Team collaboration (5 users)',
    ],
    cta: 'Start Free Trial',
    popular: true,
  },
  {
    name: 'Business',
    price: '$79',
    period: '/month',
    description: 'For scaling teams',
    features: [
      'Everything in Growth',
      'Unlimited integrations',
      'Custom AI training',
      'API access',
      'Dedicated support',
      'Unlimited team members',
      'SSO & advanced security',
    ],
    cta: 'Start Free Trial',
    popular: false,
  },
];

const faqItems = [
  {
    value: 'what-is',
    question: 'What is Nova AI?',
    answer:
      'Nova AI is an AI-powered platform designed for small and medium businesses. It helps you automate repetitive tasks, get insights from your business data, and work more efficiently — all without needing technical expertise.',
  },
  {
    value: 'technical',
    question: 'Do I need technical skills to use Nova?',
    answer:
      'Not at all! Nova is designed for business owners and teams, not developers. You can set up integrations, create automations, and chat with your data using plain English. No coding required.',
  },
  {
    value: 'security',
    question: 'How secure is my data?',
    answer:
      'Security is our top priority. All data is encrypted in transit and at rest. We are SOC 2 Type II certified and never use your data to train our AI models. You own your data, always.',
  },
  {
    value: 'integrations',
    question: 'What tools does Nova integrate with?',
    answer:
      'Nova connects with 50+ popular business tools including Google Workspace, Microsoft 365, Slack, QuickBooks, Shopify, HubSpot, Stripe, and many more. We add new integrations every month.',
  },
  {
    value: 'cancel',
    question: 'Can I cancel anytime?',
    answer:
      'Yes, absolutely. There are no long-term contracts. You can upgrade, downgrade, or cancel your subscription at any time. If you cancel, you will have access until the end of your billing period.',
  },
];

const trustedByLogos = [
  'Acme Corp',
  'Globex',
  'Initech',
  'Umbrella',
  'Stark Inc',
  'Wayne Co',
];

function RouteComponent() {
  return (
    <>
      <Header />
      <Box as="main" id="main-content">
        {/* Hero Section */}
        <Box
          bg="bg"
          py={{ base: 16, md: 24 }}
          position="relative"
          overflow="hidden"
        >
          {/* Subtle gradient background */}
          <Box
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            bgGradient="to-br"
            gradientFrom="teal.50"
            gradientTo="transparent"
            opacity={0.5}
          />
          <Container maxW="container.xl" position="relative">
            <VStack gap={8} textAlign="center" maxW="4xl" mx="auto">
              <Badge
                colorPalette="teal"
                variant="subtle"
                size="lg"
                px={4}
                py={1}
              >
                <HStack gap={2}>
                  <Icon boxSize={3}>
                    <LuSparkles />
                  </Icon>
                  <span>Now with GPT-4 powered insights</span>
                </HStack>
              </Badge>
              <Heading
                as="h1"
                size={{ base: '3xl', md: '5xl', lg: '6xl' }}
                fontWeight="bold"
                letterSpacing="tight"
                lineHeight="1.1"
              >
                AI that works for
                <br />
                <Text as="span" color="teal.500">
                  your business
                </Text>
              </Heading>
              <Text
                fontSize={{ base: 'lg', md: 'xl' }}
                color="fg.muted"
                maxW="2xl"
              >
                Help your team do more with less. Nova brings enterprise AI
                power to growing businesses — no technical team required.
              </Text>
              <HStack gap={4} pt={4} flexWrap="wrap" justify="center">
                <Button colorPalette="teal" size="lg">
                  Get Started Free
                  <Icon>
                    <LuArrowRight />
                  </Icon>
                </Button>
                <Button variant="outline" size="lg">
                  Book a Demo
                </Button>
              </HStack>
              <Text fontSize="sm" color="fg.muted">
                Free forever plan available. No credit card required.
              </Text>
            </VStack>
          </Container>
        </Box>

        {/* Trusted By Section */}
        <Box bg="bg.muted" py={8}>
          <Container maxW="container.xl">
            <VStack gap={6}>
              <Text
                fontSize="sm"
                color="fg.muted"
                fontWeight="medium"
                textTransform="uppercase"
                letterSpacing="wide"
              >
                Trusted by 2,000+ growing businesses
              </Text>
              <HStack
                gap={{ base: 6, md: 12 }}
                flexWrap="wrap"
                justify="center"
              >
                {trustedByLogos.map((logo) => (
                  <Text
                    key={logo}
                    fontSize="lg"
                    fontWeight="bold"
                    color="fg.muted"
                    opacity={0.5}
                  >
                    {logo}
                  </Text>
                ))}
              </HStack>
            </VStack>
          </Container>
        </Box>

        {/* Features Section */}
        <Box bg="bg" py={{ base: 16, md: 24 }} id="features">
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
                  Features
                </Text>
                <Heading as="h2" size={{ base: '2xl', md: '4xl' }}>
                  Everything you need to work smarter
                </Heading>
                <Text color="fg.muted" fontSize="lg">
                  Powerful AI tools designed for businesses like yours. Simple
                  to use, impossible to outgrow.
                </Text>
              </VStack>

              <SimpleGrid columns={{ base: 1, md: 2 }} gap={8} w="full">
                {features.map((feature) => (
                  <Card.Root
                    key={feature.title}
                    variant="outline"
                    p={8}
                    _hover={{ borderColor: 'teal.200', shadow: 'md' }}
                    transition="all 0.2s"
                  >
                    <Card.Body p={0}>
                      <VStack align="flex-start" gap={4}>
                        <Box
                          p={3}
                          bg="teal.50"
                          borderRadius="xl"
                          color="teal.500"
                        >
                          <Icon boxSize={6}>
                            <feature.icon />
                          </Icon>
                        </Box>
                        <Heading as="h3" size="lg">
                          {feature.title}
                        </Heading>
                        <Text color="fg.muted">{feature.description}</Text>
                      </VStack>
                    </Card.Body>
                  </Card.Root>
                ))}
              </SimpleGrid>
            </VStack>
          </Container>
        </Box>

        {/* How It Works Section */}
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
                  How It Works
                </Text>
                <Heading as="h2" size={{ base: '2xl', md: '4xl' }}>
                  Up and running in minutes
                </Heading>
                <Text color="fg.muted" fontSize="lg">
                  Getting started with Nova is simple. No lengthy onboarding, no
                  technical setup.
                </Text>
              </VStack>

              <SimpleGrid columns={{ base: 1, md: 3 }} gap={8} w="full">
                {howItWorks.map((step, index) => (
                  <VStack
                    key={step.step}
                    align="flex-start"
                    gap={4}
                    position="relative"
                  >
                    <Text
                      fontSize="5xl"
                      fontWeight="bold"
                      color="teal.100"
                      lineHeight={1}
                    >
                      {step.step}
                    </Text>
                    <Heading as="h3" size="lg">
                      {step.title}
                    </Heading>
                    <Text color="fg.muted">{step.description}</Text>
                    {index < howItWorks.length - 1 && (
                      <Icon
                        boxSize={6}
                        color="teal.300"
                        display={{ base: 'none', md: 'block' }}
                        position="absolute"
                        right={-4}
                        top={8}
                      >
                        <LuArrowRight />
                      </Icon>
                    )}
                  </VStack>
                ))}
              </SimpleGrid>
            </VStack>
          </Container>
        </Box>

        {/* Testimonials Section */}
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
                  Testimonials
                </Text>
                <Heading as="h2" size={{ base: '2xl', md: '4xl' }}>
                  Loved by businesses everywhere
                </Heading>
              </VStack>

              <SimpleGrid columns={{ base: 1, md: 3 }} gap={8} w="full">
                {testimonials.map((testimonial) => (
                  <Card.Root key={testimonial.name} variant="outline" p={6}>
                    <Card.Body p={0}>
                      <VStack align="flex-start" gap={6}>
                        <Text color="fg.muted" fontSize="md" fontStyle="italic">
                          &ldquo;{testimonial.quote}&rdquo;
                        </Text>
                        <HStack gap={3}>
                          <Image
                            src={testimonial.image}
                            alt={testimonial.name}
                            boxSize={12}
                            borderRadius="full"
                            objectFit="cover"
                          />
                          <VStack align="flex-start" gap={0}>
                            <Text fontWeight="semibold">
                              {testimonial.name}
                            </Text>
                            <Text fontSize="sm" color="fg.muted">
                              {testimonial.role}, {testimonial.company}
                            </Text>
                          </VStack>
                        </HStack>
                      </VStack>
                    </Card.Body>
                  </Card.Root>
                ))}
              </SimpleGrid>
            </VStack>
          </Container>
        </Box>

        {/* Pricing Section */}
        <Box bg="bg.muted" py={{ base: 16, md: 24 }} id="pricing">
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
                  Pricing
                </Text>
                <Heading as="h2" size={{ base: '2xl', md: '4xl' }}>
                  Simple, transparent pricing
                </Heading>
                <Text color="fg.muted" fontSize="lg">
                  Start free and scale as you grow. No hidden fees, no
                  surprises.
                </Text>
              </VStack>

              <SimpleGrid columns={{ base: 1, md: 3 }} gap={8} w="full">
                {pricingPlans.map((plan) => (
                  <Card.Root
                    key={plan.name}
                    variant={plan.popular ? 'elevated' : 'outline'}
                    p={8}
                    position="relative"
                    borderColor={plan.popular ? 'teal.500' : undefined}
                    borderWidth={plan.popular ? '2px' : '1px'}
                  >
                    {plan.popular && (
                      <Badge
                        colorPalette="teal"
                        position="absolute"
                        top={-3}
                        left="50%"
                        transform="translateX(-50%)"
                        px={3}
                        py={1}
                      >
                        Most Popular
                      </Badge>
                    )}
                    <Card.Body p={0}>
                      <VStack align="flex-start" gap={6}>
                        <VStack align="flex-start" gap={2}>
                          <Text fontWeight="semibold" fontSize="lg">
                            {plan.name}
                          </Text>
                          <HStack align="baseline" gap={1}>
                            <Text fontSize="4xl" fontWeight="bold">
                              {plan.price}
                            </Text>
                            {plan.period && (
                              <Text color="fg.muted">{plan.period}</Text>
                            )}
                          </HStack>
                          <Text color="fg.muted" fontSize="sm">
                            {plan.description}
                          </Text>
                        </VStack>

                        <Stack gap={3} w="full">
                          {plan.features.map((feature) => (
                            <HStack key={feature} gap={2}>
                              <Icon boxSize={4} color="teal.500">
                                <LuCheck />
                              </Icon>
                              <Text fontSize="sm">{feature}</Text>
                            </HStack>
                          ))}
                        </Stack>

                        <Button
                          w="full"
                          colorPalette={plan.popular ? 'teal' : undefined}
                          variant={plan.popular ? 'solid' : 'outline'}
                        >
                          {plan.cta}
                        </Button>
                      </VStack>
                    </Card.Body>
                  </Card.Root>
                ))}
              </SimpleGrid>
            </VStack>
          </Container>
        </Box>

        {/* FAQ Section */}
        <Box bg="bg" py={{ base: 16, md: 24 }}>
          <Container maxW="container.lg">
            <VStack gap={12}>
              <VStack gap={4} textAlign="center">
                <Text
                  color="teal.500"
                  fontWeight="semibold"
                  textTransform="uppercase"
                  letterSpacing="wide"
                  fontSize="sm"
                >
                  FAQ
                </Text>
                <Heading as="h2" size={{ base: '2xl', md: '4xl' }}>
                  Questions? We have answers
                </Heading>
              </VStack>

              <Accordion.Root
                collapsible
                variant="plain"
                w="full"
                defaultValue={['what-is']}
              >
                {faqItems.map((item) => (
                  <Accordion.Item
                    key={item.value}
                    value={item.value}
                    borderBottomWidth="1px"
                    borderColor="border"
                  >
                    <Accordion.ItemTrigger py={5}>
                      <Span flex="1" fontWeight="semibold" fontSize="lg">
                        {item.question}
                      </Span>
                      <Accordion.ItemIndicator>
                        <Icon>
                          <LuPlus />
                        </Icon>
                      </Accordion.ItemIndicator>
                    </Accordion.ItemTrigger>
                    <Accordion.ItemContent>
                      <Accordion.ItemBody pb={5} color="fg.muted">
                        {item.answer}
                      </Accordion.ItemBody>
                    </Accordion.ItemContent>
                  </Accordion.Item>
                ))}
              </Accordion.Root>
            </VStack>
          </Container>
        </Box>

        {/* CTA Section */}
        <Box bg="teal.600" color="white" py={{ base: 16, md: 24 }}>
          <Container maxW="container.xl">
            <VStack gap={8} textAlign="center">
              <VStack gap={4}>
                <Heading as="h2" size={{ base: '2xl', md: '4xl' }}>
                  Ready to work smarter?
                </Heading>
                <Text fontSize="xl" opacity={0.9} maxW="2xl">
                  Join thousands of businesses already using Nova AI to save
                  time, get insights, and grow faster.
                </Text>
              </VStack>
              <HStack gap={4} flexWrap="wrap" justify="center">
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
                  Talk to Sales
                </Button>
              </HStack>
              <HStack gap={6} pt={4} opacity={0.8}>
                <HStack gap={2}>
                  <Icon boxSize={4}>
                    <LuCheck />
                  </Icon>
                  <Text fontSize="sm">Free forever plan</Text>
                </HStack>
                <HStack gap={2}>
                  <Icon boxSize={4}>
                    <LuShield />
                  </Icon>
                  <Text fontSize="sm">SOC 2 certified</Text>
                </HStack>
                <HStack gap={2}>
                  <Icon boxSize={4}>
                    <LuZap />
                  </Icon>
                  <Text fontSize="sm">Setup in 5 minutes</Text>
                </HStack>
              </HStack>
            </VStack>
          </Container>
        </Box>

        <Footer />
      </Box>
    </>
  );
}
