import type { ReactNode } from 'react';
import type { RouteObject } from 'react-router';

import { AjustesPage } from '@/pages/ajustes';
import { ClienteFichaPage, ClientesPage } from '@/pages/clientes';
import { DiezmoPage } from '@/pages/diezmo';
import { FinanzasPage, MovimientoEdicionPage, MovimientoNuevoPage } from '@/pages/finanzas';
import { InicioPage } from '@/pages/inicio';
import {
  ContactoNuevoPage,
  ProyectoEdicionPage,
  ProyectoFichaPage,
  ProyectoLiquidacionPage,
  ProyectoNuevoPage,
  ProyectoPasajePage,
  ProyectosPage,
} from '@/pages/proyectos';
import { HOJAS_POR_RUTA, type PatronDeHoja } from '@/shared/lib';

export const RUTAS_DE_PANTALLA: RouteObject[] = [
  { index: true, element: <InicioPage /> },
  { path: '/seguimiento', element: <ProyectosPage /> },
  { path: '/proyectos', element: <ProyectosPage /> },
  { path: '/proyectos/nuevo', element: <ProyectoNuevoPage /> },
  { path: '/proyectos/:id', element: <ProyectoFichaPage /> },
  { path: '/proyectos/:id/editar', element: <ProyectoEdicionPage /> },
  { path: '/proyectos/:id/aprobar', element: <ProyectoPasajePage /> },
  { path: '/proyectos/:id/cobrar', element: <ProyectoLiquidacionPage destino="cobrado" /> },
  { path: '/proyectos/:id/cerrar', element: <ProyectoLiquidacionPage destino="perdido" /> },
  { path: '/clientes', element: <ClientesPage /> },
  { path: '/clientes/:id', element: <ClienteFichaPage /> },
  { path: '/finanzas', element: <FinanzasPage /> },
  { path: '/diezmo', element: <DiezmoPage /> },
  { path: '/ajustes', element: <AjustesPage /> },
];

const HOJA: Readonly<Record<PatronDeHoja, ReactNode>> = {
  '/finanzas/nuevo': <MovimientoNuevoPage />,
  '/finanzas/:id': <MovimientoEdicionPage />,
  '/seguimiento/nuevo': <ContactoNuevoPage />,
};

export const RUTAS_DE_HOJA: RouteObject[] = HOJAS_POR_RUTA.map(({ patron }) => ({
  path: patron,
  element: HOJA[patron],
}));
