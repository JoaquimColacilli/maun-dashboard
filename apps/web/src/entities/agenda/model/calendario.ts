import { diasEntre, sumarDias, type EventoDeLaAgenda, type RangoDeLaAgenda } from '@maun/domain';

import { diasDelMes, nombreDelMes, relativa } from '@/shared/lib';

import { DERIVADA } from './categorias';

export const DIAS_DE_LA_SEMANA = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'] as const;

export const INICIALES_DE_LA_SEMANA = ['l', 'm', 'm', 'j', 'v', 's', 'd'] as const;

const UN_LUNES = '2024-01-01';

export interface CeldaDelMes {
  fecha: string;
  fuera: boolean;
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

export function rangoDeLaGrilla(mes: string): RangoDeLaAgenda {
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

export function mesEnPalabras(mes: string, hoy: string): string {
  const nombre = nombreDelMes(mes).toLowerCase();
  return mes.slice(0, 4) === hoy.slice(0, 4) ? nombre : `${nombre} ${mes.slice(0, 4)}`;
}

export function numeroDelDia(fecha: string): number {
  return Number(fecha.slice(8, 10));
}

export function diaEnPalabras(fecha: string): string {
  const dia = DIAS_DE_LA_SEMANA[diaDeLaSemana(fecha)] ?? '';
  return `${dia} ${String(numeroDelDia(fecha))} de ${nombreDelMes(fecha.slice(0, 7)).toLowerCase()}`;
}

export type EtiquetaDelDia = 'hoy' | 'mañana' | 'ayer';

export function etiquetaDelDia(fecha: string, hoy: string): EtiquetaDelDia | null {
  const dias = diasEntre(hoy, fecha);
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'mañana';
  if (dias === -1) return 'ayer';
  return null;
}

export function eventosDelDia(
  eventos: readonly EventoDeLaAgenda[],
  fecha: string,
): EventoDeLaAgenda[] {
  return eventos.filter((evento) => evento.fecha === fecha);
}

export function estaHecha(evento: EventoDeLaAgenda): boolean {
  return evento.clase === 'propia' && evento.hecha;
}

export function conLoHechoAlFinal(eventos: readonly EventoDeLaAgenda[]): EventoDeLaAgenda[] {
  return [
    ...eventos.filter((evento) => !estaHecha(evento)),
    ...eventos.filter((evento) => estaHecha(evento)),
  ];
}

function plural(cantidad: number, singular: string, varios: string): string {
  return `${String(cantidad)} ${cantidad === 1 ? singular : varios}`;
}

export function resumenDelMes(eventos: readonly EventoDeLaAgenda[]): string {
  if (eventos.length === 0) return 'sin nada agendado';
  const compromisos = eventos.filter((evento) => evento.clase === 'derivada').length;
  const hechas = eventos.filter((evento) => estaHecha(evento)).length;
  const partes = [
    plural(compromisos, 'compromiso', 'compromisos'),
    plural(eventos.length - compromisos - hechas, 'anotación', 'anotaciones'),
  ];
  if (hechas > 0) partes.push(plural(hechas, 'hecha', 'hechas'));
  return partes.join(' · ');
}

export function resumenDelDia(eventos: readonly EventoDeLaAgenda[]): string {
  const compromisos = eventos.filter((evento) => evento.clase === 'derivada').length;
  const hechas = eventos.filter((evento) => estaHecha(evento)).length;
  const pendientes = eventos.length - compromisos - hechas;

  const partes: string[] = [];
  if (compromisos > 0) partes.push(plural(compromisos, 'compromiso', 'compromisos'));
  if (pendientes > 0) partes.push(plural(pendientes, 'cosa anotada', 'cosas anotadas'));
  if (hechas > 0) partes.push(plural(hechas, 'hecha', 'hechas'));
  return partes.length === 0 ? 'Nada agendado' : partes.join(' · ');
}

export function cuentaDelDia(eventos: readonly EventoDeLaAgenda[]): string {
  if (eventos.length === 0) return 'nada agendado';
  const hechas = eventos.filter((evento) => estaHecha(evento)).length;
  const pendientes = eventos.length - hechas;

  const partes: string[] = [];
  if (pendientes > 0) partes.push(plural(pendientes, 'cosa', 'cosas'));
  if (hechas > 0) partes.push(plural(hechas, 'hecha', 'hechas'));
  return partes.join(' y ');
}

export type TonoDeUrgencia = 'alerta' | 'atencion' | 'normal';

export interface UrgenciaDelEvento {
  texto: string;
  tono: TonoDeUrgencia;
}

export function urgenciaDelEvento(evento: EventoDeLaAgenda, hoy: string): UrgenciaDelEvento | null {
  if (evento.clase === 'propia') return null;
  const dias = diasEntre(hoy, evento.fecha);
  if (dias < 0) return { texto: `atrasada, era ${relativa(evento.fecha, hoy)}`, tono: 'alerta' };
  if (dias === 0) return { texto: 'es hoy', tono: 'alerta' };
  if (dias === 1) return { texto: 'es mañana', tono: 'atencion' };
  return { texto: relativa(evento.fecha, hoy), tono: dias <= 4 ? 'atencion' : 'normal' };
}

export function textoDelEvento(evento: EventoDeLaAgenda): string {
  return evento.clase === 'propia' ? evento.texto : evento.titulo;
}

export function nombreDelEvento(evento: EventoDeLaAgenda): string {
  return evento.clase === 'propia'
    ? evento.texto
    : `${DERIVADA[evento.categoria].accion}: ${evento.titulo}`;
}

export function detalleDelEvento(evento: EventoDeLaAgenda): string {
  if (evento.clase === 'propia') return evento.proyecto ?? '';
  return [evento.cliente, evento.lugar].filter((parte) => parte.trim() !== '').join(', ');
}

export interface DiaConEventos {
  fecha: string;
  eventos: EventoDeLaAgenda[];
}

export function diasConEventos(
  eventos: readonly EventoDeLaAgenda[],
  fechas: readonly string[],
  elegido: string,
): DiaConEventos[] {
  return fechas
    .map((fecha) => ({ fecha, eventos: eventosDelDia(eventos, fecha) }))
    .filter((dia) => dia.eventos.length > 0 || dia.fecha === elegido);
}

export function hayImportante(eventos: readonly EventoDeLaAgenda[]): boolean {
  return eventos.some((evento) => evento.clase === 'propia' && evento.importante);
}
