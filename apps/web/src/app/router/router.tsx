import { createBrowserRouter, Navigate } from 'react-router';

import { AccesoPage } from '@/pages/acceso';

import { Shell } from '../layout/Shell';
import { RutaConAcceso, RutaConSesion, RutaPublica } from './guardas';
import {
  CrearCuentaPage,
  InicioPage,
  NuevaContrasenaPage,
  RecuperarPage,
  SinAccesoPage,
  VerificacionPage,
} from './paginas';

export const router = createBrowserRouter([
  {
    element: <Shell />,
    children: [
      { path: '/verificacion', element: <VerificacionPage /> },
      { path: '/acceso/nueva-contrasena', element: <NuevaContrasenaPage /> },
      {
        element: <RutaPublica />,
        children: [
          { path: '/acceso', element: <AccesoPage /> },
          { path: '/acceso/crear-cuenta', element: <CrearCuentaPage /> },
          { path: '/acceso/recuperar', element: <RecuperarPage /> },
        ],
      },
      {
        element: <RutaConSesion />,
        children: [
          { path: '/sin-acceso', element: <SinAccesoPage /> },
          { element: <RutaConAcceso />, children: [{ index: true, element: <InicioPage /> }] },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
