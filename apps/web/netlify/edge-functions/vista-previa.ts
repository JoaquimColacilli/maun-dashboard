import {
  conLasEtiquetas,
  DESCRIPCION_DE_LA_VISTA,
  etiquetasGenericas,
  tituloDeLaVista,
  tokenDeLaRuta,
  type EtiquetasDeLaVista,
} from '../etiquetas.ts';

interface ContextoDeNetlify {
  next: () => Promise<Response>;
}

export const TOPE_DE_LA_CONSULTA_MS = 1_000;

export const IMAGEN_DE_LA_VISTA = '/pwa-512x512.png';

interface TituloDelTrabajo {
  trabajo: string;
  taller: string;
}

function desdeElObjeto(global: string, nombre: string): string | undefined {
  const raiz: unknown = Reflect.get(globalThis, global);
  if (typeof raiz !== 'object' || raiz === null) return undefined;
  const entorno: unknown = Reflect.get(raiz, 'env');
  if (typeof entorno !== 'object' || entorno === null) return undefined;
  const leer: unknown = Reflect.get(entorno, 'get');
  if (typeof leer !== 'function') return undefined;
  try {
    const valor: unknown = (leer as (clave: string) => unknown).call(entorno, nombre);
    return typeof valor === 'string' && valor !== '' ? valor : undefined;
  } catch {
    return undefined;
  }
}

// Netlify.env.get es el nombre documentado y el que vale en producción. Deno.env.get queda de
// respaldo: es el mismo valor por otra puerta y no cuesta nada (ADR 0049).
function variableDelEntorno(nombre: string): string | undefined {
  return desdeElObjeto('Netlify', nombre) ?? desdeElObjeto('Deno', nombre);
}

function laBase(): { url: string; clave: string } | null {
  const url = variableDelEntorno('VITE_SUPABASE_URL') ?? variableDelEntorno('SUPABASE_URL');
  const clave =
    variableDelEntorno('VITE_SUPABASE_PUBLISHABLE_KEY') ??
    variableDelEntorno('SUPABASE_PUBLISHABLE_KEY');
  return url === undefined || clave === undefined ? null : { url, clave };
}

function leerElTitulo(valor: unknown): TituloDelTrabajo | null {
  if (typeof valor !== 'object' || valor === null) return null;
  const trabajo: unknown = Reflect.get(valor, 'trabajo');
  const taller: unknown = Reflect.get(valor, 'taller');
  if (typeof trabajo !== 'string') return null;
  return { trabajo, taller: typeof taller === 'string' ? taller : '' };
}

// El tope no usa AbortSignal: Netlify no lo documenta entre las APIs que soporta su runtime. Una
// carrera contra un setTimeout, que sí está documentado, garantiza que la página salga igual
// aunque la base tarde, que es lo único que importa acá (ADR 0049).
async function conTope<T>(promesa: Promise<T>, tope: number): Promise<T | null> {
  let reloj: ReturnType<typeof setTimeout> | undefined;
  const esperar = new Promise<null>((resolver) => {
    reloj = setTimeout(() => {
      resolver(null);
    }, tope);
  });
  try {
    return await Promise.race([promesa, esperar]);
  } finally {
    if (reloj !== undefined) clearTimeout(reloj);
  }
}

async function tituloDelEnlace(token: string): Promise<TituloDelTrabajo | null> {
  const base = laBase();
  if (base === null) return null;

  const pedido = fetch(`${base.url}/rest/v1/rpc/titulo_compartido`, {
    method: 'POST',
    headers: {
      apikey: base.clave,
      authorization: `Bearer ${base.clave}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ p_token: token }),
  })
    .then(async (respuesta) => (respuesta.ok ? ((await respuesta.json()) as unknown) : null))
    .catch(() => null);

  return leerElTitulo(await conTope(pedido, TOPE_DE_LA_CONSULTA_MS));
}

export default async function vistaPrevia(
  pedido: Request,
  contexto: ContextoDeNetlify,
): Promise<Response | undefined> {
  if (pedido.method !== 'GET' && pedido.method !== 'HEAD') return undefined;

  const respuesta = await contexto.next();
  if (!(respuesta.headers.get('content-type') ?? '').includes('text/html')) return respuesta;

  const direccion = new URL(pedido.url);
  const canonica = `${direccion.origin}${direccion.pathname}`;
  const imagen = `${direccion.origin}${IMAGEN_DE_LA_VISTA}`;

  const token = tokenDeLaRuta(direccion.pathname);
  const trabajo = token === null ? null : await tituloDelEnlace(token);

  const etiquetas: EtiquetasDeLaVista =
    trabajo === null
      ? etiquetasGenericas(canonica, imagen)
      : {
          titulo: tituloDeLaVista(trabajo.trabajo, trabajo.taller),
          descripcion: DESCRIPCION_DE_LA_VISTA,
          url: canonica,
          imagen,
        };

  const cabeceras = new Headers(respuesta.headers);
  cabeceras.set('content-type', 'text/html; charset=utf-8');
  cabeceras.set('x-robots-tag', 'noindex, nofollow, noarchive, noimageindex');
  cabeceras.set('netlify-cdn-cache-control', 'no-store');
  cabeceras.set('cache-control', 'no-store, must-revalidate');
  cabeceras.delete('content-length');

  return new Response(conLasEtiquetas(await respuesta.text(), etiquetas), {
    status: respuesta.status,
    statusText: respuesta.statusText,
    headers: cabeceras,
  });
}

export const config = {
  path: '/v/*',
  onError: 'bypass',
} as const;
