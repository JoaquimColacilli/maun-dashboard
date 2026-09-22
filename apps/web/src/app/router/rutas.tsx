import type { ReactNode } from 'react';
import type { RouteObject } from 'react-router';

import { AgendaPage, AnotarPage } from '@/pages/agenda';
import { AjustesPage, AvisosPage } from '@/pages/ajustes';
import { ClienteFichaPage, ClientesPage } from '@/pages/clientes';
import { DiezmoPage } from '@/pages/diezmo';
import { FinanzasPage, MovimientoEdicionPage, MovimientoNuevoPage } from '@/pages/finanzas';
import { InicioPage } from '@/pages/inicio';
import { PreguntasPage, ResultadosPage } from '@/pages/opiniones';
import {
  ContactoNuevoPage,
  ProyectoCompartirPage,
  ProyectoEdicionPage,
  ProyectoFichaPage,
  ProyectoLiquidacionPage,
  ProyectoNuevoPage,
  ProyectoPasajePage,
  ProyectosPage,
  ProyectoVistaClientePage,
} from '@/pages/proyectos';
import { HOJAS_POR_RUTA, type PatronDeHoja } from '@/shared/lib';

export const RUTAS_DE_PANTALLA: RouteObject[] = [
  { index: true, element: <InicioPage /> },
  { path: '/agenda', element: <AgendaPage /> },
  { path: '/seguimiento', element: <ProyectosPage /> },
  { path: '/proyectos', element: <ProyectosPage /> },
  { path: '/proyectos/nuevo', element: <ProyectoNuevoPage /> },
  { path: '/proyectos/:id', element: <ProyectoFichaPage /> },
  { path: '/proyectos/:id/editar', element: <ProyectoEdicionPage /> },
  { path: '/proyectos/:id/aprobar', element: <ProyectoPasajePage /> },
  { path: '/proyectos/:id/compartir', element: <ProyectoCompartirPage /> },
  { path: '/proyectos/:id/vista-cliente', element: <ProyectoVistaClientePage /> },
  { path: '/proyectos/:id/cobrar', element: <ProyectoLiquidacionPage destino="cobrado" /> },
  { path: '/proyectos/:id/cerrar', element: <ProyectoLiquidacionPage destino="perdido" /> },
  { path: '/clientes', element: <ClientesPage /> },
  { path: '/clientes/:id', element: <ClienteFichaPage /> },
  { path: '/finanzas', element: <FinanzasPage /> },
  { path: '/opiniones', element: <ResultadosPage /> },
  { path: '/opiniones/preguntas', element: <PreguntasPage /> },
  { path: '/diezmo', element: <DiezmoPage /> },
  { path: '/ajustes', element: <AjustesPage /> },
  { path: '/ajustes/avisos', element: <AvisosPage /> },
];

const HOJA: Readonly<Record<PatronDeHoja, ReactNode>> = {
  '/finanzas/nuevo': <MovimientoNuevoPage />,
  '/finanzas/:id': <MovimientoEdicionPage />,
  '/seguimiento/nuevo': <ContactoNuevoPage />,
  '/agenda/anotar': <AnotarPage />,
};

export const RUTAS_DE_HOJA: RouteObject[] = HOJAS_POR_RUTA.map(({ patron }) => ({
  path: patron,
  element: HOJA[patron],
}));
