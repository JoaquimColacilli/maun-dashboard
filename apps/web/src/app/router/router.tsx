import { createBrowserRouter, Navigate } from 'react-router';

import { AccesoPage } from '@/pages/acceso';
import { AjustesPage } from '@/pages/ajustes';
import { ClienteFichaPage, ClientesPage } from '@/pages/clientes';
import { DiezmoPage } from '@/pages/diezmo';
import { FinanzasPage } from '@/pages/finanzas';
import { InicioPage } from '@/pages/inicio';
import {
  ProyectoEdicionPage,
  ProyectoFichaPage,
  ProyectoLiquidacionPage,
  ProyectoNuevoPage,
  ProyectosPage,
} from '@/pages/proyectos';

import { Marco } from '../layout/Marco';
import { Shell } from '../layout/Shell';
import { RutaConAcceso, RutaConSesion, RutaPublica } from './guardas';
import { CrearCuentaPage, NuevaContrasenaPage, RecuperarPage } from './paginas';

export const router = createBrowserRouter([
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
                children: [
                  { index: true, element: <InicioPage /> },
                  // Seguimiento es la primera pestaña de Proyectos y no una pantalla aparte: el
                  // control segmentado es el modelo mental del dueño, y en escritorio Seguimiento
                  // es además un destino propio, así que la pestaña tiene que ser una ruta.
                  { path: '/seguimiento', element: <ProyectosPage /> },
                  { path: '/proyectos', element: <ProyectosPage /> },
                  { path: '/proyectos/nuevo', element: <ProyectoNuevoPage /> },
                  { path: '/proyectos/:id', element: <ProyectoFichaPage /> },
                  { path: '/proyectos/:id/editar', element: <ProyectoEdicionPage /> },
                  {
                    path: '/proyectos/:id/cobrar',
                    element: <ProyectoLiquidacionPage destino="cobrado" />,
                  },
                  {
                    path: '/proyectos/:id/cerrar',
                    element: <ProyectoLiquidacionPage destino="perdido" />,
                  },
                  { path: '/clientes', element: <ClientesPage /> },
                  { path: '/clientes/:id', element: <ClienteFichaPage /> },
                  { path: '/finanzas', element: <FinanzasPage /> },
                  { path: '/diezmo', element: <DiezmoPage /> },
                  { path: '/ajustes', element: <AjustesPage /> },
                ],
              },
            ],
          },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
