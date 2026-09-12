const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES_CORTOS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];
const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const MS_POR_DIA = 86_400_000;

export function hoyLocal(ahora: Date = new Date()): string {
  const anio = String(ahora.getFullYear()).padStart(4, '0');
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

function comoUtc(fecha: string): Date {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return new Date(Date.UTC(anio ?? 0, (mes ?? 1) - 1, dia ?? 1));
}

export function mesDeLaFecha(fecha: string): string {
  return fecha.slice(0, 7);
}

export function nombreDelMes(mes: string): string {
  const indice = Number(mes.slice(5, 7)) - 1;
  return MESES[indice] ?? '';
}

export function diasDelMes(mes: string): number {
  const anio = Number(mes.slice(0, 4));
  const numero = Number(mes.slice(5, 7));
  return new Date(Date.UTC(anio, numero, 0)).getUTCDate();
}

export function mesAnterior(mes: string): string {
  const anio = Number(mes.slice(0, 4));
  const numero = Number(mes.slice(5, 7));
  const previo = new Date(Date.UTC(anio, numero - 2, 1));
  return `${String(previo.getUTCFullYear()).padStart(4, '0')}-${String(previo.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function diaDelMes(fecha: string): number {
  return comoUtc(fecha).getUTCDate();
}

export function fechaLarga(fecha: string, hoy: string = hoyLocal()): string {
  const dia = comoUtc(fecha);
  const anio = dia.getUTCFullYear();
  const sufijo = anio === comoUtc(hoy).getUTCFullYear() ? '' : ` ${String(anio)}`;
  return `${DIAS[dia.getUTCDay()] ?? ''} ${String(dia.getUTCDate())} ${MESES_CORTOS[dia.getUTCMonth()] ?? ''}${sufijo}`;
}

export function diasHasta(fecha: string, desde: string = hoyLocal()): number {
  return Math.round((comoUtc(fecha).getTime() - comoUtc(desde).getTime()) / MS_POR_DIA);
}

export function relativa(fecha: string, desde: string = hoyLocal()): string {
  const dias = diasHasta(fecha, desde);
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'mañana';
  if (dias === -1) return 'ayer';
  if (dias > 0)
    return dias < 30 ? `en ${String(dias)} días` : `en ${String(Math.round(dias / 30))} meses`;
  const atras = -dias;
  if (atras < 30) return `hace ${String(atras)} días`;
  const meses = Math.round(atras / 30);
  return `hace ${String(meses)} ${meses === 1 ? 'mes' : 'meses'}`;
}
