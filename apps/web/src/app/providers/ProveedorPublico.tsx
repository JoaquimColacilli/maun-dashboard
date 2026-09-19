import { QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { crearQueryClientPublico } from './query-client';

export function ProveedorPublico({ children }: { children: ReactNode }) {
  const [queryClient] = useState(crearQueryClientPublico);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
