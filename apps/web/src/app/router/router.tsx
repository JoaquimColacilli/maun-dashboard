import { createBrowserRouter, Navigate } from 'react-router';

import { AccesoPage } from '@/pages/acceso';
import { VistaPublicaPage } from '@/pages/vista-cliente';
import { RUTA_DE_LA_VISTA_PUBLICA } from '@/shared/lib';

import { Marco } from '../layout/Marco';
import { Shell } from '../layout/Shell';
import { RutaConAcceso, RutaConSesion, RutaPublica } from './guardas';
import { CrearCuentaPage, NuevaContrasenaPage, RecuperarPage } from './paginas';
import { RUTAS_DE_HOJA, RUTAS_DE_PANTALLA } from './rutas';

export const router = createBrowserRouter([
  { path: RUTA_DE_LA_VISTA_PUBLICA, element: <VistaPublicaPage /> },
  {
    element: <Shell />,
    children: [
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
          {
            element: <RutaConAcceso />,
            children: [
              {
                element: <Marco />,
                children: [...RUTAS_DE_PANTALLA, ...RUTAS_DE_HOJA],
              },
            ],
          },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
