export interface EtiquetasDeLaVista {
  titulo: string;
  descripcion: string;
  url: string;
  imagen: string | null;
}

export const DESCRIPCION_DE_LA_VISTA =
  'Seguí cómo va tu mueble: en qué anda, qué pagaste y qué falta.';

export const DESCRIPCION_DE_LA_ENCUESTA =
  'Contanos cómo te fue con el trabajo. Son un par de minutos y lo lee el dueño del taller.';

export const TITULO_GENERICO = 'MAUN';

export const TOKEN_DE_UN_ENLACE = /^[A-Za-z0-9_-]{16,128}$/;

export type ClaseDeEnlace = 'vista' | 'encuesta';

const PREFIJOS: Readonly<Record<ClaseDeEnlace, RegExp>> = {
  vista: /^\/v\//,
  encuesta: /^\/o\//,
};

export function claseDelEnlace(ruta: string): ClaseDeEnlace | null {
  if (PREFIJOS.vista.test(ruta)) return 'vista';
  return PREFIJOS.encuesta.test(ruta) ? 'encuesta' : null;
}

const EL_TITULO = /<title>[\s\S]*?<\/title>/i;

const LA_DESCRIPCION = /<meta\s[^>]*name=["']description["'][^>]*>/i;

const EL_MANIFIESTO = /<link\s[^>]*rel=["']manifest["'][^>]*>/gi;

const LOS_ICONOS_DE_LA_APP = /<link\s[^>]*rel=["'](?:icon|apple-touch-icon)["'][^>]*>/gi;

export const ICONOS_DEL_TALLER = [
  { rel: 'icon', href: '/taller.ico', sizes: '48x48' },
  { rel: 'icon', href: '/taller.svg', type: 'image/svg+xml' },
  { rel: 'apple-touch-icon', href: '/taller-180.png' },
] as const;

export const ICONO_DEL_TALLER_EN_LUGAR_DE: Readonly<Record<string, string>> = {
  '/favicon.ico': '/taller.ico',
  '/numa.svg': '/taller.svg',
  '/numa-apple-180.png': '/taller-180.png',
};

const LA_APERTURA_DEL_HEAD = /<head(\s[^>]*)?>/i;

const ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '"': '&quot;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
};

// El & es obligatorio por el ampersand ambiguo y la comilla doble porque el atributo va entre
// comillas dobles. Los otros tres no los exige la norma pero sí la realidad: un rastreador de
// vistas previas no usa un parser de HTML completo, delimita la etiqueta con una expresión regular
// y se le rompe con un > adentro del contenido. El apóstrofo va en numérica porque &apos; no
// existe en HTML 4 (ADR 0049).
export function escapar(texto: string): string {
  return texto.replace(/[&"<>']/g, (caracter) => ESCAPES[caracter] ?? caracter);
}

export function tokenDeLaRuta(ruta: string): string | null {
  const clase = claseDelEnlace(ruta);
  if (clase === null) return null;
  const token = ruta.replace(PREFIJOS[clase], '').replace(/\/+$/, '');
  return TOKEN_DE_UN_ENLACE.test(token) ? token : null;
}

export function tituloDeLaEncuesta(taller: string): string {
  const delTaller = taller.trim();
  return delTaller === '' ? 'Una encuesta del taller' : `Encuesta de ${delTaller}`;
}

export function tituloDeLaVista(trabajo: string, taller: string): string {
  const limpio = trabajo.trim();
  const delTaller = taller.trim();
  if (limpio === '') return delTaller === '' ? TITULO_GENERICO : delTaller;
  return delTaller === '' ? limpio : `${limpio} · ${delTaller}`;
}

export function etiquetasGenericas(
  url: string,
  imagen: string | null,
  clase: ClaseDeEnlace = 'vista',
): EtiquetasDeLaVista {
  return {
    titulo: TITULO_GENERICO,
    descripcion: clase === 'encuesta' ? DESCRIPCION_DE_LA_ENCUESTA : DESCRIPCION_DE_LA_VISTA,
    url,
    imagen,
  };
}

function bloqueDelHead(etiquetas: EtiquetasDeLaVista): string {
  const titulo = escapar(etiquetas.titulo);
  const lineas = [
    `<title>${titulo}</title>`,
    `<meta name="description" content="${escapar(etiquetas.descripcion)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${titulo}" />`,
    `<meta property="og:description" content="${escapar(etiquetas.descripcion)}" />`,
    `<meta property="og:url" content="${escapar(etiquetas.url)}" />`,
  ];
  if (etiquetas.imagen !== null) {
    lineas.push(`<meta property="og:image" content="${escapar(etiquetas.imagen)}" />`);
  }
  for (const icono of ICONOS_DEL_TALLER) {
    const tamano = 'sizes' in icono ? ` sizes="${icono.sizes}"` : '';
    const tipo = 'type' in icono ? ` type="${icono.type}"` : '';
    lineas.push(`<link rel="${icono.rel}" href="${icono.href}"${tamano}${tipo} />`);
  }
  return lineas.join('');
}

// Primero se saca lo que el index.html trae para toda la app —el título, la descripción, el
// manifiesto y los íconos— y recién después se mete el bloque nuevo, para no borrar lo que acabamos
// de escribir. El manifiesto se va porque el que abre este enlace es un cliente: no tiene por qué
// recibir la oferta de instalarse la app del taller (ADR 0049), y los íconos son los del taller
// (ADR 0073).
export function conLasEtiquetas(html: string, etiquetas: EtiquetasDeLaVista): string {
  const limpio = html
    .replace(EL_TITULO, '')
    .replace(LA_DESCRIPCION, '')
    .replace(EL_MANIFIESTO, '')
    .replace(LOS_ICONOS_DE_LA_APP, '');

  const bloque = bloqueDelHead(etiquetas);
  if (!LA_APERTURA_DEL_HEAD.test(limpio)) return limpio;
  return limpio.replace(LA_APERTURA_DEL_HEAD, (apertura) => `${apertura}${bloque}`);
}
