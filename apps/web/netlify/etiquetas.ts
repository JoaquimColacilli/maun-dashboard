export interface EtiquetasDeLaVista {
  titulo: string;
  descripcion: string;
  url: string;
  imagen: string | null;
}

export const DESCRIPCION_DE_LA_VISTA =
  'Seguí cómo va tu mueble: en qué anda, qué pagaste y qué falta.';

export const TITULO_GENERICO = 'MAUN';

export const TOKEN_DE_UN_ENLACE = /^[A-Za-z0-9_-]{16,128}$/;

const EL_TITULO = /<title>[\s\S]*?<\/title>/i;

const LA_DESCRIPCION = /<meta\s[^>]*name=["']description["'][^>]*>/i;

const EL_MANIFIESTO = /<link\s[^>]*rel=["']manifest["'][^>]*>/gi;

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
  const token = ruta.replace(/^\/v\//, '').replace(/\/+$/, '');
  return TOKEN_DE_UN_ENLACE.test(token) ? token : null;
}

export function tituloDeLaVista(trabajo: string, taller: string): string {
  const limpio = trabajo.trim();
  const delTaller = taller.trim();
  if (limpio === '') return delTaller === '' ? TITULO_GENERICO : delTaller;
  return delTaller === '' ? limpio : `${limpio} · ${delTaller}`;
}

export function etiquetasGenericas(url: string, imagen: string | null): EtiquetasDeLaVista {
  return { titulo: TITULO_GENERICO, descripcion: DESCRIPCION_DE_LA_VISTA, url, imagen };
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
  return lineas.join('');
}

// Primero se saca lo que el index.html trae para toda la app —el título, la descripción y el
// manifiesto— y recién después se mete el bloque nuevo, para no borrar lo que acabamos de escribir.
// El manifiesto se va porque el que abre este enlace es un cliente: no tiene por qué recibir la
// oferta de instalarse la app del taller (ADR 0049).
export function conLasEtiquetas(html: string, etiquetas: EtiquetasDeLaVista): string {
  const limpio = html.replace(EL_TITULO, '').replace(LA_DESCRIPCION, '').replace(EL_MANIFIESTO, '');

  const bloque = bloqueDelHead(etiquetas);
  if (!LA_APERTURA_DEL_HEAD.test(limpio)) return limpio;
  return limpio.replace(LA_APERTURA_DEL_HEAD, (apertura) => `${apertura}${bloque}`);
}
