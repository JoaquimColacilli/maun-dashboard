import type { Base } from './base.ts';
import type { Configuracion } from './entorno.ts';
import { mandarLaPrueba, mandarLosAvisos, type Enviador } from './envio.ts';

export interface Dependencias {
  configuracion: Configuracion;
  base: Base;
  enviar: Enviador;
  ahora: () => Date;
}

const CORS: Readonly<Record<string, string>> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function json(cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function igualesEnTiempoConstante(uno: string, otro: string): boolean {
  const a = new TextEncoder().encode(uno);
  const b = new TextEncoder().encode(otro);
  let diferencia = a.length ^ b.length;
  for (let indice = 0; indice < Math.max(a.length, b.length); indice += 1) {
    diferencia |= (a[indice] ?? 0) ^ (b[indice] ?? 0);
  }
  return diferencia === 0;
}

function tokenDe(pedido: Request): string | null {
  const encontrado = /^Bearer\s+(\S+)$/i.exec(pedido.headers.get('authorization') ?? '');
  return encontrado?.[1] ?? null;
}

async function endpointDelCuerpo(pedido: Request): Promise<string | null> {
  try {
    const cuerpo = (await pedido.json()) as { endpoint?: unknown };
    return typeof cuerpo.endpoint === 'string' ? cuerpo.endpoint : null;
  } catch {
    return null;
  }
}

export function crearManejador(dependencias: Dependencias): (pedido: Request) => Promise<Response> {
  const { configuracion, base, enviar, ahora } = dependencias;
  const { vapid, secretoDelTrabajo } = configuracion;

  return async (pedido) => {
    if (pedido.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (pedido.method === 'GET') {
      return json({ configurado: vapid !== null, clavePublica: vapid?.publica ?? null });
    }
    if (pedido.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);

    try {
      if (new URL(pedido.url).pathname.endsWith('/probar')) {
        const token = tokenDe(pedido);
        const usuario = token === null ? null : await base.usuarioDelToken(token);
        if (usuario === null) return json({ error: 'Hace falta una sesión.' }, 401);
        if (vapid === null) return json({ configurado: false }, 503);
        const suscripciones = await base.suscripcionesParaProbar(
          usuario,
          await endpointDelCuerpo(pedido),
        );
        return json({
          configurado: true,
          ...(await mandarLaPrueba(suscripciones, base, enviar, vapid)),
        });
      }

      const token = tokenDe(pedido);
      if (
        secretoDelTrabajo === null ||
        token === null ||
        !igualesEnTiempoConstante(token, secretoDelTrabajo)
      ) {
        return json({ error: 'No autorizado.' }, 401);
      }
      if (vapid === null) return json({ configurado: false, mandados: 0 });
      const avisos = await base.avisosPorMandar(ahora());
      return json({ configurado: true, ...(await mandarLosAvisos(avisos, base, enviar, vapid)) });
    } catch (error) {
      console.error('los avisos fallaron', String(error));
      return json({ error: 'Los avisos no se pudieron procesar.' }, 500);
    }
  };
}
