import { ChakraLink } from '@lib/ui';
import { Link } from '@tanstack/react-router';
import React from 'react';

interface CustomLinkProps extends React.PropsWithChildren {
  to: string;
}

export function CustomLink({ to, children, ...props }: CustomLinkProps) {
  return (
    <ChakraLink
      asChild
      color="fg.muted"
      fontWeight="medium"
      _hover={{ color: 'fg', textDecoration: 'none' }}
      transition="color 0.2s"
      {...props}
    >
      <Link to={to} preload="intent">
        {children}
      </Link>
    </ChakraLink>
  );
}
