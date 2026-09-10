import { createBrowserRouter, Navigate } from 'react-router';

import { VerificacionPage } from '@/pages/verificacion';

import { Shell } from '../layout/Shell';

export const router = createBrowserRouter([
  {
    element: <Shell />,
    children: [
      { index: true, element: <VerificacionPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
