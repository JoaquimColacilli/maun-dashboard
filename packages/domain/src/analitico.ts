import type { EstadoProyecto } from './estados.ts';
import { diasEntre } from './fechas.ts';
import { claveDelNombre } from './necesidades.ts';

export const UMBRAL_MEDIANA = 5;

export const UMBRAL_CUENTAS = 10;

export const UMBRAL_PORCENTAJE = 20;

export const DIAS_DE_ACIERTO = 3;

export const SIN_TIPO = 'Sin tipo';

export type TipoDeFecha = 'estimada' | 'comprometida';

export type OrigenDeLaFecha = 'taller' | 'cliente' | 'importada';

export interface TrabajoParaElAnalisis {
  id: string;
  titulo: string;
  tipo: string | null;
  estado: EstadoProyecto;
  inicio: string | null;
  listo: string | null;
  entregado: string | null;
}

export interface CambioDeFechaParaElAnalisis {
  id: string;
  proyectoId: string;
  tipo: TipoDeFecha;
  fecha: string | null;
  origen: OrigenDeLaFecha;
  creadoEn: string;
  trabajosEnCurso: number | null;
}

export interface FilaDelAnalisis {
  id: string;
  titulo: string;
  tipo: string | null;
  primeraEstimada: string | null;
  importada: boolean;
  entregado: string;
  desvio: number | null;
  acierto: boolean | null;
  comprometida: string | null;
  cumplida: boolean | null;
  demora: number | null;
  fabricacion: number | null;
  cargaAlAprobar: number | null;
}

export type ResumenDeDias =
  | { modo: 'casos'; n: number; valores: readonly number[] }
  | { modo: 'mediana'; n: number; mediana: number; minimo: number; maximo: number };

export interface Cuenta {
  k: number;
  n: number;
  porcentaje: number | null;
}

export interface PrecisionDeLasEntregas {
  desvio: ResumenDeDias;
  importadas: number;
  aciertos: Cuenta | null;
  cumplidas: Cuenta | null;
  frase: string;
}

export interface GrupoPorTipo {
  clave: string;
  nombre: string;
  trabajos: number;
  demora: ResumenDeDias;
  fabricacion: ResumenDeDias;
  desvio: ResumenDeDias;
}

export interface GrupoPorCarga {
  nombre: string;
  desde: number;
  hasta: number | null;
  demora: ResumenDeDias;
}

export interface AnalisisDeEntregas {
  trabajos: readonly FilaDelAnalisis[];
  sinFecha: number;
  precision: PrecisionDeLasEntregas;
  porTipo: readonly GrupoPorTipo[];
  sinTipo: GrupoPorTipo | null;
  porCarga: readonly GrupoPorCarga[];
}

const CARGAS: readonly Omit<GrupoPorCarga, 'demora'>[] = [
  { nombre: '0 o 1', desde: 0, hasta: 1 },
  { nombre: '2 o 3', desde: 2, hasta: 3 },
  { nombre: '4 o más', desde: 4, hasta: null },
];

export function resumirDias(valores: readonly number[]): ResumenDeDias {
  const n = valores.length;
  if (n < UMBRAL_MEDIANA) return { modo: 'casos', n, valores };
  const orden = [...valores].sort((uno, otro) => uno - otro);
  const medio = orden.slice(Math.floor((n - 1) / 2), Math.floor(n / 2) + 1);
  return {
    modo: 'mediana',
    n,
    mediana: medio.reduce((suma, valor) => suma + valor, 0) / medio.length,
    minimo: Math.min(...orden),
    maximo: Math.max(...orden),
  };
}

export function cuentaDe(k: number, n: number): Cuenta {
  return { k, n, porcentaje: n >= UMBRAL_PORCENTAJE ? Math.round((k * 100) / n) : null };
}

function enOrden(cambios: readonly CambioDeFechaParaElAnalisis[]): CambioDeFechaParaElAnalisis[] {
  return [...cambios].sort((uno, otro) => {
    if (uno.creadoEn !== otro.creadoEn) return uno.creadoEn < otro.creadoEn ? -1 : 1;
    return uno.id < otro.id ? -1 : 1;
  });
}

