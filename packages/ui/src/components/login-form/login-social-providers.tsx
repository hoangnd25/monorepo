import { Button, Spinner, Stack } from '../../chakra';

export interface SocialProvider {
  id: string;
  label?: string;
  onClick?: () => void;
  show?: boolean;
  icon?: React.ReactNode;
  loading?: boolean;
}

export interface LoginSocialProvidersProps {
  providers?: SocialProvider[];
  disabled?: boolean;
}

export function LoginSocialProviders({
  providers,
  disabled = false,
}: LoginSocialProvidersProps) {
  if (!providers || providers.length === 0) {
    return null;
  }

  const visibleProviders = providers.filter((p) => p.show !== false);

  if (visibleProviders.length === 0) {
    return null;
  }

  return (
    <>
      <Stack gap={3}>
        {visibleProviders.map((provider) => (
          <Button
            key={provider.id}
            type="button"
            width="full"
            variant="outline"
            size="lg"
            onClick={provider.onClick}
            disabled={disabled || provider.loading}
          >
            {provider.loading ? <Spinner size="sm" /> : provider.icon}
            {provider.label}
          </Button>
        ))}
      </Stack>
    </>
  );
}
