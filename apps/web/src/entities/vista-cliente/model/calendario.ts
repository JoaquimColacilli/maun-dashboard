import {
  DESDE_CUANTOS_DIAS,
  DIAS_MAXIMOS_DE_LA_RESPUESTA,
  FRANJAS_DE_ENTREGA,
  HASTA_CUANTOS_DIAS,
  sePuedeElegir,
  sumarDias,
  type DiaElegido,
  type FranjaDeEntrega,
} from '@maun/domain';

import { mesesEntre, semanasDelMes } from '@/shared/lib';

export interface CeldaDelCalendario {
  fecha: string;
  fuera: boolean;
  sePuede: boolean;
}

export interface MesDelCalendario {
  mes: string;
  semanas: CeldaDelCalendario[][];
}

export function mesesDelCalendario(hoy: string): MesDelCalendario[] {
  const desde = sumarDias(hoy, DESDE_CUANTOS_DIAS);
  const hasta = sumarDias(hoy, HASTA_CUANTOS_DIAS);
  return mesesEntre(desde, hasta).map((mes) => ({
    mes,
    semanas: semanasDelMes(mes)
      .map((semana) =>
        semana.map((celda) => ({
          ...celda,
          sePuede: !celda.fuera && sePuedeElegir(celda.fecha, hoy),
        })),
      )
      .filter((semana) => semana.some((celda) => celda.sePuede)),
  }));
}

function enOrden(dias: readonly DiaElegido[]): DiaElegido[] {
  return [...dias].sort((uno, otro) => (uno.fecha < otro.fecha ? -1 : 1));
}

export function estaElegido(dias: readonly DiaElegido[], fecha: string): boolean {
  return dias.some((dia) => dia.fecha === fecha);
}

export function llegoAlMaximo(dias: readonly DiaElegido[]): boolean {
  return dias.length >= DIAS_MAXIMOS_DE_LA_RESPUESTA;
}

export function conElDia(dias: readonly DiaElegido[], fecha: string): DiaElegido[] {
  if (estaElegido(dias, fecha)) return dias.filter((dia) => dia.fecha !== fecha);
  if (llegoAlMaximo(dias)) return [...dias];
  return enOrden([...dias, { fecha, franjas: FRANJAS_DE_ENTREGA }]);
}

export function conLaFranja(
  dias: readonly DiaElegido[],
  fecha: string,
  franja: FranjaDeEntrega,
): DiaElegido[] {
  return dias.flatMap((dia) => {
    if (dia.fecha !== fecha) return [dia];
    const franjas = dia.franjas.includes(franja)
      ? dia.franjas.filter((una) => una !== franja)
      : FRANJAS_DE_ENTREGA.filter((una) => una === franja || dia.franjas.includes(una));
    return franjas.length === 0 ? [] : [{ fecha, franjas }];
  });
}

export function diasQueSiguenSirviendo(dias: readonly DiaElegido[], hoy: string): DiaElegido[] {
  return enOrden(dias.filter((dia) => sePuedeElegir(dia.fecha, hoy))).slice(
    0,
    DIAS_MAXIMOS_DE_LA_RESPUESTA,
  );
}
