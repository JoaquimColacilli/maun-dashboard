import { expect, type Page } from '@playwright/test';

import type { Excepcion } from './medicion';
import type { TallerSembrado } from './sembrar';

const CARGA = { timeout: 30_000 };

export interface Pantalla {
  clave: string;
  nombre: string;
  ruta: (taller: TallerSembrado) => string;
  listo: (page: Page) => Promise<void>;
  sinSesion?: boolean;
  sinMarco?: string;
}

const HOJA =
  'Es una hoja: en la compu se abre como panel encima de la pantalla, con su propio ancho, no como una página.';

async function enElMarco(page: Page): Promise<void> {
  await expect(page.locator('main#contenido')).toBeVisible(CARGA);
  await expect(
    page.getByRole('status').filter({ hasText: /Abriendo la app|Trayendo los datos|Cargando/ }),
  ).toHaveCount(0, CARGA);
  await expect(page.locator('main#contenido h1').first()).toBeVisible(CARGA);
}

async function conHoja(page: Page): Promise<void> {
  await expect(page.locator('dialog[open]')).toBeVisible(CARGA);
}

async function laVistaDelCliente(page: Page): Promise<void> {
  await expect(page.getByRole('region', { name: 'Tu mueble' })).toBeVisible(CARGA);
  await expect(page.locator('[data-fin-de-la-vista]')).toBeAttached(CARGA);
}

export const PANTALLAS: readonly Pantalla[] = [
  { clave: 'inicio', nombre: 'Inicio', ruta: () => '/', listo: enElMarco },
  { clave: 'agenda', nombre: 'Agenda', ruta: () => '/agenda', listo: enElMarco },
  { clave: 'seguimiento', nombre: 'Seguimiento', ruta: () => '/seguimiento', listo: enElMarco },
  { clave: 'activos', nombre: 'Proyectos: activos', ruta: () => '/proyectos', listo: enElMarco },
  {
    clave: 'historial',
    nombre: 'Proyectos: historial',
    ruta: () => '/proyectos?etapa=historial',
    listo: enElMarco,
  },
  {
    clave: 'obra',
    nombre: 'Ficha de una obra',
    ruta: (t) => `/proyectos/${t.obra}`,
    listo: enElMarco,
  },
  {
    clave: 'entregado',
    nombre: 'Ficha de una obra entregada',
    ruta: (t) => `/proyectos/${t.entregado}`,
    listo: enElMarco,
  },
  {
    clave: 'contacto',
    nombre: 'Ficha de un contacto',
    ruta: (t) => `/proyectos/${t.contacto}`,
    listo: enElMarco,
  },
  {
    clave: 'nuevo',
    nombre: 'Proyecto nuevo',
    ruta: () => '/proyectos/nuevo',
    listo: async (page) => {
      await expect(page.getByText('Proyecto nuevo', { exact: true })).toBeVisible(CARGA);
    },
  },
  {
    clave: 'editar',
    nombre: 'Editar proyecto',
    ruta: (t) => `/proyectos/${t.obra}/editar`,
    listo: async (page) => {
      await expect(page.getByText('Editar proyecto', { exact: true })).toBeVisible(CARGA);
    },
  },
  {
    clave: 'aprobar',
    nombre: 'Aprobar un presupuesto',
    ruta: (t) => `/proyectos/${t.enviado}/aprobar`,
    listo: enElMarco,
  },
  {
    clave: 'compartir',
    nombre: 'Compartir con el cliente',
    ruta: (t) => `/proyectos/${t.obra}/compartir`,
    listo: enElMarco,
  },
  {
    clave: 'vista-en-la-app',
    nombre: 'Lo que ve el cliente, desde la app',
    ruta: (t) => `/proyectos/${t.obra}/vista-cliente`,
    listo: laVistaDelCliente,
  },
  {
    clave: 'cobrar',
    nombre: 'Cobrar',
    ruta: (t) => `/proyectos/${t.entregado}/cobrar`,
    listo: enElMarco,
  },
  {
    clave: 'cerrar',
    nombre: 'Dar por perdido',
    ruta: (t) => `/proyectos/${t.obra}/cerrar`,
    listo: enElMarco,
  },
  { clave: 'clientes', nombre: 'Clientes', ruta: () => '/clientes', listo: enElMarco },
  {
    clave: 'cliente',
    nombre: 'Ficha de un cliente',
    ruta: (t) => `/clientes/${t.cliente}`,
    listo: enElMarco,
  },
  { clave: 'finanzas', nombre: 'Finanzas', ruta: () => '/finanzas', listo: enElMarco },
  { clave: 'diezmo', nombre: 'Diezmo', ruta: () => '/diezmo', listo: enElMarco },
  { clave: 'opiniones', nombre: 'Opiniones', ruta: () => '/opiniones', listo: enElMarco },
  {
    clave: 'preguntas',
    nombre: 'Opiniones: preguntas',
    ruta: () => '/opiniones/preguntas',
    listo: enElMarco,
  },
  { clave: 'ajustes', nombre: 'Ajustes', ruta: () => '/ajustes', listo: enElMarco },
  {
    clave: 'avisos',
    nombre: 'Ajustes: avisos',
    ruta: () => '/ajustes/avisos',
    listo: async (page) => {
      await enElMarco(page);
      await expect(page.getByText(/Cargando|Buscando/)).toHaveCount(0, CARGA);
    },
  },
  {
    clave: 'movimiento-nuevo',
    sinMarco: HOJA,
    nombre: 'Hoja: cargar un movimiento',
    ruta: () => '/finanzas/nuevo',
    listo: conHoja,
  },
  {
    clave: 'contacto-nuevo',
    sinMarco: HOJA,
    nombre: 'Hoja: cargar un contacto',
    ruta: () => '/seguimiento/nuevo',
    listo: conHoja,
  },
  {
    clave: 'anotar',
    sinMarco: HOJA,
    nombre: 'Hoja: anotar en la agenda',
    ruta: () => '/agenda/anotar',
    listo: conHoja,
  },
  {
    clave: 'vista-publica',
    nombre: 'Lo que ve el cliente, por el enlace',
    ruta: (t) => `/v/${t.enlace}`,
    listo: laVistaDelCliente,
  },
  {
    clave: 'encuesta',
    sinMarco:
      'La encuesta del cliente es una sola columna angosta centrada, pensada para el celular: no lleva el molde de las páginas del taller.',
    nombre: 'La encuesta que abre el cliente',
    ruta: (t) => `/o/${t.encuesta}`,
    listo: async (page) => {
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible(CARGA);
    },
  },
  {
    clave: 'acceso',
    sinMarco:
      'La pantalla de entrada tiene su propio diseño a pantalla completa, con la marca y el formulario: no es una página del taller.',
    nombre: 'Entrar',
    ruta: () => '/acceso',
    listo: async (page) => {
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible(CARGA);
    },
    sinSesion: true,
  },
];

export const EXCEPCIONES: readonly Excepcion[] = [
  {
    selector: '[data-reparto="fila"]',
    motivo:
      'Es una sola sección: su título a la izquierda y sus controles a la derecha. La fila mide lo que mide la sección.',
  },
  {
    selector: '[data-pantalla-de-acceso] aside',
    motivo:
      'La marca de las pantallas de sesión: tres textos fijos sin controles, no un reparto de contenido. El orden en que se leen no cambia el sentido y el teclado no pasa por ahí.',
  },
];
