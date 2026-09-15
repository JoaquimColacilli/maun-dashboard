import { diasEntre, type CategoriaDerivada, type EventoDeLaAgenda } from '@maun/domain';

export interface CargaDelAviso {
  titulo: string;
  cuerpo: string;
  url: string;
  etiqueta: string;
}

const ACCION: Readonly<Record<CategoriaDerivada, string>> = {
  entrega: 'Entregar',
  visita: 'Relevamiento',
  presupuesto: 'Entregar presupuesto',
};

const MAXIMO_DE_RENGLONES = 4;

function cuando(dia: string, fecha: string): string {
  const dias = diasEntre(dia, fecha);
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'mañana';
  return `en ${String(dias)} días`;
}

function renglon(evento: EventoDeLaAgenda, dia: string): string {
  const que =
    evento.clase === 'propia' ? evento.texto : `${ACCION[evento.categoria]}: ${evento.titulo}`;
  return `${que} (${cuando(dia, evento.fecha)})`;
}

export function cargaDelAviso(eventos: readonly EventoDeLaAgenda[], dia: string): CargaDelAviso {
  const renglones = eventos.slice(0, MAXIMO_DE_RENGLONES).map((evento) => renglon(evento, dia));
  if (eventos.length > MAXIMO_DE_RENGLONES) {
    renglones.push(`y ${String(eventos.length - MAXIMO_DE_RENGLONES)} más en la agenda`);
  }
  const deHoy = eventos.filter((evento) => evento.fecha === dia).length;
  let titulo = 'Lo que viene en la agenda';
  if (deHoy === 1) titulo = 'Hoy tenés 1 cosa en la agenda';
  if (deHoy > 1) titulo = `Hoy tenés ${String(deHoy)} cosas en la agenda`;

  return { titulo, cuerpo: renglones.join('\n'), url: '/agenda', etiqueta: `agenda-${dia}` };
}

export const CARGA_DE_LA_PRUEBA: CargaDelAviso = {
  titulo: 'Aviso de prueba',
  cuerpo: 'Si ves esto, los avisos llegan a este dispositivo.',
  url: '/ajustes/avisos',
  etiqueta: 'prueba',
};
