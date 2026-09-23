import { matchPath } from 'react-router';

export type Forma = 'pantalla' | 'capa' | 'hoja';

export type SeccionDelCelular = 'inicio' | 'proyectos' | 'clientes' | 'finanzas';

export type GrupoDePestanas = 'proyectos' | 'opiniones';

export interface Pantalla {
  id: string;
  patron: string;
  etapa?: string | null;
  nombre: string;
  seccion: SeccionDelCelular;
  raiz: boolean;
  profundidad: number;
  forma: Forma;
  pestana?: { grupo: GrupoDePestanas; orden: number };
  indice?: true;
  redireccion?: true;
}

export const CATALOGO: readonly Pantalla[] = [
  {
    id: 'inicio',
    patron: '/',
    nombre: 'Inicio',
    seccion: 'inicio',
    raiz: true,
    profundidad: 0,
    forma: 'pantalla',
    indice: true,
  },
  {
    id: 'agenda',
    patron: '/agenda',
    nombre: 'Agenda',
    seccion: 'inicio',
    raiz: false,
    profundidad: 1,
    forma: 'pantalla',
  },
  {
    id: 'anotar',
    patron: '/agenda/anotar',
    nombre: 'Agenda',
    seccion: 'inicio',
    raiz: false,
    profundidad: 1,
    forma: 'hoja',
  },
  {
    id: 'consultas',
    patron: '/consultas',
    nombre: 'Consultas',
    seccion: 'proyectos',
    raiz: true,
    profundidad: 0,
    forma: 'pantalla',
    pestana: { grupo: 'proyectos', orden: 0 },
  },
  {
    id: 'consulta-nueva',
    patron: '/consultas/nueva',
    nombre: 'Consultas',
    seccion: 'proyectos',
    raiz: false,
    profundidad: 0,
    forma: 'hoja',
  },
  {
    id: 'seguimiento-viejo',
    patron: '/seguimiento',
    nombre: 'Consultas',
    seccion: 'proyectos',
    raiz: false,
    profundidad: 0,
    forma: 'pantalla',
    redireccion: true,
  },
  {
    id: 'seguimiento-nuevo-viejo',
    patron: '/seguimiento/nuevo',
    nombre: 'Consultas',
    seccion: 'proyectos',
    raiz: false,
    profundidad: 0,
    forma: 'pantalla',
    redireccion: true,
  },
  {
    id: 'seguimiento',
    patron: '/proyectos',
    etapa: 'seguimiento',
    nombre: 'Seguimiento',
    seccion: 'proyectos',
    raiz: true,
    profundidad: 0,
    forma: 'pantalla',
    pestana: { grupo: 'proyectos', orden: 1 },
  },
  {
    id: 'activos',
    patron: '/proyectos',
    etapa: null,
    nombre: 'Proyectos',
    seccion: 'proyectos',
    raiz: true,
    profundidad: 0,
    forma: 'pantalla',
    pestana: { grupo: 'proyectos', orden: 2 },
  },
  {
    id: 'historial',
    patron: '/proyectos',
    etapa: 'historial',
    nombre: 'Historial',
    seccion: 'proyectos',
    raiz: true,
    profundidad: 0,
    forma: 'pantalla',
    pestana: { grupo: 'proyectos', orden: 3 },
  },
  {
    id: 'proyecto-nuevo',
    patron: '/proyectos/nuevo',
    nombre: 'Proyecto nuevo',
    seccion: 'proyectos',
    raiz: false,
    profundidad: 1,
    forma: 'capa',
  },
  {
    id: 'ficha',
    patron: '/proyectos/:id',
    nombre: 'Proyectos',
    seccion: 'proyectos',
    raiz: false,
    profundidad: 1,
    forma: 'pantalla',
  },
  {
    id: 'editar',
    patron: '/proyectos/:id/editar',
    nombre: 'Editar proyecto',
    seccion: 'proyectos',
    raiz: false,
    profundidad: 2,
    forma: 'capa',
  },
  {
    id: 'aprobar',
    patron: '/proyectos/:id/aprobar',
    nombre: 'Aprobar',
    seccion: 'proyectos',
    raiz: false,
    profundidad: 2,
    forma: 'pantalla',
  },
  {
    id: 'compartir',
    patron: '/proyectos/:id/compartir',
    nombre: 'Mostrarle al cliente',
    seccion: 'proyectos',
    raiz: false,
    profundidad: 2,
    forma: 'pantalla',
  },
  {
    id: 'vista-cliente',
    patron: '/proyectos/:id/vista-cliente',
    nombre: 'Lo que ve el cliente',
    seccion: 'proyectos',
    raiz: false,
    profundidad: 3,
    forma: 'pantalla',
  },
  {
    id: 'cobrar',
    patron: '/proyectos/:id/cobrar',
    nombre: 'Cobrar',
    seccion: 'proyectos',
    raiz: false,
    profundidad: 2,
    forma: 'pantalla',
  },
  {
    id: 'cerrar',
    patron: '/proyectos/:id/cerrar',
    nombre: 'Dar por perdido',
    seccion: 'proyectos',
    raiz: false,
    profundidad: 2,
    forma: 'pantalla',
  },
  {
    id: 'clientes',
    patron: '/clientes',
    nombre: 'Clientes',
    seccion: 'clientes',
    raiz: true,
    profundidad: 0,
    forma: 'pantalla',
  },
  {
    id: 'cliente',
    patron: '/clientes/:id',
    nombre: 'Clientes',
    seccion: 'clientes',
    raiz: false,
    profundidad: 1,
    forma: 'pantalla',
  },
  {
    id: 'finanzas',
    patron: '/finanzas',
    nombre: 'Finanzas',
    seccion: 'finanzas',
    raiz: true,
    profundidad: 0,
    forma: 'pantalla',
  },
  {
    id: 'movimiento-nuevo',
    patron: '/finanzas/nuevo',
    nombre: 'Finanzas',
    seccion: 'finanzas',
    raiz: false,
    profundidad: 0,
    forma: 'hoja',
  },
  {
    id: 'movimiento',
    patron: '/finanzas/:id',
    nombre: 'Finanzas',
    seccion: 'finanzas',
    raiz: false,
    profundidad: 0,
    forma: 'hoja',
  },
  {
    id: 'resultados',
    patron: '/opiniones',
    nombre: 'Opiniones',
    seccion: 'inicio',
    raiz: false,
    profundidad: 1,
    forma: 'pantalla',
    pestana: { grupo: 'opiniones', orden: 0 },
  },
  {
    id: 'preguntas',
    patron: '/opiniones/preguntas',
    nombre: 'Opiniones',
    seccion: 'inicio',
    raiz: false,
    profundidad: 1,
    forma: 'pantalla',
    pestana: { grupo: 'opiniones', orden: 1 },
  },
  {
    id: 'diezmo',
    patron: '/diezmo',
    nombre: 'Diezmo',
    seccion: 'inicio',
    raiz: false,
    profundidad: 1,
    forma: 'pantalla',
  },
  {
    id: 'ajustes',
    patron: '/ajustes',
    nombre: 'Ajustes',
    seccion: 'inicio',
    raiz: false,
    profundidad: 1,
    forma: 'pantalla',
  },
  {
    id: 'avisos',
    patron: '/ajustes/avisos',
    nombre: 'Avisos',
    seccion: 'inicio',
    raiz: false,
    profundidad: 2,
    forma: 'pantalla',
  },
];

