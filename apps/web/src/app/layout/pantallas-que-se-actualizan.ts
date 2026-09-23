import { matchRoutes } from 'react-router';

import { RUTA_DE_PROYECTO_NUEVO } from '@/shared/lib';

const LEEN_DE_LA_REPLICA = [
  '/',
  '/agenda',
  '/consultas',
  '/proyectos',
  '/proyectos/:id',
  '/clientes',
  '/clientes/:id',
  '/finanzas',
  '/opiniones',
  '/diezmo',
];

const RUTAS = [...LEEN_DE_LA_REPLICA, RUTA_DE_PROYECTO_NUEVO].map((path) => ({ path }));

export function seActualizaTirando(pathname: string): boolean {
  const ruta = matchRoutes(RUTAS, pathname)?.[0]?.route.path;
  return ruta !== undefined && ruta !== RUTA_DE_PROYECTO_NUEVO;
}
