import { diasEntre, sumarDias } from '@maun/domain';

import { diasDelMes } from './fechas';

export const DIAS_DE_LA_SEMANA = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'] as const;

export const INICIALES_DE_LA_SEMANA = ['l', 'm', 'm', 'j', 'v', 's', 'd'] as const;

const UN_LUNES = '2024-01-01';

export interface CeldaDelMes {
  fecha: string;
  fuera: boolean;
}

export interface RangoDeLaGrilla {
  desde: string;
  hasta: string;
}

export function diaDeLaSemana(fecha: string): number {
  return ((diasEntre(UN_LUNES, fecha) % 7) + 7) % 7;
}

export function primerDiaDelMes(mes: string): string {
  return `${mes}-01`;
}

export function ultimoDiaDelMes(mes: string): string {
  return `${mes}-${String(diasDelMes(mes)).padStart(2, '0')}`;
}

export function mesSiguiente(mes: string): string {
  return sumarDias(ultimoDiaDelMes(mes), 1).slice(0, 7);
}

export function mesPrevio(mes: string): string {
  return sumarDias(primerDiaDelMes(mes), -1).slice(0, 7);
}

export function fechasDelMes(mes: string): string[] {
  const primero = primerDiaDelMes(mes);
  return Array.from({ length: diasDelMes(mes) }, (_, indice) => sumarDias(primero, indice));
}

export function rangoDeLaGrilla(mes: string): RangoDeLaGrilla {
  const primero = primerDiaDelMes(mes);
  const ultimo = ultimoDiaDelMes(mes);
  return {
    desde: sumarDias(primero, -diaDeLaSemana(primero)),
    hasta: sumarDias(ultimo, 6 - diaDeLaSemana(ultimo)),
  };
}

export function semanasDelMes(mes: string): CeldaDelMes[][] {
  const { desde, hasta } = rangoDeLaGrilla(mes);
  const semanas: CeldaDelMes[][] = [];
  for (let indice = 0; indice <= diasEntre(desde, hasta); indice += 1) {
    const fecha = sumarDias(desde, indice);
    if (indice % 7 === 0) semanas.push([]);
    semanas[semanas.length - 1]?.push({ fecha, fuera: fecha.slice(0, 7) !== mes });
  }
  return semanas;
}

export function mesesEntre(desde: string, hasta: string): string[] {
  const meses: string[] = [];
  for (let mes = desde.slice(0, 7); mes <= hasta.slice(0, 7); mes = mesSiguiente(mes)) {
    meses.push(mes);
  }
  return meses;
}
