export const DIAS_HABILES_DE_ENTREGA = 21;

export const DIAS_HABILES_PARA_PRESUPUESTAR = 3;

const MS_POR_DIA = 86_400_000;
const FORMATO = /^(\d{4})-(\d{2})-(\d{2})$/;

function diaDesdeEpoca(fecha: string): number {
  const partes = FORMATO.exec(fecha);
  const anio = Number(partes?.[1]);
  const mes = Number(partes?.[2]);
  const dia = Number(partes?.[3]);
  const instante = new Date(Date.UTC(anio, mes - 1, dia));
  if (
    partes === null ||
    instante.getUTCFullYear() !== anio ||
    instante.getUTCMonth() !== mes - 1 ||
    instante.getUTCDate() !== dia
  ) {
    throw new RangeError(`Una fecha va como AAAA-MM-DD y tiene que existir: ${fecha} no.`);
  }
  return instante.getTime() / MS_POR_DIA;
}

function fechaDesdeDia(dia: number): string {
  const instante = new Date(dia * MS_POR_DIA);
  const anio = String(instante.getUTCFullYear()).padStart(4, '0');
  const mes = String(instante.getUTCMonth() + 1).padStart(2, '0');
  const diaDelMes = String(instante.getUTCDate()).padStart(2, '0');
  return `${anio}-${mes}-${diaDelMes}`;
}

function esFinDeSemana(dia: number): boolean {
  const diaDeLaSemana = new Date(dia * MS_POR_DIA).getUTCDay();
  return diaDeLaSemana === 0 || diaDeLaSemana === 6;
}

export function sumarDiasHabiles(
  desde: string,
  cantidad: number,
  feriados: Iterable<string> = [],
): string {
  if (!Number.isInteger(cantidad) || cantidad < 0) {
    throw new RangeError(
      `La cantidad de días hábiles es un entero no negativo: ${String(cantidad)} no.`,
    );
  }
  const noLaborables = new Set<number>();
  for (const feriado of feriados) noLaborables.add(diaDesdeEpoca(feriado));

  let dia = diaDesdeEpoca(desde);
  let contados = 0;
  while (contados < cantidad) {
    dia += 1;
    if (!esFinDeSemana(dia) && !noLaborables.has(dia)) contados += 1;
  }
  return fechaDesdeDia(dia);
}

export function entregaEstimada(inicio: string, feriados: Iterable<string> = []): string {
  return sumarDiasHabiles(inicio, DIAS_HABILES_DE_ENTREGA, feriados);
}

export function vencimientoDelPresupuesto(
  relevamiento: string,
  feriados: Iterable<string> = [],
): string {
  return sumarDiasHabiles(relevamiento, DIAS_HABILES_PARA_PRESUPUESTAR, feriados);
}

export function sumarDias(desde: string, cantidad: number): string {
  if (!Number.isInteger(cantidad)) {
    throw new RangeError(`La cantidad de días es un entero: ${String(cantidad)} no.`);
  }
  return fechaDesdeDia(diaDesdeEpoca(desde) + cantidad);
}

export function diasEntre(desde: string, hasta: string): number {
  return diaDesdeEpoca(hasta) - diaDesdeEpoca(desde);
}

export function mesDe(fecha: string): string {
  diaDesdeEpoca(fecha);
  return fecha.slice(0, 7);
}