type ConFecha = CambioDeFechaParaElAnalisis & { fecha: string };

function primeraConFecha(
  cambios: readonly CambioDeFechaParaElAnalisis[],
  tipo: TipoDeFecha,
): ConFecha | null {
  for (const cambio of cambios) {
    if (cambio.tipo === tipo && cambio.fecha !== null) return { ...cambio, fecha: cambio.fecha };
  }
  return null;
}

function diasDesde(desde: string | null, hasta: string | null): number | null {
  return desde === null || hasta === null ? null : diasEntre(desde, hasta);
}

function filaDelTrabajo(
  trabajo: TrabajoParaElAnalisis & { entregado: string },
  cambios: readonly CambioDeFechaParaElAnalisis[],
): FilaDelAnalisis {
  const base = primeraConFecha(cambios, 'estimada');
  const comprometida = primeraConFecha(cambios, 'comprometida');
  const desvio = diasDesde(base?.fecha ?? null, trabajo.entregado);
  const tipo = trabajo.tipo?.trim() ?? '';
  return {
    id: trabajo.id,
    titulo: trabajo.titulo,
    tipo: tipo === '' ? null : tipo,
    primeraEstimada: base?.fecha ?? null,
    importada: base?.origen === 'importada',
    entregado: trabajo.entregado,
    desvio,
    acierto: desvio === null ? null : Math.abs(desvio) <= DIAS_DE_ACIERTO,
    comprometida: comprometida?.fecha ?? null,
    cumplida: comprometida === null ? null : diasEntre(trabajo.entregado, comprometida.fecha) >= 0,
    demora: diasDesde(trabajo.inicio, trabajo.entregado),
    fabricacion: diasDesde(trabajo.inicio, trabajo.listo),
    cargaAlAprobar: base?.trabajosEnCurso ?? null,
  };
}

function valoresDe(
  filas: readonly FilaDelAnalisis[],
  campo: 'desvio' | 'demora' | 'fabricacion',
): number[] {
  return filas.flatMap((fila) => {
    const valor = fila[campo];
    return valor === null ? [] : [valor];
  });
}

function nombreDelGrupo(nombres: readonly string[]): string {
  return [...new Set(nombres)]
    .map((nombre) => ({ nombre, veces: nombres.filter((otro) => otro === nombre).length }))
    .reduce((mejor, candidato) =>
      candidato.veces > mejor.veces ||
      (candidato.veces === mejor.veces && candidato.nombre.localeCompare(mejor.nombre, 'es') < 0)
        ? candidato
        : mejor,
    ).nombre;
}

function masReciente(una: FilaDelAnalisis, otra: FilaDelAnalisis): number {
  return `${una.entregado} ${una.id}` < `${otra.entregado} ${otra.id}` ? 1 : -1;
}

interface FilasDelTipo {
  filas: FilaDelAnalisis[];
  nombres: string[];
}

function grupoDe(clave: string, { filas, nombres }: FilasDelTipo): GrupoPorTipo {
  return {
    clave,
    nombre: clave === '' ? SIN_TIPO : nombreDelGrupo(nombres),
    trabajos: filas.length,
    demora: resumirDias(valoresDe(filas, 'demora')),
    fabricacion: resumirDias(valoresDe(filas, 'fabricacion')),
    desvio: resumirDias(valoresDe(filas, 'desvio')),
  };
}

function enDias(dias: number): string {
  const texto = String(dias).replace('.', ',');
  return dias === 1 ? '1 día' : `${texto} días`;
}

export function fraseDelDesvio(desvio: ResumenDeDias): string {
  if (desvio.n === 0)
    return 'Todavía no entregaste ningún trabajo con una fecha estimada para comparar.';
  if (desvio.modo === 'casos') {
    const cuantos = desvio.n === 1 ? 'un trabajo' : `${String(desvio.n)} trabajos`;
    return `Con ${cuantos} todavía son pocos para sacar una cuenta: miralos uno por uno.`;
  }
  if (desvio.mediana === 0) return 'Entregás, en la mediana, el mismo día que estimaste.';
  const sentido = desvio.mediana > 0 ? 'después' : 'antes';
  return `Entregás, en la mediana, ${enDias(Math.abs(desvio.mediana))} ${sentido} de lo estimado.`;
}

