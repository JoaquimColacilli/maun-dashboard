import {
  calcularDistribucion,
  calcularLiquidacion,
  centavos,
  DIEZMO,
  ESTADOS,
  esEstado,
  estaLiquidado,
  puedeCambiarEstado,
  puedeLiquidar,
  puedeRevertir,
  puntosBasicos,
  topesDeLaLiquidacion,
  type AjustesDeLiquidacion,
  type Distribucion,
  type EntradaCascada,
  type EstadoLiquidado,
  type EstadoProyecto,
  type Liquidacion,
  type LiquidacionRegistrada,
  type Reapertura,
} from '@maun/domain';
import type pg from 'pg';

export const HOUSEHOLD_DEL_SEED = '5eed0000-0000-7000-8000-000000000001';

type Tupla = [number, number, number, number, number];
type TuplaTopes = [number, number, boolean, number, number];

function generador(semilla: number): (tope: number) => number {
  let estado = semilla >>> 0;
  return (tope) => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4_294_967_296) * tope);
  };
}

function entrada([cobrado, gastos, diezmoBp, topeSueldo, topeFijos]: Tupla): EntradaCascada {
  return {
    cobrado: centavos(cobrado),
    gastos: centavos(gastos),
    diezmoBp: puntosBasicos(diezmoBp),
    topeSueldo: centavos(topeSueldo),
    topeFijos: centavos(topeFijos),
  };
}

function topesEnTs([
  objetivoSueldo,
  objetivoFijos,
  sueldoMensual,
  previoSueldo,
  previoFijos,
]: TuplaTopes) {
  return topesDeLaLiquidacion(
    { sueldo: centavos(objetivoSueldo), fijos: centavos(objetivoFijos), sueldoMensual },
    { sueldo: centavos(previoSueldo), fijos: centavos(previoFijos) },
  );
}

export function casosDeCascada(): Tupla[] {
  const casos: Tupla[] = [
    [0, 0, 1_000, 0, 0],
    [100_000_000, 100_000_000, 1_000, 180_000_000, 25_000_000],
    [50_000_000, 80_000_000, 1_000, 180_000_000, 25_000_000],
    [0, 12_500_000, 1_000, 180_000_000, 25_000_000],
    [15, 0, 1_000, 0, 0],
    [14, 0, 1_000, 0, 0],
    [5, 0, 1_000, 0, 0],
    [25, 0, 1_000, 0, 0],
    [4, 0, 1_000, 0, 0],
    [1, 0, 1_000, 180_000_000, 0],
    [1_000_005, 0, 1_000, 180_000_000, 25_000_000],
    [1_000_015, 0, 1_000, 180_000_000, 25_000_000],
    [124_000_000, 35_330_000, 1_000, 180_000_000, 25_000_000],
    [215_000_000, 0, 1_000, 180_000_000, 25_000_000],
    [480_000_000, 165_000_000, 1_000, 180_000_000, 25_000_000],
    [10_000_000, 0, 0, 0, 0],
    [10_000_000, 0, 10_000, 0, 0],
    [900_719_925_473, 0, 10_000, 0, 0],
    [900_719_925_473, 1, 9_999, 300_000_000_000, 100_000_000_000],
    [9_007_199_254_735, 0, 1_000, 0, 0],
  ];
  const siguiente = generador(20_260_912);
  for (let i = 0; i < 5_000; i++) {
    casos.push([
      siguiente(i % 7 === 0 ? 900_000_000_000 : 1_000_000_000),
      siguiente(600_000_000),
      i % 5 === 0 ? siguiente(10_001) : DIEZMO,
      siguiente(250_000_000),
      siguiente(50_000_000),
    ]);
  }
  return casos;
}

export function casosDeTopes(): TuplaTopes[] {
  const casos: TuplaTopes[] = [
    [0, 0, false, 0, 0],
    [0, 0, true, 0, 0],
    [180_000_000, 25_000_000, false, 500_000_000, 25_000_000],
    [180_000_000, 25_000_000, true, 180_000_000, 30_000_000],
    [180_000_000, 25_000_000, true, 179_999_999, 24_999_999],
    [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, true, 0, Number.MAX_SAFE_INTEGER],
  ];
  const siguiente = generador(20_260_913);
  for (let i = 0; i < 2_000; i++) {
    casos.push([
      siguiente(250_000_000),
      siguiente(60_000_000),
      i % 2 === 0,
      siguiente(400_000_000),
      siguiente(80_000_000),
    ]);
  }
  return casos;
}

