import type { NombreDeIcono } from '@/shared/ui';

export type IdDeSeccion =
  | 'inicio'
  | 'agenda'
  | 'seguimiento'
  | 'proyectos'
  | 'clientes'
  | 'finanzas'
  | 'opiniones'
  | 'diezmo'
  | 'ajustes';

export interface Destino {
  id: IdDeSeccion;
  etiqueta: string;
  ruta: string;
  icono: NombreDeIcono;
  alternativa?: IdDeSeccion;
}

export const DESTINOS: Readonly<Record<IdDeSeccion, Destino>> = {
  inicio: { id: 'inicio', etiqueta: 'Inicio', ruta: '/', icono: 'house' },
  agenda: {
    id: 'agenda',
    etiqueta: 'Agenda',
    ruta: '/agenda',
    icono: 'calendar-days',
    alternativa: 'inicio',
  },
  seguimiento: {
    id: 'seguimiento',
    etiqueta: 'Seguimiento',
    ruta: '/seguimiento',
    icono: 'route',
    alternativa: 'proyectos',
  },
  proyectos: { id: 'proyectos', etiqueta: 'Proyectos', ruta: '/proyectos', icono: 'folder-kanban' },
  clientes: { id: 'clientes', etiqueta: 'Clientes', ruta: '/clientes', icono: 'users' },
  finanzas: { id: 'finanzas', etiqueta: 'Finanzas', ruta: '/finanzas', icono: 'wallet' },
  opiniones: {
    id: 'opiniones',
    etiqueta: 'Opiniones',
    ruta: '/opiniones',
    icono: 'message-square-quote',
    alternativa: 'inicio',
  },
  diezmo: {
    id: 'diezmo',
    etiqueta: 'Diezmo',
    ruta: '/diezmo',
    icono: 'church',
    alternativa: 'inicio',
  },
  ajustes: {
    id: 'ajustes',
    etiqueta: 'Ajustes',
    ruta: '/ajustes',
    icono: 'settings',
    alternativa: 'inicio',
  },
};

export const NAV_MOVIL: readonly IdDeSeccion[] = ['inicio', 'proyectos', 'clientes', 'finanzas'];

export const NAV_TABLET: readonly IdDeSeccion[] = [
  'inicio',
  'agenda',
  'proyectos',
  'clientes',
  'finanzas',
  'diezmo',
];

export const NAV_ESCRITORIO: readonly IdDeSeccion[] = [
  'inicio',
  'agenda',
  'seguimiento',
  'proyectos',
  'clientes',
  'finanzas',
  'diezmo',
  'ajustes',
];

export interface AccionRapida {
  etiqueta: string;
  icono: NombreDeIcono;
  ruta: string;
}

export const ACCIONES_RAPIDAS: readonly AccionRapida[] = [
  { etiqueta: 'Anotar algo', icono: 'pencil-line', ruta: '/agenda/anotar' },
  { etiqueta: 'Movimiento', icono: 'arrow-left-right', ruta: '/finanzas/nuevo' },
  { etiqueta: 'Cobro de proyecto', icono: 'hand-coins', ruta: '/proyectos' },
  { etiqueta: 'Proyecto nuevo', icono: 'folder-plus', ruta: '/proyectos/nuevo' },
  { etiqueta: 'Contacto de seguimiento', icono: 'user-plus', ruta: '/seguimiento/nuevo' },
];

export function seccionDeLaRuta(ruta: string): IdDeSeccion {
  for (const destino of Object.values(DESTINOS)) {
    if (destino.ruta === '/') continue;
    if (ruta === destino.ruta || ruta.startsWith(`${destino.ruta}/`)) return destino.id;
  }
  return 'inicio';
}

export function destinoResaltado(
  seccion: IdDeSeccion,
  visibles: readonly IdDeSeccion[],
): IdDeSeccion | undefined {
  if (visibles.includes(seccion)) return seccion;
  const alternativa = DESTINOS[seccion].alternativa;
  return alternativa !== undefined && visibles.includes(alternativa) ? alternativa : undefined;
}
