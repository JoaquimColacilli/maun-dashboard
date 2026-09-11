import {
  calcularDistribucion,
  centavos,
  DIEZMO,
  ESTADOS,
  puedeCambiarEstado,
  puntosBasicos,
  type Distribucion,
  type EntradaCascada,
} from '@maun/domain';
import type pg from 'pg';

type Tupla = [number, number, number, number, number];

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

const CASOS_FUERA_DE_RANGO: Tupla[] = [
  [9_007_199_254_736, 0, 1_000, 0, 0],
  [Number.MAX_SAFE_INTEGER, 1, 1, 0, 0],
  [Number.MAX_SAFE_INTEGER, 0, 0, 0, 0],
  [9_007_199_254_735, 0, 1_000, 0, 0],
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

export async function compararCascada(cliente: pg.Client): Promise<string[]> {
  const casos = casosDeCascada();
  const { rows } = await cliente.query<FilaCascada & { orden: string }>(
    `select c.orden, r.*
     from unnest($1::bigint[], $2::bigint[], $3::int[], $4::bigint[], $5::bigint[])
       with ordinality as c (cobrado, gastos, diezmo_bp, tope_sueldo, tope_fijos, orden)
     cross join lateral private.cascada(c.cobrado, c.gastos, c.diezmo_bp, c.tope_sueldo, c.tope_fijos) as r
     order by c.orden`,
    [0, 1, 2, 3, 4].map((columna) => casos.map((caso) => caso[columna])),
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

export async function compararRangos(cliente: pg.Client): Promise<string[]> {
  const diferencias: string[] = [];
  for (const caso of CASOS_FUERA_DE_RANGO) {
    let tsRechaza = false;
    try {
      calcularDistribucion(entrada(caso));
    } catch {
      tsRechaza = true;
    }
    let sqlRechaza = false;
    await cliente.query('savepoint rango');
    try {
      await cliente.query('select * from private.cascada($1, $2, $3, $4, $5)', caso);
    } catch {
      sqlRechaza = true;
    }
    await cliente.query('rollback to savepoint rango');
    if (tsRechaza !== sqlRechaza) {
      diferencias.push(
        `rango ${JSON.stringify(caso)}: TS ${tsRechaza ? 'rechaza' : 'acepta'}, SQL ${sqlRechaza ? 'rechaza' : 'acepta'}`,
      );
    }
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
  const { rows } = await cliente.query<{ desde: string; hasta: string; valida: boolean }>(
    `select d.estado as desde, h.estado as hasta,
            private.transicion_valida(d.estado::public.estado_proyecto, h.estado::public.estado_proyecto) as valida
     from unnest($1::text[]) as d (estado)
     cross join unnest($1::text[]) as h (estado)`,
    [[...ESTADOS]],
  );
  if (rows.length !== ESTADOS.length ** 2) return [`transiciones: ${String(rows.length)} filas`];
  return rows.flatMap((fila) => {
    const desde = ESTADOS.find((estado) => estado === fila.desde);
    const hasta = ESTADOS.find((estado) => estado === fila.hasta);
    if (desde === undefined || hasta === undefined)
      return [`transición desconocida ${fila.desde} → ${fila.hasta}`];
    return puedeCambiarEstado(desde, hasta) === fila.valida
      ? []
      : [`transición ${desde} → ${hasta}: SQL ${String(fila.valida)}, TS ${String(!fila.valida)}`];
  });
}

interface Escenario {
  nombre: string;
  pagos: number[];
  gastos: number[];
  topeSueldo: number;
  topeFijos: number;
}

export const ESCENARIOS_DE_COBRO: Escenario[] = [
  {
    nombre: 'con pérdida',
    pagos: [10_000_000],
    gastos: [15_000_000],
    topeSueldo: 180_000_000,
    topeFijos: 25_000_000,
  },
  {
    nombre: 'sin pagos ni gastos',
    pagos: [],
    gastos: [],
    topeSueldo: 180_000_000,
    topeFijos: 25_000_000,
  },
  {
    nombre: 'ganancia menor al sueldo',
    pagos: [40_000_000, 40_000_000, 44_000_000],
    gastos: [24_600_000, 5_800_000, 1_450_000, 980_000, 2_500_000],
    topeSueldo: 180_000_000,
    topeFijos: 25_000_000,
  },
  {
    nombre: 'sueldo cubierto y fijos a medias',
    pagos: [215_000_000],
    gastos: [],
    topeSueldo: 180_000_000,
    topeFijos: 25_000_000,
  },
  {
    nombre: 'todo cubierto con remanente',
    pagos: [180_000_000, 150_000_000, 150_000_000],
    gastos: [82_000_000, 39_000_000, 31_000_000, 4_200_000, 8_800_000],
    topeSueldo: 180_000_000,
    topeFijos: 25_000_000,
  },
  {
    nombre: 'diezmo con medio centavo',
    pagos: [1_000_005],
    gastos: [],
    topeSueldo: 50_000,
    topeFijos: 20_000,
  },
];

interface ProyectoCongelado {
  estado: string;
  dist_cobrado_centavos: string;
  dist_gastos_centavos: string;
  dist_diezmo_bp: number;
  dist_tope_sueldo_centavos: string;
  dist_tope_fijos_centavos: string;
  dist_diezmo_centavos: string;
  dist_sueldo_centavos: string;
  dist_fijos_centavos: string;
  dist_remanente_centavos: string;
}

function suma(importes: number[]): number {
  return importes.reduce((total, importe) => total + importe, 0);
}

async function cobrarEscenario(
  cliente: pg.Client,
  escenario: Escenario,
): Promise<ProyectoCongelado | undefined> {
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
  await cliente.query(
    'update public.ajustes set sueldo_mensual_centavos = $2, costos_fijos_centavos = $3 where household_id = $1',
    [householdId, escenario.topeSueldo, escenario.topeFijos],
  );
  const { rows: proyecto } = await cliente.query<{ id: string; version: number }>(
    `with c as (insert into public.clientes (household_id, nombre) values ($1, 'Cliente') returning id)
     insert into public.proyectos (household_id, cliente_id, titulo, estado)
     select $1, c.id, 'Proyecto', 'entregado' from c
     returning id, version`,
    [householdId],
  );
  const proyectoId = proyecto[0]?.id ?? '';
  for (const [tabla, montos] of [
    ['pagos', escenario.pagos],
    ['gastos', escenario.gastos],
  ] as const) {
    for (const monto of montos) {
      await cliente.query(
        `insert into public.${tabla} (household_id, proyecto_id, fecha, monto_centavos) values ($1, $2, '2026-09-01', $3)`,
        [householdId, proyectoId, monto],
      );
    }
  }

  const esperado = calcularDistribucion(
    entrada([
      suma(escenario.pagos),
      suma(escenario.gastos),
      DIEZMO,
      escenario.topeSueldo,
      escenario.topeFijos,
    ]),
  );

  await cliente.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ sub: userId, role: 'authenticated' }),
  ]);
  await cliente.query("select set_config('role', 'authenticated', true)");

  const { rows } = await cliente.query<ProyectoCongelado>(
    'select * from public.cobrar_proyecto($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
    [
      proyectoId,
      proyecto[0]?.version,
      '2026-09-10',
      esperado.cobrado,
      esperado.gastos,
      esperado.topeSueldo,
      esperado.topeFijos,
      esperado.diezmo,
      esperado.sueldo,
      esperado.fijos,
      esperado.remanente,
    ],
  );
  return rows[0];
}