const CASOS_FUERA_DE_RANGO: Tupla[] = [
  [9_007_199_254_736, 0, 1_000, 0, 0],
  [Number.MAX_SAFE_INTEGER, 1, 1, 0, 0],
  [Number.MAX_SAFE_INTEGER, 0, 0, 0, 0],
  [9_007_199_254_735, 0, 1_000, 0, 0],
];

const TOPES_FUERA_DE_RANGO: TuplaTopes[] = [
  [Number.MAX_SAFE_INTEGER + 1, 0, false, 0, 0],
  [0, 0, true, Number.MAX_SAFE_INTEGER + 1, 0],
  [-1, 0, false, 0, 0],
  [0, 0, false, 0, -1],
  [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, true, Number.MAX_SAFE_INTEGER, 0],
];

interface FilaCascada {
  neta_centavos: string;
  diezmo_centavos: string;
  sueldo_centavos: string;
  fijos_centavos: string;
  remanente_centavos: string;
}

function escalones(
  distribucion: Pick<Distribucion, 'neta' | 'diezmo' | 'sueldo' | 'fijos' | 'remanente'>,
): string {
  const { neta, diezmo, sueldo, fijos, remanente } = distribucion;
  return JSON.stringify({ neta, diezmo, sueldo, fijos, remanente });
}

function escalonesDeSql(fila: FilaCascada): string {
  return JSON.stringify({
    neta: Number(fila.neta_centavos),
    diezmo: Number(fila.diezmo_centavos),
    sueldo: Number(fila.sueldo_centavos),
    fijos: Number(fila.fijos_centavos),
    remanente: Number(fila.remanente_centavos),
  });
}

function columnas(casos: readonly (readonly unknown[])[], cantidad: number): unknown[][] {
  return Array.from({ length: cantidad }, (_, columna) => casos.map((caso) => caso[columna]));
}

export async function compararCascada(cliente: pg.Client): Promise<string[]> {
  const casos = casosDeCascada();
  const { rows } = await cliente.query<FilaCascada & { orden: string }>(
    `select c.orden, r.*
     from unnest($1::bigint[], $2::bigint[], $3::int[], $4::bigint[], $5::bigint[])
       with ordinality as c (cobrado, gastos, diezmo_bp, tope_sueldo, tope_fijos, orden)
     cross join lateral private.cascada(c.cobrado, c.gastos, c.diezmo_bp, c.tope_sueldo, c.tope_fijos) as r
     order by c.orden`,
    columnas(casos, 5),
  );
  if (rows.length !== casos.length) {
    return [
      `la cascada de SQL devolvió ${String(rows.length)} filas para ${String(casos.length)} casos`,
    ];
  }
  return rows.flatMap((fila, i) => {
    const caso = casos[i] ?? [0, 0, 0, 0, 0];
    const ts = escalones(calcularDistribucion(entrada(caso)));
    const sql = escalonesDeSql(fila);
    return ts === sql ? [] : [`cascada ${JSON.stringify(caso)}: SQL ${sql}, TS ${ts}`];
  });
}

export async function compararTopes(cliente: pg.Client): Promise<string[]> {
  const casos = casosDeTopes();
  const { rows } = await cliente.query<{
    tope_sueldo_centavos: string;
    tope_fijos_centavos: string;
  }>(
    `select r.*
     from unnest($1::bigint[], $2::bigint[], $3::boolean[], $4::bigint[], $5::bigint[])
       with ordinality as c (objetivo_sueldo, objetivo_fijos, sueldo_mensual, previo_sueldo, previo_fijos, orden)
     cross join lateral private.topes_de_la_liquidacion(
       c.objetivo_sueldo, c.objetivo_fijos, c.sueldo_mensual, c.previo_sueldo, c.previo_fijos
     ) as r
     order by c.orden`,
    columnas(casos, 5),
  );
  if (rows.length !== casos.length) {
    return [
      `los topes de SQL devolvieron ${String(rows.length)} filas para ${String(casos.length)} casos`,
    ];
  }
  return rows.flatMap((fila, i) => {
    const caso = casos[i] ?? [0, 0, false, 0, 0];
    const ts = JSON.stringify(topesEnTs(caso));
    const sql = JSON.stringify({
      topeSueldo: Number(fila.tope_sueldo_centavos),
      topeFijos: Number(fila.tope_fijos_centavos),
    });
    return ts === sql ? [] : [`topes ${JSON.stringify(caso)}: SQL ${sql}, TS ${ts}`];
  });
}

function rechazaEnTs(calculo: () => unknown): boolean {
  try {
    calculo();
    return false;
  } catch {
    return true;
  }
}