const ESPECIFICAS_PRIMERO = [...CATALOGO].sort(
  (una, otra) => Number(una.patron.includes(':')) - Number(otra.patron.includes(':')),
);

export interface Direccion {
  pathname: string;
  search: string;
}

export function direccionDe(url: string): Direccion {
  const sinHash = url.split('#')[0] ?? url;
  const [pathname = '/', busqueda = ''] = sinHash.split('?');
  return {
    pathname: pathname === '' ? '/' : pathname,
    search: busqueda === '' ? '' : `?${busqueda}`,
  };
}

export function pantallaDe(url: string): Pantalla | undefined {
  const { pathname, search } = direccionDe(url);
  const etapa = new URLSearchParams(search).get('etapa');
  return ESPECIFICAS_PRIMERO.find((pantalla) => {
    if (matchPath({ path: pantalla.patron, end: true }, pathname) === null) return false;
    if (pantalla.etapa === undefined) return true;
    const pedida = etapa === 'seguimiento' || etapa === 'historial' ? etapa : null;
    return pantalla.etapa === pedida;
  });
}

export function nombreDe(url: string): string | undefined {
  return pantallaDe(url)?.nombre;
}

export function esLaMismaPantalla(una: string, otra: string): boolean {
  const primera = pantallaDe(una);
  return primera !== undefined && primera.id === pantallaDe(otra)?.id;
}

export function sonPestanasDelMismoGrupo(una: string, otra: string): boolean {
  const primera = pantallaDe(una)?.pestana;
  const segunda = pantallaDe(otra)?.pestana;
  return (
    primera !== undefined &&
    segunda !== undefined &&
    primera.grupo === segunda.grupo &&
    primera.orden !== segunda.orden
  );
}