export async function compararCobros(cliente: pg.Client): Promise<string[]> {
  const diferencias: string[] = [];
  for (const escenario of ESCENARIOS_DE_COBRO) {
    await cliente.query('savepoint cobro');
    try {
      const congelado = await cobrarEscenario(cliente, escenario);
      const esperado = calcularDistribucion(
        entrada([
          suma(escenario.pagos),
          suma(escenario.gastos),
          DIEZMO,
          escenario.topeSueldo,
          escenario.topeFijos,
        ]),
      );
      const enBase = JSON.stringify([
        congelado?.estado,
        Number(congelado?.dist_cobrado_centavos),
        Number(congelado?.dist_gastos_centavos),
        congelado?.dist_diezmo_bp,
        Number(congelado?.dist_tope_sueldo_centavos),
        Number(congelado?.dist_tope_fijos_centavos),
        Number(congelado?.dist_diezmo_centavos),
        Number(congelado?.dist_sueldo_centavos),
        Number(congelado?.dist_fijos_centavos),
        Number(congelado?.dist_remanente_centavos),
      ]);
      const enDominio = JSON.stringify([
        'cobrado',
        esperado.cobrado,
        esperado.gastos,
        esperado.diezmoBp,
        esperado.topeSueldo,
        esperado.topeFijos,
        esperado.diezmo,
        esperado.sueldo,
        esperado.fijos,
        esperado.remanente,
      ]);
      if (enBase !== enDominio)
        diferencias.push(`cobro "${escenario.nombre}": base ${enBase}, dominio ${enDominio}`);
    } catch (error) {
      diferencias.push(
        `cobro "${escenario.nombre}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    await cliente.query('rollback to savepoint cobro');
  }
  return diferencias;
}

export async function compararDominioYSql(cliente: pg.Client): Promise<string[]> {
  return [
    ...(await compararCascada(cliente)),
    ...(await compararRangos(cliente)),
    ...(await compararEstados(cliente)),
    ...(await compararTransiciones(cliente)),
    ...(await compararCobros(cliente)),
  ];
}