async function rechazaEnSql(
  cliente: pg.Client,
  sql: string,
  parametros: unknown[],
): Promise<boolean> {
  await cliente.query('savepoint rango');
  let rechaza = false;
  try {
    await cliente.query(sql, parametros);
  } catch {
    rechaza = true;
  }
  await cliente.query('rollback to savepoint rango');
  return rechaza;
}

function diferenciaDeRango(que: string, caso: unknown, ts: boolean, sql: boolean): string[] {
  return ts === sql
    ? []
    : [
        `${que} ${JSON.stringify(caso)}: TS ${ts ? 'rechaza' : 'acepta'}, SQL ${sql ? 'rechaza' : 'acepta'}`,
      ];
}

export async function compararRangos(cliente: pg.Client): Promise<string[]> {
  const diferencias: string[] = [];
  for (const caso of CASOS_FUERA_DE_RANGO) {
    const ts = rechazaEnTs(() => calcularDistribucion(entrada(caso)));
    const sql = await rechazaEnSql(
      cliente,
      'select * from private.cascada($1, $2, $3, $4, $5)',
      caso,
    );
    diferencias.push(...diferenciaDeRango('rango de la cascada', caso, ts, sql));
  }
  for (const caso of TOPES_FUERA_DE_RANGO) {
    const ts = rechazaEnTs(() => topesEnTs(caso));
    const sql = await rechazaEnSql(
      cliente,
      'select * from private.topes_de_la_liquidacion($1, $2, $3, $4, $5)',
      caso.map(String),
    );
    diferencias.push(...diferenciaDeRango('rango de los topes', caso, ts, sql));
  }
  return diferencias;
}

export async function compararEstados(cliente: pg.Client): Promise<string[]> {
  const { rows } = await cliente.query<{ estados: string[] }>(
    `select array_agg(e.enumlabel::text order by e.enumsortorder) as estados
     from pg_enum e where e.enumtypid = 'public.estado_proyecto'::regtype`,
  );
  const enPostgres = JSON.stringify(rows[0]?.estados ?? []);
  const enDominio = JSON.stringify(ESTADOS);
  return enPostgres === enDominio ? [] : [`estados: Postgres ${enPostgres}, dominio ${enDominio}`];
}

export async function compararTransiciones(cliente: pg.Client): Promise<string[]> {
  const { rows } = await cliente.query<{
    desde: string;
    hasta: string;
    transicion: boolean;
    liquidacion: boolean;
    reversion: boolean;
  }>(
    `select d.estado as desde, h.estado as hasta,
            private.transicion_valida(d.estado::public.estado_proyecto, h.estado::public.estado_proyecto) as transicion,
            private.liquidacion_valida(d.estado::public.estado_proyecto, h.estado::public.estado_proyecto) as liquidacion,
            private.reversion_valida(d.estado::public.estado_proyecto, h.estado::public.estado_proyecto) as reversion
     from unnest($1::text[]) as d (estado)
     cross join unnest($1::text[]) as h (estado)`,
    [[...ESTADOS]],
  );
  if (rows.length !== ESTADOS.length ** 2) return [`transiciones: ${String(rows.length)} filas`];
  return rows.flatMap((fila) => {
    if (!esEstado(fila.desde) || !esEstado(fila.hasta))
      return [`transición desconocida ${fila.desde} → ${fila.hasta}`];
    const desde = fila.desde;
    const hasta = fila.hasta;
    const pares: [string, boolean, boolean][] = [
      ['transición', puedeCambiarEstado(desde, hasta), fila.transicion],
      ['liquidación', puedeLiquidar(desde, hasta), fila.liquidacion],
      ['reversión', puedeRevertir(desde, hasta), fila.reversion],
    ];
    return pares.flatMap(([que, ts, sql]) =>
      ts === sql ? [] : [`${que} ${desde} → ${hasta}: SQL ${String(sql)}, TS ${String(ts)}`],
    );
  });
}

export interface FilaProyecto {
  id: string;
  estado: string;
  version: number;
  fecha_cobro: string | null;
  cobrado: string | null;
  gastos: string | null;
  diezmo_bp: number | null;
  tope_sueldo: string | null;
  tope_fijos: string | null;
  diezmo: string | null;
  sueldo: string | null;
  fijos: string | null;
  remanente: string | null;
  objetivo_sueldo: string | null;
  objetivo_fijos: string | null;
  sueldo_mensual: boolean | null;
  sueldo_previo: string | null;
  fijos_previo: string | null;
  liquidado_en: number | null;
  reapertura_objetivo_sueldo: string | null;
  reapertura_objetivo_fijos: string | null;
  reapertura_sueldo_mensual: boolean | null;
  reapertura_fecha: string | null;
}

