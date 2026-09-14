import type { PreferenciasDeAvisos } from '@maun/domain';

import type { FilasDeLaAgenda } from '../../../packages/db/src/agenda.ts';

export interface Suscripcion {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface AvisoPorMandar extends Suscripcion {
  dia: string;
  preferencias: PreferenciasDeAvisos;
  filas: FilasDeLaAgenda;
}

export interface Base {
  avisosPorMandar(ahora: Date): Promise<AvisoPorMandar[]>;
  anotarAviso(suscripcion: string, dia: string, mandado: boolean): Promise<void>;
  borrarSuscripcionVencida(endpoint: string): Promise<void>;
  suscripcionesParaProbar(usuario: string, endpoint: string | null): Promise<Suscripcion[]>;
  usuarioDelToken(token: string): Promise<string | null>;
}

export type Pedir = (url: string, init: RequestInit) => Promise<Response>;

export function baseDeSupabase(url: string, clave: string, pedir: Pedir = fetch): Base {
  const cabeceras: Record<string, string> = {
    apikey: clave,
    'Content-Type': 'application/json',
    ...(clave.startsWith('eyJ') ? { Authorization: `Bearer ${clave}` } : {}),
  };

  async function rpc<T>(nombre: string, argumentos: Record<string, unknown>): Promise<T> {
    const respuesta = await pedir(`${url}/rest/v1/rpc/${nombre}`, {
      method: 'POST',
      headers: cabeceras,
      body: JSON.stringify(argumentos),
    });
    if (!respuesta.ok) {
      throw new Error(`${nombre} devolvió ${String(respuesta.status)}: ${await respuesta.text()}`);
    }
    return (await respuesta.json()) as T;
  }

  return {
    avisosPorMandar: (ahora) => rpc('avisos_por_mandar', { p_ahora: ahora.toISOString() }),
    anotarAviso: async (suscripcion, dia, mandado) => {
      await rpc<boolean>('anotar_aviso', {
        p_suscripcion: suscripcion,
        p_dia: dia,
        p_mandado: mandado,
      });
    },
    borrarSuscripcionVencida: async (endpoint) => {
      await rpc<boolean>('borrar_suscripcion_vencida', { p_endpoint: endpoint });
    },
    suscripcionesParaProbar: (usuario, endpoint) =>
      rpc('suscripciones_para_probar', { p_usuario: usuario, p_endpoint: endpoint }),
    usuarioDelToken: async (token) => {
      const respuesta = await pedir(`${url}/auth/v1/user`, {
        method: 'GET',
        headers: { apikey: clave, Authorization: `Bearer ${token}` },
      });
      if (!respuesta.ok) return null;
      const cuerpo = (await respuesta.json()) as { id?: unknown };
      return typeof cuerpo.id === 'string' ? cuerpo.id : null;
    },
  };
}
