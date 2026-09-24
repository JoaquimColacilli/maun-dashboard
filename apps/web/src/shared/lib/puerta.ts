import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { hojaAbiertaArriba } from './hojas-abiertas';
import { esRutaDeHoja } from './hojas-por-ruta';

export type ComoIr = 'apilar' | 'reemplazar' | 'terminar';

export type SenalDeUnaVez = 'recienLiquidado' | 'recienAprobado';

export interface OpcionesDeIr {
  como?: ComoIr;
  state?: unknown;
  senal?: SenalDeUnaVez;
  desdeLaNavegacion?: boolean;
  sinTransicion?: boolean;
}

export interface PuertoDeNavegacion {
  ir: (destino: string, opciones: OpcionesDeIr) => void;
  volver: (padre: string) => void;
  etiquetaDeVolver: (padre: string, etiqueta: string) => string;
  hayUnaTransicion: () => boolean;
  cerrarLasHojasAntes: () => boolean;
  anunciarLaSalida: () => void;
}

export const ContextoDeLaPuerta = createContext<PuertoDeNavegacion | null>(null);

function despuesDeLaHoja(
  puerto: PuertoDeNavegacion,
  pathname: string,
  destino: string,
  accion: () => void,
): void {
  const hoja = hojaAbiertaArriba();
  const aOtraPantalla = soloElCamino(destino) !== pathname;
  if (hoja && aOtraPantalla && puerto.cerrarLasHojasAntes() && !esRutaDeHoja(pathname)) {
    hoja.cerrarYDespues(accion);
    return;
  }
  accion();
}

interface SenalPendiente {
  pathname: string;
  senal: SenalDeUnaVez;
}

let senalPendiente: SenalPendiente | null = null;
const senalesPorEntrada = new Map<string, SenalDeUnaVez>();

function soloElCamino(destino: string): string {
  return destino.split(/[?#]/)[0] ?? destino;
}

export function anotarSenal(destino: string, senal: SenalDeUnaVez | undefined): void {
  senalPendiente = senal === undefined ? null : { pathname: soloElCamino(destino), senal };
}

export function tomarSenal(key: string, pathname: string): SenalDeUnaVez | null {
  const yaTomada = senalesPorEntrada.get(key);
  if (yaTomada !== undefined) return yaTomada;
  if (senalPendiente?.pathname !== pathname) return null;
  const { senal } = senalPendiente;
  senalPendiente = null;
  senalesPorEntrada.set(key, senal);
  return senal;
}

export function olvidarSenal(key: string): void {
  senalesPorEntrada.delete(key);
}

export function useSenalDeUnaVez(senal: SenalDeUnaVez): boolean {
  const { key, pathname } = useLocation();
  const [leidas] = useState(() => new Map<string, SenalDeUnaVez | null>());
  if (!leidas.has(key)) leidas.set(key, tomarSenal(key, pathname));
  useEffect(() => {
    olvidarSenal(key);
  }, [key]);
  return leidas.get(key) === senal;
}

export function usePuerta(): PuertoDeNavegacion | null {
  return useContext(ContextoDeLaPuerta);
}

export function useIr(): (destino: string, opciones?: OpcionesDeIr) => void {
  const puerto = useContext(ContextoDeLaPuerta);
  const navegar = useNavigate();
  const { pathname } = useLocation();
  return useCallback(
    (destino: string, opciones: OpcionesDeIr = {}) => {
      if (puerto) {
        puerto.anunciarLaSalida();
        despuesDeLaHoja(puerto, pathname, destino, () => {
          anotarSenal(destino, opciones.senal);
          puerto.ir(destino, opciones);
        });
        return;
      }
      anotarSenal(destino, opciones.senal);
      void navegar(destino, {
        replace: opciones.como === 'reemplazar' || opciones.como === 'terminar',
        state: opciones.state,
      });
    },
    [puerto, navegar, pathname],
  );
}

export interface Vuelta {
  volver: () => void;
  etiqueta: string;
}

export function useVolver(
  padre: string,
  etiqueta: string,
  { fija = false }: { fija?: boolean } = {},
): Vuelta {
  const puerto = useContext(ContextoDeLaPuerta);
  const navegar = useNavigate();
  const { pathname } = useLocation();
  const volver = useCallback(() => {
    if (puerto) {
      puerto.anunciarLaSalida();
      despuesDeLaHoja(puerto, pathname, padre, () => {
        puerto.volver(padre);
      });
      return;
    }
    void navegar(padre);
  }, [puerto, navegar, padre, pathname]);
  return {
    volver,
    etiqueta: fija || !puerto ? etiqueta : puerto.etiquetaDeVolver(padre, etiqueta),
  };
}