const COLUMNAS = `p.id, p.estado::text as estado, p.version, p.fecha_cobro::text as fecha_cobro,
  p.dist_cobrado_centavos::text as cobrado, p.dist_gastos_centavos::text as gastos,
  p.dist_diezmo_bp as diezmo_bp,
  p.dist_tope_sueldo_centavos::text as tope_sueldo, p.dist_tope_fijos_centavos::text as tope_fijos,
  p.dist_diezmo_centavos::text as diezmo, p.dist_sueldo_centavos::text as sueldo,
  p.dist_fijos_centavos::text as fijos, p.dist_remanente_centavos::text as remanente,
  p.dist_objetivo_sueldo_centavos::text as objetivo_sueldo,
  p.dist_objetivo_fijos_centavos::text as objetivo_fijos, p.dist_sueldo_mensual as sueldo_mensual,
  p.dist_sueldo_previo_centavos::text as sueldo_previo,
  p.dist_fijos_previo_centavos::text as fijos_previo,
  (extract(epoch from p.dist_liquidado_at) * 1000)::float8 as liquidado_en,
  p.reapertura_objetivo_sueldo_centavos::text as reapertura_objetivo_sueldo,
  p.reapertura_objetivo_fijos_centavos::text as reapertura_objetivo_fijos,
  p.reapertura_sueldo_mensual, p.reapertura_fecha_cobro::text as reapertura_fecha`;

function entero(valor: string | null): number | null {
  return valor === null ? null : Number(valor);
}

function congelado(fila: FilaProyecto): string {
  return JSON.stringify([
    fila.estado,
    fila.fecha_cobro,
    entero(fila.cobrado),
    entero(fila.gastos),
    fila.diezmo_bp,
    entero(fila.tope_sueldo),
    entero(fila.tope_fijos),
    entero(fila.diezmo),
    entero(fila.sueldo),
    entero(fila.fijos),
    entero(fila.remanente),
    entero(fila.objetivo_sueldo),
    entero(fila.objetivo_fijos),
    fila.sueldo_mensual,
    entero(fila.sueldo_previo),
    entero(fila.fijos_previo),
    fila.liquidado_en !== null,
    entero(fila.reapertura_objetivo_sueldo),
    entero(fila.reapertura_objetivo_fijos),
    fila.reapertura_sueldo_mensual,
    fila.reapertura_fecha,
  ]);
}

function esperadoAlLiquidar(liquidacion: Liquidacion): string {
  return JSON.stringify([
    liquidacion.destino,
    liquidacion.fecha,
    liquidacion.cobrado,
    liquidacion.gastos,
    liquidacion.diezmoBp,
    liquidacion.topeSueldo,
    liquidacion.topeFijos,
    liquidacion.diezmo,
    liquidacion.sueldo,
    liquidacion.fijos,
    liquidacion.remanente,
    liquidacion.objetivos.sueldo,
    liquidacion.objetivos.fijos,
    liquidacion.objetivos.sueldoMensual,
    liquidacion.previo.sueldo,
    liquidacion.previo.fijos,
    true,
    null,
    null,
    null,
    null,
  ]);
}

function esperadoAlRevertir(antes: FilaProyecto, hacia: EstadoProyecto): string {
  const conFoto = antes.estado === 'cobrado';
  return JSON.stringify([
    hacia,
    ...Array<null>(15).fill(null),
    false,
    conFoto ? entero(antes.objetivo_sueldo) : null,
    conFoto ? entero(antes.objetivo_fijos) : null,
    conFoto ? antes.sueldo_mensual : null,
    conFoto ? antes.fecha_cobro : null,
  ]);
}

function registrada(fila: FilaProyecto): LiquidacionRegistrada | null {
  if (!esEstado(fila.estado) || !estaLiquidado(fila.estado) || fila.fecha_cobro === null)
    return null;
  return {
    estado: fila.estado,
    fecha: fila.fecha_cobro,
    liquidadaEn: fila.liquidado_en ?? 0,
    sueldo: centavos(Number(fila.sueldo)),
    fijos: centavos(Number(fila.fijos)),
    objetivoSueldo: centavos(Number(fila.objetivo_sueldo)),
    objetivoFijos: centavos(Number(fila.objetivo_fijos)),
  };
}

function reaperturaDe(fila: FilaProyecto): Reapertura | null {
  if (fila.reapertura_fecha === null) return null;
  return {
    fecha: fila.reapertura_fecha,
    objetivoSueldo: centavos(Number(fila.reapertura_objetivo_sueldo)),
    objetivoFijos: centavos(Number(fila.reapertura_objetivo_fijos)),
    sueldoMensual: fila.reapertura_sueldo_mensual === true,
  };
}

