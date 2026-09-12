import {
  CERO,
  lineasDelLibro,
  restar,
  sumar,
  type LineaDelLibro,
  type Money,
  type Tesoro,
} from '@maun/domain';

import { datosDelLibro, filasDe, type Replica } from '@/shared/api';
import { mesDeLaFecha } from '@/shared/lib';

import { claseDe } from './clases';

export type SentidoDeLinea = 'entra' | 'sale' | 'mueve';

export type BloqueoDeLinea = 'del-proyecto' | 'ajuste';

export const MOTIVO_DEL_BLOQUEO: Readonly<Record<BloqueoDeLinea, string>> = {
  'del-proyecto':
    'Este asiento lo genera el proyecto: sale de sus pagos, de sus gastos y del reparto que quedó congelado al cobrarlo. Para cambiarlo hay que corregir el proyecto.',
  ajuste:
    'Un ajuste no se edita: es la constancia de una corrección que ya se hizo. Si quedó mal, se compensa con otro ajuste en sentido contrario.',
};

export interface LineaDelTaller extends LineaDelLibro {
  clave: string;
  etiqueta: string;
  detalle: string;
  proyectoTitulo: string | null;
  sentido: SentidoDeLinea;
  tesoroPrincipal: Tesoro;
  bloqueo: BloqueoDeLinea | null;
}

const ETIQUETA_DERIVADA: Readonly<Record<string, string>> = {
  cobro: 'Cobro del trabajo',
  gasto: 'Gasto del trabajo',
  diezmo: 'Diezmo del reparto',
  sueldo: 'Sueldo del reparto',
};

function sentidoDe(linea: LineaDelLibro): SentidoDeLinea {
  if (linea.desde !== null && linea.hacia !== null) return 'mueve';
  return linea.hacia === null ? 'sale' : 'entra';
}

function principalDe(linea: LineaDelLibro, sentido: SentidoDeLinea): Tesoro {
  if (sentido === 'entra') return linea.hacia ?? 'maun';
  if (sentido === 'sale') return linea.desde ?? 'maun';
  return linea.hacia ?? 'maun';
}

function etiquetaDe(linea: LineaDelLibro): string {
  if (linea.origen !== 'manual') return ETIQUETA_DERIVADA[linea.concepto] ?? 'Del trabajo';
  if (linea.concepto === 'ajuste') return 'Ajuste de saldo';
  return claseDe(linea.concepto, linea.desde, linea.hacia)?.etiqueta ?? 'Movimiento';
}

function bloqueoDe(linea: LineaDelLibro): BloqueoDeLinea | null {
  if (linea.origen !== 'manual') return 'del-proyecto';
  return linea.concepto === 'ajuste' ? 'ajuste' : null;
}

export function lineasDelTaller(replica: Replica): LineaDelTaller[] {
  const titulos = new Map(
    filasDe(replica, 'proyectos').map((proyecto) => [proyecto.id, proyecto.titulo]),
  );

  return lineasDelLibro(datosDelLibro(replica))
    .map((linea) => {
      const sentido = sentidoDe(linea);
      const proyectoTitulo =
        linea.proyectoId === null ? null : (titulos.get(linea.proyectoId) ?? null);
      return {
        ...linea,
        clave: `${linea.origen}:${linea.asientoId}:${linea.concepto}`,
        etiqueta: etiquetaDe(linea),
        detalle: linea.descripcion.trim(),
        proyectoTitulo,
        sentido,
        tesoroPrincipal: principalDe(linea, sentido),
        bloqueo: bloqueoDe(linea),
      };
    })
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.asientoId.localeCompare(a.asientoId));
}

export function efectoDeLaLinea(linea: LineaDelLibro, tesoro: Tesoro | 'todos'): Money {
  if (tesoro === 'todos') {
    if (linea.desde !== null && linea.hacia !== null) return CERO;
    return linea.hacia === null ? restar(CERO, linea.monto) : linea.monto;
  }
  let total = CERO;
  if (linea.hacia === tesoro) total = sumar(total, linea.monto);
  if (linea.desde === tesoro) total = restar(total, linea.monto);
  return total;
}

export const TODOS_LOS_MESES = 'todos';

export interface FiltroDelLibro {
  tesoro: Tesoro | 'todos';
  sentido: SentidoDeLinea | 'todos';
  mes: string;
  texto: string;
}

export function filtroInicial(mes: string): FiltroDelLibro {
  return { tesoro: 'todos', sentido: 'todos', mes, texto: '' };
}

export function hayFiltroPuesto(filtro: FiltroDelLibro, mes: string): boolean {
  return (
    filtro.tesoro !== 'todos' ||
    filtro.sentido !== 'todos' ||
    filtro.mes !== mes ||
    filtro.texto.trim() !== ''
  );
}

function coincideElTexto(linea: LineaDelTaller, texto: string): boolean {
  const buscado = texto.trim().toLowerCase();
  if (buscado === '') return true;
  return [linea.detalle, linea.categoria, linea.etiqueta, linea.proyectoTitulo ?? '']
    .join(' ')
    .toLowerCase()
    .includes(buscado);
}

export function filtrarLineas(
  lineas: readonly LineaDelTaller[],
  filtro: FiltroDelLibro,
): LineaDelTaller[] {
  return lineas.filter(
    (linea) =>
      (filtro.tesoro === 'todos' ||
        linea.desde === filtro.tesoro ||
        linea.hacia === filtro.tesoro) &&
      (filtro.sentido === 'todos' || linea.sentido === filtro.sentido) &&
      (filtro.mes === TODOS_LOS_MESES || mesDeLaFecha(linea.fecha) === filtro.mes) &&
      coincideElTexto(linea, filtro.texto),
  );
}

export function mesesConMovimiento(lineas: readonly LineaDelTaller[], mesActual: string): string[] {
  const meses = new Set<string>([mesActual]);
  for (const linea of lineas) meses.add(mesDeLaFecha(linea.fecha));
  return [...meses].sort((a, b) => b.localeCompare(a));
}

export interface DiaDelLibro {
  fecha: string;
  neto: Money;
  lineas: LineaDelTaller[];
}

export function agruparPorDia(
  lineas: readonly LineaDelTaller[],
  tesoro: Tesoro | 'todos',
): DiaDelLibro[] {
  const dias: DiaDelLibro[] = [];
  for (const linea of lineas) {
    let dia = dias.at(-1);
    if (!dia || dia.fecha !== linea.fecha) {
      dia = { fecha: linea.fecha, neto: CERO, lineas: [] };
      dias.push(dia);
    }
    dia.lineas.push(linea);
    dia.neto = sumar(dia.neto, efectoDeLaLinea(linea, tesoro));
  }
  return dias;
}
