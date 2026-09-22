import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { Socket } from 'node:net';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';

export const PUERTO_DEL_ARNES = 4180;

export const ORIGEN_DEL_ARNES = `http://localhost:${String(PUERTO_DEL_ARNES)}`;

const CARPETA_DE_LAS_BUILDS = fileURLToPath(
  new URL('../../node_modules/.arnes-de-version/', import.meta.url),
);

export const BUILD_A = path.join(CARPETA_DE_LAS_BUILDS, 'a');

export const BUILD_B = path.join(CARPETA_DE_LAS_BUILDS, 'b');

export const VERSION_DE_LA_B = '2099-12-31';

export const NOVEDAD_DE_LA_B = 'Esta es la versión nueva que publica el arnés.';

export type Version = 'a' | 'b';

export interface PedidoAlArnes {
  ruta: string;
  version: Version;
  cuando: number;
}

type Demora = { tipo: 'ninguna' } | { tipo: 'retenida' } | { tipo: 'milisegundos'; ms: number };

const TIPOS: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function archivosDe(carpeta: string, prefijo = ''): Map<string, Buffer> {
  const archivos = new Map<string, Buffer>();
  for (const nombre of readdirSync(carpeta)) {
    const completo = path.join(carpeta, nombre);
    const ruta = `${prefijo}/${nombre}`;
    if (statSync(completo).isDirectory()) {
      for (const [interna, contenido] of archivosDe(completo, ruta))
        archivos.set(interna, contenido);
    } else {
      archivos.set(ruta, readFileSync(completo));
    }
  }
  return archivos;
}

function loNuevoDeLaB(a: Map<string, Buffer>, b: Map<string, Buffer>): Set<string> {
  const nuevo = new Set<string>();
  for (const [ruta, contenido] of b) {
    if (ruta === '/sw.js') continue;
    const anterior = a.get(ruta);
    if (anterior === undefined || !anterior.equals(contenido)) nuevo.add(ruta);
  }
  return nuevo;
}

function cabeceras(ruta: string): Record<string, string> {
  const tipo = TIPOS[path.extname(ruta)] ?? 'application/octet-stream';
  const cache = ruta.startsWith('/assets/')
    ? 'public, max-age=31536000, immutable'
    : 'public, max-age=0, must-revalidate';
  return { 'Content-Type': tipo, 'Cache-Control': cache };
}

export interface Arnes {
  readonly origen: string;
  readonly loNuevo: ReadonlySet<string>;
  readonly pedidos: readonly PedidoAlArnes[];
  publicar: (version: Version) => void;
  demorarLoNuevo: (ms: number) => void;
  retenerLoNuevo: () => void;
  soltarLoNuevo: () => void;
  fallarLoNuevoUnaVez: () => void;
  pedidosDelServiceWorker: () => number;
  entregasDeLoNuevo: () => number;
  pedidosDeLoNuevo: () => number;
  reiniciar: () => void;
  cerrar: () => Promise<void>;
}

export async function levantarArnes(): Promise<Arnes> {
  const builds: Record<Version, Map<string, Buffer>> = {
    a: archivosDe(BUILD_A),
    b: archivosDe(BUILD_B),
  };
  const loNuevo = loNuevoDeLaB(builds.a, builds.b);
  if (!builds.a.has('/sw.js') || !builds.b.has('/sw.js')) {
    throw new Error('Falta el sw.js en alguna de las dos builds del arnés.');
  }
  if (builds.a.get('/sw.js')?.equals(builds.b.get('/sw.js') ?? Buffer.alloc(0)) !== false) {
    throw new Error('La build B tiene el mismo sw.js que la A: no es una versión nueva.');
  }
  if (loNuevo.size === 0) throw new Error('La build B no cambió ningún archivo del precache.');

  let publicada: Version = 'a';
  let demora: Demora = { tipo: 'ninguna' };
  let fallarUnaVez = false;
  let entregas = 0;
  const pedidos: PedidoAlArnes[] = [];
  const retenidos = new Set<() => void>();

  const soltar = () => {
    for (const seguir of retenidos) seguir();
    retenidos.clear();
  };

  const esperarLaDemora = async (): Promise<void> => {
    const actual = demora;
    if (actual.tipo === 'ninguna') return;
    if (actual.tipo === 'milisegundos') {
      await new Promise((resolver) => setTimeout(resolver, actual.ms));
      return;
    }
    await new Promise<void>((resolver) => {
      retenidos.add(resolver);
    });
  };

  const atender = async (pedido: IncomingMessage, respuesta: ServerResponse): Promise<void> => {
    const ruta = decodeURIComponent(new URL(pedido.url ?? '/', ORIGEN_DEL_ARNES).pathname);
    const version = publicada;
    pedidos.push({ ruta, version, cuando: Date.now() });
    const archivos = builds[version];
    const encontrado = archivos.get(ruta);
    const servida = encontrado === undefined ? '/index.html' : ruta;
    const contenido = encontrado ?? archivos.get('/index.html');
    if (contenido === undefined) {
      respuesta.writeHead(404).end();
      return;
    }

    const esNuevo = version === 'b' && loNuevo.has(servida) && encontrado !== undefined;
    if (esNuevo) {
      if (fallarUnaVez) {
        fallarUnaVez = false;
        respuesta.writeHead(503, { 'Cache-Control': 'no-store' }).end();
        return;
      }
      await esperarLaDemora();
      respuesta.on('finish', () => {
        entregas += 1;
      });
    }
    respuesta.writeHead(200, cabeceras(servida));
    respuesta.end(pedido.method === 'HEAD' ? undefined : contenido);
  };

  const servidor = createServer((pedido, respuesta) => {
    atender(pedido, respuesta).catch(() => {
      if (!respuesta.headersSent) respuesta.writeHead(500);
      respuesta.end();
    });
  });
  const conexiones = new Set<Socket>();
  servidor.on('connection', (conexion) => {
    conexiones.add(conexion);
    conexion.on('close', () => conexiones.delete(conexion));
  });

  await new Promise<void>((resolver, rechazar) => {
    servidor.once('error', rechazar);
    servidor.listen(PUERTO_DEL_ARNES, 'localhost', () => {
      servidor.off('error', rechazar);
      resolver();
    });
  });

  return {
    origen: ORIGEN_DEL_ARNES,
    loNuevo,
    pedidos,
    publicar: (version) => {
      publicada = version;
    },
    demorarLoNuevo: (ms) => {
      demora = { tipo: 'milisegundos', ms };
    },
    retenerLoNuevo: () => {
      demora = { tipo: 'retenida' };
    },
    soltarLoNuevo: () => {
      demora = { tipo: 'ninguna' };
      soltar();
    },
    fallarLoNuevoUnaVez: () => {
      fallarUnaVez = true;
    },
    pedidosDelServiceWorker: () => pedidos.filter((pedido) => pedido.ruta === '/sw.js').length,
    entregasDeLoNuevo: () => entregas,
    pedidosDeLoNuevo: () =>
      pedidos.filter((pedido) => pedido.version === 'b' && loNuevo.has(pedido.ruta)).length,
    reiniciar: () => {
      publicada = 'a';
      demora = { tipo: 'ninguna' };
      fallarUnaVez = false;
      entregas = 0;
      soltar();
      pedidos.length = 0;
    },
    cerrar: async () => {
      soltar();
      for (const conexion of conexiones) conexion.destroy();
      await new Promise<void>((resolver) => {
        servidor.close(() => {
          resolver();
        });
      });
    },
  };
}