async function leerProyectos(
  cliente: pg.Client,
  condicion: string,
  parametros: unknown[],
): Promise<FilaProyecto[]> {
  const { rows } = await cliente.query<FilaProyecto>(
    `select ${COLUMNAS} from public.proyectos p where ${condicion}`,
    parametros,
  );
  return rows;
}

async function leerProyecto(cliente: pg.Client, proyectoId: string): Promise<FilaProyecto> {
  const [fila] = await leerProyectos(cliente, 'p.id = $1', [proyectoId]);
  if (fila === undefined) throw new Error(`no existe el proyecto ${proyectoId}`);
  return fila;
}

async function leerAjustes(cliente: pg.Client, householdId: string): Promise<AjustesDeLiquidacion> {
  const { rows } = await cliente.query<{
    sueldo: string;
    fijos: string;
    sueldo_tope_mensual: boolean;
    perdido_con_sueldo: boolean;
    perdido_con_diezmo: boolean;
  }>(
    `select sueldo_mensual_centavos::text as sueldo, costos_fijos_centavos::text as fijos,
            sueldo_tope_mensual, perdido_con_sueldo, perdido_con_diezmo
     from public.ajustes where household_id = $1`,
    [householdId],
  );
  const fila = rows[0];
  if (fila === undefined) throw new Error(`el household ${householdId} no tiene ajustes`);
  return {
    sueldoMensual: centavos(Number(fila.sueldo)),
    costosFijos: centavos(Number(fila.fijos)),
    sueldoTopeMensual: fila.sueldo_tope_mensual,
    perdidoConSueldo: fila.perdido_con_sueldo,
    perdidoConDiezmo: fila.perdido_con_diezmo,
  };
}

async function totales(
  cliente: pg.Client,
  proyectoId: string,
): Promise<{ cobrado: number; gastos: number }> {
  const { rows } = await cliente.query<{ cobrado: string; gastos: string }>(
    `select (select coalesce(sum(monto_centavos), 0) from public.pagos where proyecto_id = $1 and deleted_at is null)::text as cobrado,
            (select coalesce(sum(monto_centavos), 0) from public.gastos where proyecto_id = $1 and deleted_at is null)::text as gastos`,
    [proyectoId],
  );
  return { cobrado: Number(rows[0]?.cobrado), gastos: Number(rows[0]?.gastos) };
}

export interface LiquidacionPreparada {
  proyectoId: string;
  version: number;
  esperado: Liquidacion;
}

export async function prepararLiquidacion(
  cliente: pg.Client,
  householdId: string,
  proyectoId: string,
  destino: EstadoLiquidado,
  fecha: string,
): Promise<LiquidacionPreparada> {
  const actual = await leerProyecto(cliente, proyectoId);
  const otras = await leerProyectos(
    cliente,
    'p.household_id = $1 and p.fecha_cobro is not null and p.deleted_at is null and p.id <> $2',
    [householdId, proyectoId],
  );
  const { cobrado, gastos } = await totales(cliente, proyectoId);
  const esperado = calcularLiquidacion({
    destino,
    fecha,
    cobrado: centavos(cobrado),
    gastos: centavos(gastos),
    ajustes: await leerAjustes(cliente, householdId),
    reapertura: reaperturaDe(actual),
    liquidaciones: otras.map(registrada).filter((liquidacion) => liquidacion !== null),
  });
  return { proyectoId, version: actual.version, esperado };
}

export function liquidarPreparada(
  cliente: pg.Client,
  { proyectoId, version, esperado }: LiquidacionPreparada,
): Promise<pg.QueryResult<FilaProyecto>> {
  const comunes = [
    proyectoId,
    version,
    esperado.fecha,
    esperado.cobrado,
    esperado.gastos,
    esperado.topeSueldo,
    esperado.topeFijos,
    esperado.diezmo,
    esperado.sueldo,
    esperado.fijos,
    esperado.remanente,
  ];
  return esperado.destino === 'cobrado'
    ? cliente.query<FilaProyecto>(
        `select ${COLUMNAS} from public.cobrar_proyecto($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) p`,
        comunes,
      )
    : cliente.query<FilaProyecto>(
        `select ${COLUMNAS} from public.cerrar_perdido($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) p`,
        [...comunes, esperado.diezmoBp],
      );
}

interface AjustesDeEscenario {
  sueldo: number;
  fijos: number;
  sueldoTopeMensual?: boolean;
  perdidoConSueldo?: boolean;
  perdidoConDiezmo?: boolean;
}