function conPorcentaje(cuenta: Cuenta): string {
  return cuenta.porcentaje === null ? '' : ` (${String(cuenta.porcentaje)}%)`;
}

export function fraseDeLosAciertos(cuenta: Cuenta): string {
  return `Acertaste ${String(cuenta.k)} de ${String(cuenta.n)}${conPorcentaje(cuenta)}.`;
}

export function fraseDeLasCumplidas(cuenta: Cuenta): string {
  return `Cumpliste ${String(cuenta.k)} de ${String(cuenta.n)} fechas comprometidas${conPorcentaje(cuenta)}.`;
}

export function analisisDeEntregas(
  trabajos: readonly TrabajoParaElAnalisis[],
  cambios: readonly CambioDeFechaParaElAnalisis[],
): AnalisisDeEntregas {
  const porTrabajo = new Map<string, CambioDeFechaParaElAnalisis[]>();
  for (const cambio of enOrden(cambios)) {
    porTrabajo.set(cambio.proyectoId, [...(porTrabajo.get(cambio.proyectoId) ?? []), cambio]);
  }

  const cerrados = trabajos.filter(
    (trabajo) => trabajo.estado === 'entregado' || trabajo.estado === 'cobrado',
  );
  const filas = cerrados
    .flatMap((trabajo) =>
      trabajo.entregado === null
        ? []
        : [
            filaDelTrabajo(
              { ...trabajo, entregado: trabajo.entregado },
              porTrabajo.get(trabajo.id) ?? [],
            ),
          ],
    )
    .sort(masReciente);

  const conDesvio = filas.filter((fila) => fila.desvio !== null);
  const conComprometida = filas.filter((fila) => fila.cumplida !== null);
  const desvio = resumirDias(valoresDe(filas, 'desvio'));

  const porClave = new Map<string, FilasDelTipo>();
  for (const fila of filas) {
    const tipo = fila.tipo ?? '';
    const clave = claveDelNombre(tipo);
    const delTipo = porClave.get(clave) ?? { filas: [], nombres: [] };
    porClave.set(clave, { filas: [...delTipo.filas, fila], nombres: [...delTipo.nombres, tipo] });
  }
  const grupos = [...porClave.entries()].map(([clave, delTipo]) => grupoDe(clave, delTipo));
  const sinTipo = grupos.find((grupo) => grupo.clave === '') ?? null;

  return {
    trabajos: filas,
    sinFecha: cerrados.length - filas.length,
    precision: {
      desvio,
      importadas: conDesvio.filter((fila) => fila.importada).length,
      aciertos:
        conDesvio.length >= UMBRAL_CUENTAS
          ? cuentaDe(conDesvio.filter((fila) => fila.acierto === true).length, conDesvio.length)
          : null,
      cumplidas:
        conComprometida.length >= UMBRAL_CUENTAS
          ? cuentaDe(
              conComprometida.filter((fila) => fila.cumplida === true).length,
              conComprometida.length,
            )
          : null,
      frase: fraseDelDesvio(desvio),
    },
    porTipo: grupos
      .filter((grupo) => grupo.clave !== '')
      .sort(
        (uno, otro) => otro.trabajos - uno.trabajos || uno.nombre.localeCompare(otro.nombre, 'es'),
      ),
    sinTipo,
    porCarga: CARGAS.map((carga) => ({
      ...carga,
      demora: resumirDias(
        valoresDe(
          filas.filter(
            (fila) =>
              fila.cargaAlAprobar !== null &&
              fila.cargaAlAprobar >= carga.desde &&
              (carga.hasta === null || fila.cargaAlAprobar <= carga.hasta),
          ),
          'demora',
        ),
      ),
    })),
  };
}
