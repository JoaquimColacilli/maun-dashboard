import { diasEntre, type EventoDeLaAgenda } from '@maun/domain';

import { DIAS_DE_LA_SEMANA, diaDeLaSemana, nombreDelMes, relativa } from '@/shared/lib';

import { DERIVADA } from './categorias';

export {
  DIAS_DE_LA_SEMANA,
  diaDeLaSemana,
  fechasDelMes,
  INICIALES_DE_LA_SEMANA,
  mesPrevio,
  mesSiguiente,
  primerDiaDelMes,
  rangoDeLaGrilla,
  semanasDelMes,
  ultimoDiaDelMes,
  type CeldaDelMes,
} from '@/shared/lib';

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
  return evento.hecha;
}

export function textoDeLoHecho(evento: EventoDeLaAgenda): string {
  return evento.clase === 'propia' ? 'hecha' : DERIVADA[evento.categoria].hecha;
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

interface CuentaDeLoPendiente {
  compromisos: number;
  anotadas: number;
  hechas: number;
}

function cuentaDeLoPendiente(eventos: readonly EventoDeLaAgenda[]): CuentaDeLoPendiente {
  const pendientes = eventos.filter((evento) => !estaHecha(evento));
  const compromisos = pendientes.filter((evento) => evento.clase === 'derivada').length;
  return {
    compromisos,
    anotadas: pendientes.length - compromisos,
    hechas: eventos.length - pendientes.length,
  };
}

export function resumenDelMes(eventos: readonly EventoDeLaAgenda[]): string {
  if (eventos.length === 0) return 'sin nada agendado';
  const { compromisos, anotadas, hechas } = cuentaDeLoPendiente(eventos);
  const partes = [
    plural(compromisos, 'compromiso', 'compromisos'),
    plural(anotadas, 'anotación', 'anotaciones'),
  ];
  if (hechas > 0) partes.push(plural(hechas, 'hecha', 'hechas'));
  return partes.join(' · ');
}

export function resumenDelDia(eventos: readonly EventoDeLaAgenda[]): string {
  const { compromisos, anotadas, hechas } = cuentaDeLoPendiente(eventos);

  const partes: string[] = [];
  if (compromisos > 0) partes.push(plural(compromisos, 'compromiso', 'compromisos'));
  if (anotadas > 0) partes.push(plural(anotadas, 'cosa anotada', 'cosas anotadas'));
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
  if (evento.clase === 'propia' || estaHecha(evento)) return null;
  const dias = diasEntre(hoy, evento.fecha);
  if (dias < 0) return { texto: `atrasada, era ${relativa(evento.fecha, hoy)}`, tono: 'alerta' };
  if (dias === 0) return { texto: 'es hoy', tono: 'alerta' };
  if (dias === 1) return { texto: 'es mañana', tono: 'atencion' };
  return { texto: relativa(evento.fecha, hoy), tono: dias <= 4 ? 'atencion' : 'normal' };
}

export function textoDelEvento(evento: EventoDeLaAgenda): string {
  return evento.clase === 'propia' ? evento.texto : evento.titulo;
}

export function idDelProximoContacto(evento: EventoDeLaAgenda): string | null {
  if (evento.clase !== 'derivada' || evento.categoria !== 'seguimiento') return null;
  return evento.id.replace(/^seguimiento:/, '');
}

export function nombreDelEvento(evento: EventoDeLaAgenda): string {
  return evento.clase === 'propia'
    ? evento.texto
    : `${DERIVADA[evento.categoria].accion}${DERIVADA[evento.categoria].conector}${evento.titulo}`;
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
  return eventos.some((evento) => evento.importante);
}