interface ProyectoDeEscenario {
  estado: EstadoProyecto;
  pagos: number[];
  gastos: number[];
}

type Paso =
  | { liquidar: EstadoLiquidado; proyecto: string; fecha: string }
  | { revertir: EstadoProyecto; proyecto: string }
  | { pago: number; proyecto: string }
  | { ajustes: { sueldo?: number; fijos?: number } };

export interface EscenarioDeLiquidacion {
  nombre: string;
  ajustes: AjustesDeEscenario;
  proyectos: Readonly<Record<string, ProyectoDeEscenario>>;
  pasos: Paso[];
}

function unCobro(
  nombre: string,
  pagos: number[],
  gastos: number[],
  sueldo: number,
  fijos: number,
): EscenarioDeLiquidacion {
  return {
    nombre,
    ajustes: { sueldo, fijos },
    proyectos: { p: { estado: 'entregado', pagos, gastos } },
    pasos: [{ liquidar: 'cobrado', proyecto: 'p', fecha: '2026-09-10' }],
  };
}

function entregado(...pagos: number[]): ProyectoDeEscenario {
  return { estado: 'entregado', pagos, gastos: [] };
}

export const ESCENARIOS_DE_LIQUIDACION: EscenarioDeLiquidacion[] = [
  unCobro('con pérdida', [10_000_000], [15_000_000], 180_000_000, 25_000_000),
  unCobro('sin pagos ni gastos', [], [], 180_000_000, 25_000_000),
  unCobro(
    'ganancia menor al sueldo',
    [40_000_000, 40_000_000, 44_000_000],
    [24_600_000, 5_800_000, 1_450_000, 980_000, 2_500_000],
    180_000_000,
    25_000_000,
  ),
  unCobro('sueldo cubierto y fijos a medias', [215_000_000], [], 180_000_000, 25_000_000),
  unCobro(
    'todo cubierto con remanente',
    [180_000_000, 150_000_000, 150_000_000],
    [82_000_000, 39_000_000, 31_000_000, 4_200_000, 8_800_000],
    180_000_000,
    25_000_000,
  ),
  unCobro('diezmo con medio centavo', [1_000_005], [], 50_000, 20_000),
  {
    nombre: 'dos cobros del mismo mes: el segundo toma lo que falta de los fijos; otro mes, no',
    ajustes: { sueldo: 50_000_000, fijos: 25_000_000 },
    proyectos: {
      p1: entregado(70_000_000),
      p2: { estado: 'entregado', pagos: [100_000_000], gastos: [5_000_000] },
      p3: entregado(100_000_000),
    },
    pasos: [
      { liquidar: 'cobrado', proyecto: 'p1', fecha: '2026-09-03' },
      { liquidar: 'cobrado', proyecto: 'p2', fecha: '2026-09-30' },
      { liquidar: 'cobrado', proyecto: 'p3', fecha: '2026-10-01' },
    ],
  },
  {
    nombre: 'sueldo con tope mensual',
    ajustes: { sueldo: 50_000_000, fijos: 25_000_000, sueldoTopeMensual: true },
    proyectos: { p1: entregado(40_000_000), p2: entregado(100_000_000), p3: entregado(30_000_000) },
    pasos: [
      { liquidar: 'cobrado', proyecto: 'p1', fecha: '2026-11-02' },
      { liquidar: 'cobrado', proyecto: 'p2', fecha: '2026-11-20' },
      { liquidar: 'cobrado', proyecto: 'p3', fecha: '2026-11-28' },
    ],
  },
  {
    nombre: 'reabrir un cobro del mes, cambiar los ajustes y volver a cobrarlo',
    ajustes: { sueldo: 50_000_000, fijos: 25_000_000 },
    proyectos: { p1: entregado(70_000_000), p2: entregado(100_000_000) },
    pasos: [
      { liquidar: 'cobrado', proyecto: 'p1', fecha: '2026-09-03' },
      { liquidar: 'cobrado', proyecto: 'p2', fecha: '2026-09-20' },
      { revertir: 'entregado', proyecto: 'p1' },
      { pago: 30_000_000, proyecto: 'p1' },
      { ajustes: { sueldo: 90_000_000, fijos: 99_000_000 } },
      { liquidar: 'cobrado', proyecto: 'p1', fecha: '2026-10-15' },
    ],
  },
  {
    nombre: 'perdidos con los parámetros por defecto: seña retenida, sin pagos y desde la obra',
    ajustes: { sueldo: 180_000_000, fijos: 25_000_000 },
    proyectos: {
      visita: { estado: 'relevamiento', pagos: [4_000_000], gastos: [800_000] },
      sinSena: { estado: 'contacto', pagos: [], gastos: [] },
      obra: { estado: 'en_curso', pagos: [100_000_000], gastos: [30_000_000] },
    },
    pasos: [
      { liquidar: 'perdido', proyecto: 'visita', fecha: '2026-09-05' },
      { liquidar: 'perdido', proyecto: 'sinSena', fecha: '2026-09-06' },
      { liquidar: 'perdido', proyecto: 'obra', fecha: '2026-09-07' },
    ],
  },
  {
    nombre: 'perdido con sueldo y sin diezmo, y un cobro después en el mismo mes',
    ajustes: {
      sueldo: 180_000_000,
      fijos: 25_000_000,
      perdidoConSueldo: true,
      perdidoConDiezmo: false,
    },
    proyectos: {
      obra: { estado: 'en_curso', pagos: [100_000_000], gastos: [30_000_000] },
      p: entregado(250_000_000),
    },
    pasos: [
      { liquidar: 'perdido', proyecto: 'obra', fecha: '2026-09-07' },
      { liquidar: 'cobrado', proyecto: 'p', fecha: '2026-09-08' },
    ],
  },
  {
    nombre: 'reactivar un perdido lo saca del mes, y volver a cerrarlo es otro evento',
    ajustes: { sueldo: 180_000_000, fijos: 25_000_000 },
    proyectos: {
      lead: { estado: 'presupuesto_enviado', pagos: [30_000_000], gastos: [] },
      p1: entregado(300_000_000),
      p2: entregado(300_000_000),
    },
    pasos: [
      { liquidar: 'perdido', proyecto: 'lead', fecha: '2026-09-02' },
      { liquidar: 'cobrado', proyecto: 'p1', fecha: '2026-09-10' },
      { revertir: 'contacto', proyecto: 'lead' },
      { liquidar: 'cobrado', proyecto: 'p2', fecha: '2026-09-20' },
      { liquidar: 'perdido', proyecto: 'lead', fecha: '2026-10-01' },
    ],
  },
];

