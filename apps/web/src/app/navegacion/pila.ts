import type { OpcionesDeIr } from '@/shared/lib';

import { direccionDe, pantallaDe, sonPestanasDelMismoGrupo } from './catalogo';
import type { EntradaDelHistorial } from './historial';

export const INICIO = '/';

export type Paso =
  | { tipo: 'atras'; saltos: number }
  | { tipo: 'apilar'; url: string; state?: unknown }
  | { tipo: 'reemplazar'; url: string; state?: unknown };

export type TipoDeNavegacion = 'apilar' | 'reemplazar' | 'terminar' | 'seccion' | 'atras' | 'nada';

export interface Plan {
  tipo: TipoDeNavegacion;
  pasos: Paso[];
}

export interface Situacion {
  actual: string;
  anteriores: readonly EntradaDelHistorial[];
  movil: boolean;
  conHistorial: boolean;
}

export function mismaDireccion(una: string, otra: string): boolean {
  const primera = direccionDe(una);
  const segunda = direccionDe(otra);
  if (primera.pathname !== segunda.pathname) return false;
  const ordenar = (busqueda: string) => {
    const parametros = new URLSearchParams(busqueda);
    parametros.sort();
    return parametros.toString();
  };
  return ordenar(primera.search) === ordenar(segunda.search);
}

const NADA: Plan = { tipo: 'nada', pasos: [] };

function atras(saltos: number): Paso[] {
  return saltos > 0 ? [{ tipo: 'atras', saltos }] : [];
}

export function planALaRaiz(raiz: string, situacion: Situacion, state?: unknown): Plan {
  const pila = [situacion.actual, ...situacion.anteriores.map((entrada) => entrada.url)];
  const alFinal: Paso[] = mismaDireccion(raiz, INICIO)
    ? []
    : [{ tipo: 'apilar', url: raiz, state }];
  const inicio = pila.findIndex((url) => pantallaDe(url)?.id === 'inicio');
  if (inicio === 0 && alFinal.length === 0) return NADA;
  if (inicio >= 0) return { tipo: 'seccion', pasos: [...atras(inicio), ...alFinal] };
  return {
    tipo: 'seccion',
    pasos: [...atras(situacion.anteriores.length), { tipo: 'reemplazar', url: INICIO }, ...alFinal],
  };
}

function planDeUnaRaiz(destino: string, situacion: Situacion, state: unknown): Plan | null {
  const pantalla = pantallaDe(destino);
  if (!pantalla?.raiz) return null;
  const actual = pantallaDe(situacion.actual);
  if (actual?.seccion !== pantalla.seccion) return planALaRaiz(destino, situacion, state);
  if (mismaDireccion(destino, situacion.actual)) return NADA;
  const enLaPila = situacion.anteriores.findIndex((entrada) =>
    mismaDireccion(entrada.url, destino),
  );
  if (enLaPila >= 0) return { tipo: 'seccion', pasos: atras(enLaPila + 1) };
  if (actual.raiz)
    return { tipo: 'reemplazar', pasos: [{ tipo: 'reemplazar', url: destino, state }] };
  const raiz = situacion.anteriores.findIndex((entrada) => {
    const una = pantallaDe(entrada.url);
    return una?.raiz === true && una.seccion === pantalla.seccion;
  });
  if (raiz < 0) return planALaRaiz(destino, situacion, state);
  return {
    tipo: 'seccion',
    pasos: [...atras(raiz + 1), { tipo: 'reemplazar', url: destino, state }],
  };
}

export function planDeIr(destino: string, opciones: OpcionesDeIr, situacion: Situacion): Plan {
  const como = opciones.como ?? 'apilar';
  const { state } = opciones;
  if (como === 'terminar') {
    const [anterior] = situacion.anteriores;
    if (situacion.conHistorial && anterior && mismaDireccion(anterior.url, destino)) {
      return { tipo: 'terminar', pasos: atras(1) };
    }
    if (mismaDireccion(situacion.actual, destino)) return { tipo: 'nada', pasos: [] };
    return { tipo: 'terminar', pasos: [{ tipo: 'reemplazar', url: destino, state }] };
  }
  if (situacion.movil && situacion.conHistorial) {
    const aUnaRaiz = planDeUnaRaiz(destino, situacion, state);
    if (aUnaRaiz) return aUnaRaiz;
  }
  if (!opciones.desdeLaNavegacion && sonPestanasDelMismoGrupo(situacion.actual, destino)) {
    return { tipo: 'reemplazar', pasos: [{ tipo: 'reemplazar', url: destino, state }] };
  }
  if (como === 'reemplazar') {
    return { tipo: 'reemplazar', pasos: [{ tipo: 'reemplazar', url: destino, state }] };
  }
  return { tipo: 'apilar', pasos: [{ tipo: 'apilar', url: destino, state }] };
}

export function planDeVolver(padre: string, situacion: Situacion): Plan {
  if (!situacion.conHistorial) {
    return { tipo: 'apilar', pasos: [{ tipo: 'apilar', url: padre }] };
  }
  if (situacion.anteriores.length > 0) return { tipo: 'atras', pasos: atras(1) };
  const pantalla = pantallaDe(padre);
  if (situacion.movil && pantalla?.raiz === true && pantalla.id !== 'inicio') {
    return {
      tipo: 'reemplazar',
      pasos: [
        { tipo: 'reemplazar', url: INICIO },
        { tipo: 'apilar', url: padre },
      ],
    };
  }
  return { tipo: 'reemplazar', pasos: [{ tipo: 'reemplazar', url: padre }] };
}

export function destinoDeLaBarra(ruta: string, situacion: Situacion): string | null {
  const destino = pantallaDe(ruta);
  const actual = pantallaDe(situacion.actual);
  if (!destino || actual?.seccion !== destino.seccion) return ruta;
  if (actual.raiz) return null;
  const raiz = situacion.anteriores.find((entrada) => {
    const una = pantallaDe(entrada.url);
    return una?.raiz === true && una.seccion === destino.seccion;
  });
  return raiz?.url ?? ruta;
}

export function etiquetaDeVolver(
  padre: string,
  etiqueta: string,
  anteriores: readonly EntradaDelHistorial[],
): string {
  const [anterior] = anteriores;
  if (!anterior) return etiqueta;
  const previa = pantallaDe(anterior.url);
  if (!previa || previa.id === pantallaDe(padre)?.id) return etiqueta;
  return previa.nombre;
}