interface Contexto {
  householdId: string;
  ids: Map<string, string>;
}

async function prepararEscenario(
  cliente: pg.Client,
  escenario: EscenarioDeLiquidacion,
): Promise<Contexto> {
  const { rows: usuario } = await cliente.query<{ id: string }>(
    `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
     values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
             'comparacion@maun.test', '', now(), now())
     returning id`,
  );
  const userId = usuario[0]?.id ?? '';
  const { rows: household } = await cliente.query<{ id: string }>(
    'select private.crear_household($1, $2) as id',
    ['Comparación', userId],
  );
  const householdId = household[0]?.id ?? '';
  const { ajustes } = escenario;
  await cliente.query(
    `update public.ajustes set
       sueldo_mensual_centavos = $2, costos_fijos_centavos = $3, sueldo_tope_mensual = $4,
       perdido_con_sueldo = $5, perdido_con_diezmo = $6
     where household_id = $1`,
    [
      householdId,
      ajustes.sueldo,
      ajustes.fijos,
      ajustes.sueldoTopeMensual ?? false,
      ajustes.perdidoConSueldo ?? false,
      ajustes.perdidoConDiezmo ?? true,
    ],
  );
  const { rows: clienteDelTaller } = await cliente.query<{ id: string }>(
    `insert into public.clientes (household_id, nombre) values ($1, 'Cliente') returning id`,
    [householdId],
  );
  const ids = new Map<string, string>();
  for (const [clave, proyecto] of Object.entries(escenario.proyectos)) {
    const { rows } = await cliente.query<{ id: string }>(
      `insert into public.proyectos (household_id, cliente_id, titulo, estado)
       values ($1, $2, $3, $4) returning id`,
      [householdId, clienteDelTaller[0]?.id, clave, proyecto.estado],
    );
    const proyectoId = rows[0]?.id ?? '';
    ids.set(clave, proyectoId);
    for (const [tabla, montos] of [
      ['pagos', proyecto.pagos],
      ['gastos', proyecto.gastos],
    ] as const) {
      for (const monto of montos) {
        await cliente.query(
          `insert into public.${tabla} (household_id, proyecto_id, fecha, monto_centavos) values ($1, $2, '2026-08-01', $3)`,
          [householdId, proyectoId, monto],
        );
      }
    }
  }

  await cliente.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ sub: userId, role: 'authenticated' }),
  ]);
  await cliente.query("select set_config('role', 'authenticated', true)");
  return { householdId, ids };
}

async function correrPaso(cliente: pg.Client, contexto: Contexto, paso: Paso): Promise<string[]> {
  if ('ajustes' in paso) {
    await cliente.query(
      `update public.ajustes set
         sueldo_mensual_centavos = coalesce($2, sueldo_mensual_centavos),
         costos_fijos_centavos = coalesce($3, costos_fijos_centavos)
       where household_id = $1`,
      [contexto.householdId, paso.ajustes.sueldo ?? null, paso.ajustes.fijos ?? null],
    );
    return [];
  }

  const proyectoId = contexto.ids.get(paso.proyecto) ?? '';

  if ('pago' in paso) {
    await cliente.query(
      `insert into public.pagos (proyecto_id, fecha, monto_centavos) values ($1, '2026-08-02', $2)`,
      [proyectoId, paso.pago],
    );
    return [];
  }

  if ('revertir' in paso) {
    const antes = await leerProyecto(cliente, proyectoId);
    const { rows } =
      antes.estado === 'cobrado'
        ? await cliente.query<FilaProyecto>(
            `select ${COLUMNAS} from public.reabrir_proyecto($1, $2) p`,
            [proyectoId, antes.version],
          )
        : await cliente.query<FilaProyecto>(
            `select ${COLUMNAS} from public.reactivar_perdido($1, $2, $3) p`,
            [proyectoId, antes.version, paso.revertir],
          );
    const enBase = rows[0] === undefined ? 'sin fila' : congelado(rows[0]);
    const esperado = esperadoAlRevertir(antes, paso.revertir);
    return enBase === esperado
      ? []
      : [`revertir ${paso.proyecto}: base ${enBase}, esperado ${esperado}`];
  }

  const preparada = await prepararLiquidacion(
    cliente,
    contexto.householdId,
    proyectoId,
    paso.liquidar,
    paso.fecha,
  );
  const { rows } = await liquidarPreparada(cliente, preparada);
  const enBase = rows[0] === undefined ? 'sin fila' : congelado(rows[0]);
  const enDominio = esperadoAlLiquidar(preparada.esperado);
  return enBase === enDominio
    ? []
    : [`${paso.liquidar} ${paso.proyecto}: base ${enBase}, dominio ${enDominio}`];
}

export async function compararLiquidaciones(cliente: pg.Client): Promise<string[]> {
  const diferencias: string[] = [];
  for (const escenario of ESCENARIOS_DE_LIQUIDACION) {
    await cliente.query('savepoint liquidacion');
    try {
      const contexto = await prepararEscenario(cliente, escenario);
      for (const paso of escenario.pasos) {
        const delPaso = await correrPaso(cliente, contexto, paso);
        diferencias.push(...delPaso.map((diferencia) => `"${escenario.nombre}", ${diferencia}`));
      }
    } catch (error) {
      diferencias.push(
        `"${escenario.nombre}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    await cliente.query('rollback to savepoint liquidacion');
  }
  return diferencias;
}

export async function compararSeed(cliente: pg.Client): Promise<string[]> {
  const filas = await leerProyectos(
    cliente,
    'p.household_id = $1 and p.fecha_cobro is not null order by p.dist_liquidado_at',
    [HOUSEHOLD_DEL_SEED],
  );
  if (filas.length === 0) {
    return ['el seed no tiene liquidaciones: cargalo con `pnpm --filter @maun/db db:seed`'];
  }
  const ajustes = await leerAjustes(cliente, HOUSEHOLD_DEL_SEED);
  const anteriores: LiquidacionRegistrada[] = [];
  const diferencias: string[] = [];
  for (const fila of filas) {
    const registro = registrada(fila);
    if (registro === null) {
      diferencias.push(`seed ${fila.id}: tiene fecha de liquidación y está ${fila.estado}`);
      continue;
    }
    const { cobrado, gastos } = await totales(cliente, fila.id);
    const esperado = calcularLiquidacion({
      destino: registro.estado,
      fecha: registro.fecha,
      cobrado: centavos(cobrado),
      gastos: centavos(gastos),
      ajustes,
      reapertura: null,
      liquidaciones: anteriores,
    });
    const enBase = congelado(fila);
    const enDominio = esperadoAlLiquidar(esperado);
    if (enBase !== enDominio)
      diferencias.push(`seed ${fila.id}: base ${enBase}, dominio ${enDominio}`);
    anteriores.push(registro);
  }
  return diferencias;
}

export async function compararDominioYSql(cliente: pg.Client): Promise<string[]> {
  return [
    ...(await compararCascada(cliente)),
    ...(await compararTopes(cliente)),
    ...(await compararRangos(cliente)),
    ...(await compararEstados(cliente)),
    ...(await compararTransiciones(cliente)),
    ...(await compararLiquidaciones(cliente)),
  ];
}
