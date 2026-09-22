import {
  asientosDelLibro,
  calcularDistribucion,
  calcularLiquidacion,
  centavos,
  DIEZMO,
  ESTADOS,
  esEstado,
  estaLiquidado,
  esLinkDeMercadoPago,
  esLinkDeResena,
  formasDeCobro,
  pagosPorDelante,
  puedeCambiarEstado,
  puedeLiquidar,
  puedeRevertir,
  puntosBasicos,
  saldosPorTesoro,
  TESOROS,
  topesDeLaLiquidacion,
  validarRespuesta,
  type AjustesDeLiquidacion,
  type Asiento,
  type Distribucion,
  type EntradaCascada,
  type EstadoLiquidado,
  type EstadoProyecto,
  type FormaDeCobro,
  type Liquidacion,
  type LiquidacionRegistrada,
  type PreguntaDeLaEncuesta,
  type Reapertura,
} from '@maun/domain';
import type pg from 'pg';

import type { Tesoro, TipoMovimiento } from '../src/enums.ts';
import { aplicarLote, leerLote, replicaVacia, type Replica } from '../src/replica.ts';
import { leerProyectoGuardado, type ProyectoGuardado } from '../src/sincronizacion.ts';
import { datosDelLibro, totalesDelProyecto } from '../src/vistas.ts';

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

type TuplaDelPago = [number | null, number, number];

const PAGOS_QUE_TOCAN: TuplaDelPago[] = [
  [null, 0, 5000],
  [null, 12345, 5000],
  [100_000_000, 0, 5000],
  [100_000_000, 1, 5000],
  [100_000_000, 49_999_999, 5000],
  [100_000_000, 50_000_000, 5000],
  [100_000_000, 50_000_001, 5000],
  [100_000_000, 99_999_999, 5000],
  [100_000_000, 100_000_000, 5000],
  [100_000_000, 100_000_001, 5000],
  [100_000_000, 0, 0],
  [100_000_000, 0, 10000],
  [100_000_000, 100_000_000, 10000],
  [0, 0, 5000],
  [1, 0, 5000],
  [1, 1, 5000],
  [3, 0, 3333],
  [7, 0, 1],
  [999, 0, 9999],
  [123_456_789, 7_654_321, 4321],
  [123_456_789, 61_728_395, 4321],
];

function pagosEnTs([precio, cobrado, bp]: TuplaDelPago): string {
  return JSON.stringify(
    pagosPorDelante({
      presupuesto: precio === null ? null : centavos(precio),
      cobrado: centavos(cobrado),
      porcentajeDelTaller: puntosBasicos(bp),
      porcentajeDelTrabajo: null,
    }),
  );
}

export async function compararPagosPorDelante(cliente: pg.Client): Promise<string[]> {
  const casos = PAGOS_QUE_TOCAN;
  const { rows } = await cliente.query<{ pagos: string | null }>(
    `select (
       select jsonb_agg(
         jsonb_build_object('instancia', r.instancia, 'monto', r.monto_centavos)
         order by r.orden
       )
       from private.pagos_por_delante(c.precio, c.cobrado, c.bp) as r
     )::text as pagos
     from unnest($1::bigint[], $2::bigint[], $3::int[])
       with ordinality as c (precio, cobrado, bp, orden)
     order by c.orden`,
    columnas(casos, 3),
  );
  if (rows.length !== casos.length) {
    return [
      `los pagos por delante de SQL devolvieron ${String(rows.length)} filas para ${String(casos.length)} casos`,
    ];
  }
  return rows.flatMap((fila, i) => {
    const caso = casos[i] ?? [null, 0, 0];
    const ts = pagosEnTs(caso);
    // jsonb ordena las claves por largo y después alfabéticamente, así que la comparación se hace
    // sobre objetos armados acá, no sobre el texto que devuelve Postgres.
    const crudos =
      fila.pagos === null ? [] : (JSON.parse(fila.pagos) as { instancia: string; monto: number }[]);
    const sql = JSON.stringify(
      crudos.map((pago) => ({ instancia: pago.instancia, monto: pago.monto })),
    );
    return ts === sql ? [] : [`pagos por delante ${JSON.stringify(caso)}: SQL ${sql}, TS ${ts}`];
  });
}

const FORMAS_GUARDADAS: (readonly FormaDeCobro[] | null)[] = [
  null,
  ['transferencia'],
  ['efectivo'],
  ['transferencia', 'efectivo'],
];

export async function compararFormasDeCobro(cliente: pg.Client): Promise<string[]> {
  const casos = FORMAS_GUARDADAS.flatMap((guardado) =>
    [true, false].map((hay) => [guardado, hay] as const),
  );
  const { rows } = await cliente.query<{ formas: string[] }>(
    `select private.formas_de_cobro(c.guardado::public.forma_de_cobro[], c.hay)::text[] as formas
     from unnest($1::text[], $2::boolean[]) with ordinality as c (guardado, hay, orden)
     order by c.orden`,
    [
      casos.map(([guardado]) => (guardado === null ? null : `{${guardado.join(',')}}`)),
      casos.map(([, hay]) => hay),
    ],
  );
  if (rows.length !== casos.length) {
    return [
      `las formas de cobro de SQL devolvieron ${String(rows.length)} filas para ${String(casos.length)} casos`,
    ];
  }
  return rows.flatMap((fila, i) => {
    const caso = casos[i] ?? [null, true];
    const ts = JSON.stringify(formasDeCobro(caso[0], caso[1]));
    const sql = JSON.stringify(fila.formas);
    return ts === sql ? [] : [`formas de cobro ${JSON.stringify(caso)}: SQL ${sql}, TS ${ts}`];
  });
}

const LINKS_A_PROBAR: readonly string[] = [
  '',
  'https://mpago.la/2vXyZ1',
  'https://mpago.li/2vXyZ1',
  'https://link.mercadopago.com.ar/tallermaun',
  'https://www.mercadopago.com.ar/cobrar/qr/1234',
  'https://mercadopago.com.ar/cobrar',
  'https://mpago.la/',
  'https://mpago.la',
  'http://mpago.la/2vXyZ1',
  'mpago.la/2vXyZ1',
  'https://MPAGO.LA/2vXyZ1',
  'https://pagame-aca.com/taller',
  'https://mercadopago.com.ar.pagame.net/x',
  'https://mpago.la.otro.com/x',
  'https://mpago.la/con espacio',
  'https://mpago.la/con\ttab',
  `https://mpago.la/${'x'.repeat(280)}`,
  `https://mpago.la/${'x'.repeat(300)}`,
];

export async function compararLinkDeCobro(cliente: pg.Client): Promise<string[]> {
  const { rows: definicion } = await cliente.query<{ def: string }>(
    `select pg_get_constraintdef(c.oid) as def
     from pg_constraint c
     where c.conrelid = 'public.ajustes'::regclass and c.conname = 'ajustes_cobro_link_formato'`,
  );
  const cruda = definicion[0]?.def;
  if (cruda === undefined) return ['no existe el check ajustes_cobro_link_formato en la base'];

  const expresion = cruda
    .replace(/^CHECK\s*\(/, '')
    .replace(/\)$/, '')
    .replaceAll('cobro_link', 'c.valor');

  const { rows } = await cliente.query<{ pasa: boolean }>(
    `select (${expresion}) as pasa
     from unnest($1::text[]) with ordinality as c (valor, orden)
     order by c.orden`,
    [LINKS_A_PROBAR],
  );
  if (rows.length !== LINKS_A_PROBAR.length) {
    return [
      `el check del link devolvió ${String(rows.length)} filas para ${String(LINKS_A_PROBAR.length)} casos`,
    ];
  }

  return rows.flatMap((fila, i) => {
    const valor = LINKS_A_PROBAR[i] ?? '';
    const ts = valor === '' || esLinkDeMercadoPago(valor);
    return ts === fila.pasa
      ? []
      : [`link de cobro ${JSON.stringify(valor)}: SQL ${String(fila.pasa)}, TS ${String(ts)}`];
  });
}

const RESENAS_A_PROBAR: readonly string[] = [
  '',
  'https://g.page/r/CaMaunTaller/review',
  'https://g.page/',
  'https://g.page',
  'https://search.google.com/local/writereview?placeid=ChIJ123',
  'https://maps.google.com/?cid=123',
  'https://www.google.com/maps/place/Taller',
  'https://google.com/maps',
  'https://maps.app.goo.gl/abc123',
  'https://g.co/kgs/abc',
  'http://g.page/r/x',
  'g.page/r/x',
  'https://G.PAGE/r/x',
  'https://resenas-truchas.com/maun',
  'https://g.page.otro.com/x',
  'https://g.co.ar/x',
  'https://g.page/con espacio',
  'https://g.page/con\ttab',
  `https://g.page/${'x'.repeat(285)}`,
  `https://g.page/${'x'.repeat(286)}`,
];

export async function compararLinkDeResena(cliente: pg.Client): Promise<string[]> {
  const { rows: definicion } = await cliente.query<{ def: string }>(
    `select pg_get_constraintdef(c.oid) as def
     from pg_constraint c
     where c.conrelid = 'public.ajustes'::regclass and c.conname = 'ajustes_resena_link_formato'`,
  );
  const cruda = definicion[0]?.def;
  if (cruda === undefined) return ['no existe el check ajustes_resena_link_formato en la base'];

  const expresion = cruda
    .replace(/^CHECK\s*\(/, '')
    .replace(/\)$/, '')
    .replaceAll('resena_link', 'c.valor');

  const { rows } = await cliente.query<{ pasa: boolean }>(
    `select (${expresion}) as pasa
     from unnest($1::text[]) with ordinality as c (valor, orden)
     order by c.orden`,
    [RESENAS_A_PROBAR],
  );
  if (rows.length !== RESENAS_A_PROBAR.length) {
    return [
      `el check del link de reseña devolvió ${String(rows.length)} filas para ${String(RESENAS_A_PROBAR.length)} casos`,
    ];
  }

  return rows.flatMap((fila, i) => {
    const valor = RESENAS_A_PROBAR[i] ?? '';
    const ts = valor === '' || esLinkDeResena(valor);
    return ts === fila.pasa
      ? []
      : [`link de reseña ${JSON.stringify(valor)}: SQL ${String(fila.pasa)}, TS ${String(ts)}`];
  });
}

const PREGUNTAS_A_VALIDAR: readonly PreguntaDeLaEncuesta[] = [
  {
    id: 'aaaaaaaa-0000-7000-8000-000000000001',
    texto: '¿Qué tan conforme quedaste con el mueble?',
    tipo: 'escala5',
    escala: 'conformidad',
    obligatoria: true,
    opciones: null,
    propia: false,
  },
  {
    id: 'aaaaaaaa-0000-7000-8000-000000000002',
    texto: '¿Se lo recomendarías a alguien?',
    tipo: 'sitalvezno',
    escala: null,
    obligatoria: true,
    opciones: null,
    propia: false,
  },
  {
    id: 'aaaaaaaa-0000-7000-8000-000000000003',
    texto: '¿Cómo nos conociste?',
    tipo: 'una',
    escala: null,
    obligatoria: false,
    opciones: ['Me lo recomendaron', 'Por Instagram', 'Vi el cartel'],
    propia: false,
  },
  {
    id: 'aaaaaaaa-0000-7000-8000-000000000004',
    texto: '¿Qué usás más?',
    tipo: 'varias',
    escala: null,
    obligatoria: false,
    opciones: ['El placard', 'La cómoda', 'El escritorio', 'La biblioteca'],
    propia: false,
  },
  {
    id: 'aaaaaaaa-0000-7000-8000-000000000005',
    texto: '¿Qué podríamos hacer mejor?',
    tipo: 'texto',
    escala: null,
    obligatoria: false,
    opciones: null,
    propia: false,
  },
  {
    id: 'aaaaaaaa-0000-7000-8000-000000000006',
    texto: '¿La altura te quedó cómoda?',
    tipo: 'escala5',
    escala: 'conformidad',
    obligatoria: false,
    opciones: null,
    propia: true,
  },
];

const ID_DE_RESPUESTA = '0192a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b';

function idDeLaPregunta(indice: number): string {
  return PREGUNTAS_A_VALIDAR[indice]?.id ?? '';
}

const VALORES_A_PROBAR: readonly unknown[] = [
  1,
  2,
  3,
  4,
  5,
  0,
  -1,
  6,
  2.5,
  5.0,
  1e2,
  '3',
  true,
  null,
  {},
  [],
  [0],
  [3],
  [4],
  [0, 0],
  [0, 2, 3],
  [1.5],
  ['1'],
  '',
  ' \t\n\r\f\v',
  String.fromCharCode(0xa0),
  'Quedó impecable.',
  '  Con blancos en las puntas.  \n',
  'a'.repeat(2000),
  `  ${'a'.repeat(2000)}\n`,
  'a'.repeat(2001),
  '👍'.repeat(2000),
  '👍'.repeat(2001),
];

function renglonDePrueba(indice: number, valor: unknown): unknown {
  return { pregunta: idDeLaPregunta(indice), valor };
}

function respuestasAValidar(): unknown[] {
  const fijas: unknown[] = [
    null,
    [],
    'respuesta',
    7,
    {},
    { id: ID_DE_RESPUESTA },
    { renglones: [] },
    { id: ID_DE_RESPUESTA, renglones: [], extra: true },
    { id: 7, renglones: [] },
    { id: 'no-es-un-id', renglones: [] },
    {
      id: ID_DE_RESPUESTA.toUpperCase(),
      renglones: [renglonDePrueba(0, 5), renglonDePrueba(1, 3)],
    },
    { id: ` ${ID_DE_RESPUESTA}`, renglones: [] },
    { id: ID_DE_RESPUESTA, renglones: {} },
    { id: ID_DE_RESPUESTA, renglones: 'renglones' },
    { id: ID_DE_RESPUESTA, renglones: [null] },
    { id: ID_DE_RESPUESTA, renglones: [[]] },
    { id: ID_DE_RESPUESTA, renglones: [{ pregunta: idDeLaPregunta(0) }] },
    { id: ID_DE_RESPUESTA, renglones: [{ valor: 5 }] },
    { id: ID_DE_RESPUESTA, renglones: [{ pregunta: idDeLaPregunta(0), valor: 5, extra: 1 }] },
    { id: ID_DE_RESPUESTA, renglones: [{ pregunta: 3, valor: 5 }] },
    { id: ID_DE_RESPUESTA, renglones: [{ pregunta: 'otra', valor: 5 }] },
    { id: ID_DE_RESPUESTA, renglones: [renglonDePrueba(0, 5), renglonDePrueba(0, 4)] },
    { id: ID_DE_RESPUESTA, renglones: [renglonDePrueba(0, 5)] },
    { id: ID_DE_RESPUESTA, renglones: [renglonDePrueba(1, 3), renglonDePrueba(0, 5)] },
    { id: ID_DE_RESPUESTA, renglones: [] },
  ];
  const conObligatorias = VALORES_A_PROBAR.flatMap((valor) =>
    [0, 1, 2, 3, 4, 5].map((indice) => ({
      id: ID_DE_RESPUESTA,
      renglones: [
        ...(indice === 0 ? [] : [renglonDePrueba(0, 5)]),
        ...(indice === 1 ? [] : [renglonDePrueba(1, 3)]),
        renglonDePrueba(indice, valor),
      ],
    })),
  );
  const siguiente = generador(20_260_921);
  const azar: unknown[] = [];
  for (let i = 0; i < 1_500; i++) {
    const renglones: unknown[] = [];
    const cuantos = siguiente(8);
    for (let j = 0; j < cuantos; j++) {
      const indice = siguiente(PREGUNTAS_A_VALIDAR.length + 1);
      const valor = VALORES_A_PROBAR[siguiente(VALORES_A_PROBAR.length)];
      renglones.push(
        indice === PREGUNTAS_A_VALIDAR.length
          ? { pregunta: 'aaaaaaaa-0000-7000-8000-00000000ffff', valor }
          : renglonDePrueba(indice, valor),
      );
    }
    azar.push({ id: ID_DE_RESPUESTA, renglones });
  }
  return [...fijas, ...conObligatorias, ...azar];
}

export async function compararValidacionDeRespuestas(cliente: pg.Client): Promise<string[]> {
  const respuestas = respuestasAValidar();
  const { rows } = await cliente.query<{ motivo: string | null }>(
    `select private.validar_respuesta($1::jsonb, c.respuesta) as motivo
     from unnest($2::jsonb[]) with ordinality as c (respuesta, orden)
     order by c.orden`,
    [JSON.stringify(PREGUNTAS_A_VALIDAR), respuestas.map((respuesta) => JSON.stringify(respuesta))],
  );
  if (rows.length !== respuestas.length) {
    return [
      `la validación de SQL devolvió ${String(rows.length)} filas para ${String(respuestas.length)} respuestas`,
    ];
  }
  return rows.flatMap((fila, i) => {
    const respuesta = respuestas[i];
    const ts = validarRespuesta(PREGUNTAS_A_VALIDAR, respuesta);
    return ts === fila.motivo
      ? []
      : [
          `respuesta ${JSON.stringify(respuesta).slice(0, 160)}: SQL ${String(fila.motivo)}, TS ${String(ts)}`,
        ];
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
    sueldoMensual: fila.sueldo_mensual === true,
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
  vista: Liquidacion;
}

export async function prepararLiquidacion(
  cliente: pg.Client,
  householdId: string,
  proyectoId: string,
  destino: EstadoLiquidado,
  fecha: string,
  sinVer: readonly string[] = [],
): Promise<LiquidacionPreparada> {
  const actual = await leerProyecto(cliente, proyectoId);
  const otras = await leerProyectos(
    cliente,
    'p.household_id = $1 and p.fecha_cobro is not null and p.deleted_at is null and p.id <> $2',
    [householdId, proyectoId],
  );
  const { cobrado, gastos } = await totales(cliente, proyectoId);
  const entrada = {
    destino,
    fecha,
    cobrado: centavos(cobrado),
    gastos: centavos(gastos),
    ajustes: await leerAjustes(cliente, householdId),
    reapertura: reaperturaDe(actual),
  };

  const deLasOtras = (filas: readonly FilaProyecto[]) =>
    filas.map(registrada).filter((liquidacion) => liquidacion !== null);

  const esperado = calcularLiquidacion({ ...entrada, liquidaciones: deLasOtras(otras) });
  const vista =
    sinVer.length === 0
      ? esperado
      : calcularLiquidacion({
          ...entrada,
          liquidaciones: deLasOtras(otras.filter((fila) => !sinVer.includes(fila.id))),
        });

  return { proyectoId, version: actual.version, esperado, vista };
}

export function liquidarPreparada(
  cliente: pg.Client,
  { proyectoId, version, vista }: LiquidacionPreparada,
): Promise<pg.QueryResult<FilaProyecto>> {
  const comunes = [
    proyectoId,
    version,
    vista.fecha,
    vista.cobrado,
    vista.gastos,
    vista.topeSueldo,
    vista.topeFijos,
    vista.diezmo,
    vista.sueldo,
    vista.fijos,
    vista.remanente,
  ];
  const acumulado = [vista.previo.sueldo, vista.previo.fijos];

  return vista.destino === 'cobrado'
    ? cliente.query<FilaProyecto>(
        `select ${COLUMNAS} from public.cobrar_proyecto($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) p`,
        [...comunes, ...acumulado],
      )
    : cliente.query<FilaProyecto>(
        `select ${COLUMNAS} from public.cerrar_perdido($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) p`,
        [...comunes, vista.diezmoBp, ...acumulado],
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
  borrado?: boolean;
  pagosBorrados?: number[];
  gastosBorrados?: number[];
}

interface MovimientoDeEscenario {
  tipo: TipoMovimiento;
  origen: Tesoro | null;
  destino: Tesoro | null;
  monto: number;
  fecha: string;
  categoria?: string;
  descripcion?: string;
  borrado?: boolean;
}

type Paso =
  | { liquidar: EstadoLiquidado; proyecto: string; fecha: string; sinVer?: string[] }
  | { revertir: EstadoProyecto; proyecto: string }
  | { pago: number; proyecto: string }
  | { ajustes: { sueldo?: number; fijos?: number } };

export interface EscenarioDeLiquidacion {
  nombre: string;
  ajustes: AjustesDeEscenario;
  proyectos: Readonly<Record<string, ProyectoDeEscenario>>;
  pasos: Paso[];
  movimientos?: MovimientoDeEscenario[];
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
  {
    nombre:
      'un estimativo que no avanzó se da por perdido, vuelve a estimativo y se cierra otra vez',
    ajustes: { sueldo: 180_000_000, fijos: 25_000_000 },
    proyectos: {
      estimativo: { estado: 'presupuesto_estimativo', pagos: [3_000_000], gastos: [500_000] },
      p1: entregado(200_000_000),
    },
    pasos: [
      { liquidar: 'perdido', proyecto: 'estimativo', fecha: '2026-09-15' },
      { liquidar: 'cobrado', proyecto: 'p1', fecha: '2026-09-16' },
      { revertir: 'presupuesto_estimativo', proyecto: 'estimativo' },
      { liquidar: 'perdido', proyecto: 'estimativo', fecha: '2026-10-02' },
    ],
  },
  {
    nombre: 'un cobro con el acumulado del mes viejo se ajusta, y lo congelado es lo del dominio',
    ajustes: { sueldo: 50_000_000, fijos: 25_000_000 },
    proyectos: {
      p1: entregado(70_000_000),
      p2: entregado(100_000_000),
      p3: entregado(100_000_000),
    },
    pasos: [
      { liquidar: 'cobrado', proyecto: 'p1', fecha: '2026-09-03' },
      { liquidar: 'cobrado', proyecto: 'p2', fecha: '2026-09-20', sinVer: ['p1'] },
      { liquidar: 'cobrado', proyecto: 'p3', fecha: '2026-09-25', sinVer: ['p1', 'p2'] },
    ],
  },
  {
    nombre: 'cerrar un perdido con el acumulado viejo también ajusta',
    ajustes: { sueldo: 50_000_000, fijos: 25_000_000 },
    proyectos: {
      p1: entregado(70_000_000),
      lead: { estado: 'presupuesto_enviado', pagos: [20_000_000], gastos: [] },
    },
    pasos: [
      { liquidar: 'cobrado', proyecto: 'p1', fecha: '2026-09-03' },
      { liquidar: 'perdido', proyecto: 'lead', fecha: '2026-09-29', sinVer: ['p1'] },
    ],
  },
  {
    nombre: 'con sueldo mensual, el acumulado viejo ajusta el sueldo y no lo duplica',
    ajustes: { sueldo: 50_000_000, fijos: 0, sueldoTopeMensual: true },
    proyectos: {
      p1: entregado(60_000_000),
      p2: entregado(100_000_000),
    },
    pasos: [
      { liquidar: 'cobrado', proyecto: 'p1', fecha: '2026-11-02' },
      { liquidar: 'cobrado', proyecto: 'p2', fecha: '2026-11-20', sinVer: ['p1'] },
    ],
  },
];

interface Contexto {
  householdId: string;
  usuarioId: string;
  clienteId: string;
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
    for (const [tabla, montos, borrado] of [
      ['pagos', proyecto.pagos, false],
      ['gastos', proyecto.gastos, false],
      ['pagos', proyecto.pagosBorrados ?? [], true],
      ['gastos', proyecto.gastosBorrados ?? [], true],
    ] as const) {
      for (const monto of montos) {
        await cliente.query(
          `insert into public.${tabla} (household_id, proyecto_id, fecha, monto_centavos, deleted_at)
           values ($1, $2, '2026-08-01', $3, $4)`,
          [householdId, proyectoId, monto, borrado ? '2026-08-15T00:00:00Z' : null],
        );
      }
    }
    if (proyecto.borrado === true) {
      await cliente.query(
        `update public.proyectos set deleted_at = '2026-08-20T00:00:00Z' where id = $1`,
        [proyectoId],
      );
    }
  }

  for (const movimiento of escenario.movimientos ?? []) {
    await cliente.query(
      `insert into public.movimientos
         (household_id, fecha, tipo, tesoro_origen, tesoro_destino, monto_centavos, categoria, descripcion, deleted_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        householdId,
        movimiento.fecha,
        movimiento.tipo,
        movimiento.origen,
        movimiento.destino,
        movimiento.monto,
        movimiento.categoria ?? '',
        movimiento.descripcion ?? '',
        movimiento.borrado === true ? '2026-08-25T00:00:00Z' : null,
      ],
    );
  }

  await cliente.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ sub: userId, role: 'authenticated' }),
  ]);
  await cliente.query("select set_config('role', 'authenticated', true)");
  return { householdId, usuarioId: userId, clienteId: clienteDelTaller[0]?.id ?? '', ids };
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
    (paso.sinVer ?? []).map((clave) => contexto.ids.get(clave) ?? ''),
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

interface FilaDelLibro {
  origen: string;
  asiento_id: string;
  fecha: string;
  tesoro: string;
  contrapartida: string | null;
  monto_centavos: string;
  concepto: string;
  categoria: string;
  descripcion: string;
  proyecto_id: string | null;
}

const COLUMNAS_DEL_LIBRO = `origen, asiento_id, fecha::text as fecha, tesoro::text as tesoro,
  contrapartida::text as contrapartida, monto_centavos::text as monto_centavos,
  concepto, categoria, descripcion, proyecto_id`;

function comoTextoSql(fila: FilaDelLibro): string {
  return JSON.stringify([
    fila.origen,
    fila.asiento_id,
    fila.fecha,
    fila.tesoro,
    fila.contrapartida,
    Number(fila.monto_centavos),
    fila.concepto,
    fila.categoria,
    fila.descripcion,
    fila.proyecto_id,
  ]);
}

function comoTextoTs(asiento: Asiento): string {
  return JSON.stringify([
    asiento.origen,
    asiento.asientoId,
    asiento.fecha,
    asiento.tesoro,
    asiento.contrapartida,
    asiento.monto,
    asiento.concepto,
    asiento.categoria,
    asiento.descripcion,
    asiento.proyectoId,
  ]);
}

function diferenciasDeMultiset(enSql: readonly string[], enTs: readonly string[]): string[] {
  const cuenta = new Map<string, number>();
  for (const fila of enSql) cuenta.set(fila, (cuenta.get(fila) ?? 0) + 1);
  for (const fila of enTs) cuenta.set(fila, (cuenta.get(fila) ?? 0) - 1);

  const diferencias: string[] = [];
  for (const [fila, saldo] of [...cuenta].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    if (saldo > 0) diferencias.push(`solo en SQL (${String(saldo)}x): ${fila}`);
    if (saldo < 0) diferencias.push(`solo en TS (${String(-saldo)}x): ${fila}`);
  }
  return diferencias;
}

async function replicaDeLaBase(cliente: pg.Client, usuarioId: string): Promise<Replica> {
  const { rows } = await cliente.query<{ lote: unknown }>('select public.bootstrap() as lote');
  return aplicarLote(replicaVacia(usuarioId), leerLote(rows[0]?.lote), 'reconcile', 0);
}

async function asientosDeLaReplica(cliente: pg.Client, usuarioId: string): Promise<Asiento[]> {
  return asientosDelLibro(datosDelLibro(await replicaDeLaBase(cliente, usuarioId)));
}

async function leerLibro(cliente: pg.Client, householdId: string): Promise<FilaDelLibro[]> {
  const { rows } = await cliente.query<FilaDelLibro>(
    `select ${COLUMNAS_DEL_LIBRO} from public.libro_mayor where household_id = $1`,
    [householdId],
  );
  return rows;
}

async function compararSaldos(
  cliente: pg.Client,
  householdId: string,
  asientos: readonly Asiento[],
): Promise<string[]> {
  const { rows } = await cliente.query<{ tesoro: string; saldo: string }>(
    `select t.tesoro::text as tesoro, coalesce(sum(l.monto_centavos), 0)::text as saldo
     from unnest(enum_range(null::public.tesoro)) as t (tesoro)
     left join public.libro_mayor l on l.tesoro = t.tesoro and l.household_id = $1
     group by t.tesoro`,
    [householdId],
  );
  const enTs = saldosPorTesoro(asientos);
  return TESOROS.flatMap((tesoro) => {
    const enSql = Number(rows.find((fila) => fila.tesoro === tesoro)?.saldo ?? NaN);
    return enSql === enTs[tesoro]
      ? []
      : [`saldo de ${tesoro}: SQL ${String(enSql)}, TS ${String(enTs[tesoro])}`];
  });
}

const MOVIMIENTOS_DE_TODOS_LOS_TIPOS: MovimientoDeEscenario[] = [
  {
    tipo: 'ingreso',
    origen: null,
    destino: 'hogar',
    monto: 12_000_000,
    fecha: '2026-09-01',
    categoria: 'Otros ingresos',
    descripcion: 'una changa',
  },
  {
    tipo: 'gasto',
    origen: 'hogar',
    destino: null,
    monto: 3_500_000,
    fecha: '2026-09-02',
    categoria: 'Supermercado',
  },
  {
    tipo: 'transferencia',
    origen: 'maun',
    destino: 'hogar',
    monto: 8_000_000,
    fecha: '2026-09-03',
  },
  { tipo: 'pago_diezmo', origen: 'diezmo', destino: null, monto: 2_400_000, fecha: '2026-09-04' },
  { tipo: 'aporte_cocos', origen: 'maun', destino: 'cocos', monto: 5_000_000, fecha: '2026-09-05' },
  { tipo: 'ajuste', origen: null, destino: 'cocos', monto: 900_000, fecha: '2026-09-06' },
  { tipo: 'ajuste', origen: 'cocos', destino: null, monto: 700_000, fecha: '2026-09-07' },
  {
    tipo: 'ingreso',
    origen: null,
    destino: 'maun',
    monto: 99_000_000,
    fecha: '2026-09-08',
    descripcion: 'borrado: no va al libro',
    borrado: true,
  },
  {
    tipo: 'transferencia',
    origen: 'hogar',
    destino: 'diezmo',
    monto: 77_000_000,
    fecha: '2026-09-09',
    descripcion: 'borrado de los dos lados',
    borrado: true,
  },
];

export const ESCENARIOS_DEL_LIBRO: EscenarioDeLiquidacion[] = [
  {
    nombre: 'los seis tipos de movimiento, con borrados que no tienen que aparecer',
    ajustes: { sueldo: 180_000_000, fijos: 25_000_000 },
    proyectos: {},
    pasos: [],
    movimientos: MOVIMIENTOS_DE_TODOS_LOS_TIPOS,
  },
  {
    nombre: 'un proyecto borrado se lleva sus pagos y sus gastos del libro',
    ajustes: { sueldo: 180_000_000, fijos: 25_000_000 },
    proyectos: {
      vivo: { estado: 'en_curso', pagos: [40_000_000, 10_000_000], gastos: [12_000_000] },
      muerto: { estado: 'en_curso', pagos: [90_000_000], gastos: [30_000_000], borrado: true },
      conFilasBorradas: {
        estado: 'en_curso',
        pagos: [20_000_000],
        gastos: [],
        pagosBorrados: [55_000_000],
        gastosBorrados: [44_000_000],
      },
    },
    pasos: [],
    movimientos: MOVIMIENTOS_DE_TODOS_LOS_TIPOS,
  },
  {
    nombre: 'el diezmo de un perdido mueve plata igual que el de un cobrado',
    ajustes: { sueldo: 180_000_000, fijos: 25_000_000 },
    proyectos: {
      cobrado: { estado: 'entregado', pagos: [300_000_000], gastos: [40_000_000] },
      perdido: { estado: 'presupuesto_enviado', pagos: [20_000_000], gastos: [1_500_000] },
      perdidoSinSena: { estado: 'contacto', pagos: [], gastos: [] },
    },
    pasos: [
      { liquidar: 'cobrado', proyecto: 'cobrado', fecha: '2026-09-10' },
      { liquidar: 'perdido', proyecto: 'perdido', fecha: '2026-09-11' },
      { liquidar: 'perdido', proyecto: 'perdidoSinSena', fecha: '2026-09-12' },
    ],
    movimientos: MOVIMIENTOS_DE_TODOS_LOS_TIPOS,
  },
  {
    nombre: 'un perdido con sueldo y sin diezmo, y un cobro con pérdida: los ceros no dan asiento',
    ajustes: {
      sueldo: 180_000_000,
      fijos: 25_000_000,
      perdidoConSueldo: true,
      perdidoConDiezmo: false,
    },
    proyectos: {
      lead: { estado: 'relevamiento', pagos: [6_000_000], gastos: [800_000] },
      enPerdida: { estado: 'entregado', pagos: [1_000_000], gastos: [9_000_000] },
    },
    pasos: [
      { liquidar: 'perdido', proyecto: 'lead', fecha: '2026-09-13' },
      { liquidar: 'cobrado', proyecto: 'enPerdida', fecha: '2026-09-14' },
    ],
  },
  {
    nombre: 'reabrir un cobro lo saca del libro y volver a cobrarlo lo devuelve',
    ajustes: { sueldo: 50_000_000, fijos: 25_000_000 },
    proyectos: { p: { estado: 'entregado', pagos: [120_000_000], gastos: [10_000_000] } },
    pasos: [
      { liquidar: 'cobrado', proyecto: 'p', fecha: '2026-09-15' },
      { revertir: 'entregado', proyecto: 'p' },
      { pago: 30_000_000, proyecto: 'p' },
      { liquidar: 'cobrado', proyecto: 'p', fecha: '2026-09-16' },
    ],
    movimientos: MOVIMIENTOS_DE_TODOS_LOS_TIPOS,
  },
];

export async function compararLibroMayor(cliente: pg.Client): Promise<string[]> {
  const diferencias: string[] = [];
  for (const escenario of [...ESCENARIOS_DEL_LIBRO, ...ESCENARIOS_DE_LIQUIDACION]) {
    await cliente.query('savepoint libro');
    try {
      const contexto = await prepararEscenario(cliente, escenario);
      for (const paso of escenario.pasos) await correrPaso(cliente, contexto, paso);
      const asientos = await asientosDeLaReplica(cliente, contexto.usuarioId);
      const filas = await leerLibro(cliente, contexto.householdId);
      const delEscenario = [
        ...diferenciasDeMultiset(filas.map(comoTextoSql), asientos.map(comoTextoTs)),
        ...(await compararSaldos(cliente, contexto.householdId, asientos)),
      ];
      diferencias.push(...delEscenario.map((linea) => `"${escenario.nombre}", ${linea}`));
    } catch (error) {
      diferencias.push(
        `"${escenario.nombre}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    await cliente.query('rollback to savepoint libro');
  }
  return diferencias;
}

export async function compararLibroDelSeed(cliente: pg.Client): Promise<string[]> {
  const filas = await leerLibro(cliente, HOUSEHOLD_DEL_SEED);
  if (filas.length === 0) {
    return ['el seed no tiene asientos: cargalo con `pnpm --filter @maun/db db:seed`'];
  }

  await cliente.query('savepoint libro_del_seed');
  const { rows: usuario } = await cliente.query<{ id: string }>(
    `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
     values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
             'libro-del-seed@maun.test', '', now(), now())
     returning id`,
  );
  const usuarioId = usuario[0]?.id ?? '';
  await cliente.query(
    `insert into public.household_members (household_id, user_id, rol) values ($1, $2, 'titular')`,
    [HOUSEHOLD_DEL_SEED, usuarioId],
  );

  await cliente.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ sub: usuarioId, role: 'authenticated' }),
  ]);
  await cliente.query("select set_config('role', 'authenticated', true)");
  const asientos = await asientosDeLaReplica(cliente, usuarioId);
  const saldos = await compararSaldos(cliente, HOUSEHOLD_DEL_SEED, asientos);
  await cliente.query('rollback to savepoint libro_del_seed');

  return [
    ...diferenciasDeMultiset(filas.map(comoTextoSql), asientos.map(comoTextoTs)),
    ...saldos,
  ].map((linea) => `libro del seed, ${linea}`);
}

export interface PasoDeGuardado {
  titulo: string;
  estado: EstadoProyecto;
  pagos: readonly (readonly [string, number, boolean?])[];
  gastos: readonly (readonly [string, number, boolean?])[];
}

export interface EscenarioDeGuardado {
  nombre: string;
  pasos: readonly PasoDeGuardado[];
}

export const ESCENARIOS_DE_GUARDADO: EscenarioDeGuardado[] = [
  {
    nombre: 'el alta con dos pagos y dos gastos, en una sola llamada',
    pasos: [
      {
        titulo: 'Placard',
        estado: 'en_curso',
        pagos: [
          ['sena', 40_000_000],
          ['adelanto', 20_000_000],
        ],
        gastos: [
          ['melamina', 30_000_000],
          ['herrajes', 5_000_000],
        ],
      },
    ],
  },
  {
    nombre: 'editar sacando un pago y agregando un gasto',
    pasos: [
      {
        titulo: 'Vanitory',
        estado: 'en_curso',
        pagos: [
          ['sena', 40_000_000],
          ['adelanto', 20_000_000],
        ],
        gastos: [['guayubira', 30_000_000]],
      },
      {
        titulo: 'Vanitory colgante',
        estado: 'entregado',
        pagos: [
          ['sena', 40_000_000],
          ['adelanto', 20_000_000, true],
        ],
        gastos: [
          ['guayubira', 30_000_000],
          ['flete', 8_000_000],
        ],
      },
    ],
  },
  {
    nombre: 'un proyecto que nace sin pagos ni gastos y después los suma',
    pasos: [
      { titulo: 'Biblioteca', estado: 'en_curso', pagos: [], gastos: [] },
      {
        titulo: 'Biblioteca',
        estado: 'en_curso',
        pagos: [['sena', 15_000_000]],
        gastos: [['mdf', 3_000_000]],
      },
    ],
  },
  {
    nombre: 'corregirle el monto a un pago ya guardado y sacar todos los gastos',
    pasos: [
      {
        titulo: 'Escritorio',
        estado: 'en_curso',
        pagos: [['sena', 12_000_000]],
        gastos: [
          ['tablero', 4_000_000],
          ['pasacables', 500_000],
        ],
      },
      {
        titulo: 'Escritorio',
        estado: 'en_curso',
        pagos: [['sena', 18_500_000]],
        gastos: [
          ['tablero', 4_000_000, true],
          ['pasacables', 500_000, true],
        ],
      },
    ],
  },
];

function idDelEscenario(clave: string, ids: Map<string, string>): string {
  const existente = ids.get(clave);
  if (existente !== undefined) return existente;
  const nuevo = `11111111-0000-7000-8000-${String(ids.size + 1).padStart(12, '0')}`;
  ids.set(clave, nuevo);
  return nuevo;
}

async function guardarPorRpc(
  cliente: pg.Client,
  contexto: Contexto,
  proyectoId: string,
  version: number | null,
  paso: PasoDeGuardado,
): Promise<ProyectoGuardado> {
  const hija = ([clave, monto, borrado]: readonly [string, number, boolean?]) => ({
    id: idDelEscenario(clave, contexto.ids),
    fecha: '2026-08-01',
    monto_centavos: monto,
    borrado: borrado === true,
  });

  const { rows } = await cliente.query<{ agregado: unknown }>(
    'select public.guardar_proyecto($1::jsonb, $2::jsonb, $3::jsonb) as agregado',
    [
      JSON.stringify({
        id: proyectoId,
        version,
        cliente_id: contexto.clienteId,
        titulo: paso.titulo,
        descripcion: '',
        estado: paso.estado,
        presupuesto_centavos: 120_000_000,
        forma_pago: 'transferencia',
        comprobante: 'remito',
        fecha_visita: null,
        ultimo_contacto: null,
        fecha_inicio: '2026-08-01',
        entrega_estimada: '2026-08-31',
        fecha_entrega: null,
        direccion_entrega: 'Olazábal 1240',
        notas: '',
      }),
      JSON.stringify(paso.pagos.map((pago) => ({ ...hija(pago), concepto: 'Seña' }))),
      JSON.stringify(paso.gastos.map((gasto) => ({ ...hija(gasto), descripcion: 'Insumo' }))),
    ],
  );
  return leerProyectoGuardado(rows[0]?.agregado);
}

async function idsVivos(cliente: pg.Client, tabla: string, proyectoId: string): Promise<string[]> {
  const { rows } = await cliente.query<{ id: string }>(
    `select id from public.${tabla} where proyecto_id = $1 and deleted_at is null order by id`,
    [proyectoId],
  );
  return rows.map((fila) => fila.id);
}

async function compararRespuesta(
  cliente: pg.Client,
  proyectoId: string,
  guardado: ProyectoGuardado,
): Promise<string[]> {
  const diferencias: string[] = [];
  for (const [tabla, filas] of [
    ['pagos', guardado.pagos],
    ['gastos', guardado.gastos],
  ] as const) {
    const enSql = JSON.stringify(await idsVivos(cliente, tabla, proyectoId));
    const devueltos = JSON.stringify(
      filas
        .filter((fila) => fila.deleted_at === null)
        .map((fila) => fila.id)
        .sort(),
    );
    if (enSql !== devueltos) {
      diferencias.push(`${tabla} vivos: la base tiene ${enSql}, la respuesta trae ${devueltos}`);
    }
  }
  return diferencias;
}

async function compararTotalesDelProyecto(
  cliente: pg.Client,
  contexto: Contexto,
  proyectoId: string,
): Promise<string[]> {
  const enSql = await totales(cliente, proyectoId);
  const enTs = totalesDelProyecto(await replicaDeLaBase(cliente, contexto.usuarioId), proyectoId);
  const diferencias: string[] = [];
  if (enTs.cobrado !== enSql.cobrado) {
    diferencias.push(`cobrado: SQL ${String(enSql.cobrado)}, TS ${String(enTs.cobrado)}`);
  }
  if (enTs.gastos !== enSql.gastos) {
    diferencias.push(`gastos: SQL ${String(enSql.gastos)}, TS ${String(enTs.gastos)}`);
  }
  return diferencias;
}

export async function compararGuardadoDeProyecto(cliente: pg.Client): Promise<string[]> {
  const diferencias: string[] = [];
  for (const escenario of ESCENARIOS_DE_GUARDADO) {
    await cliente.query('savepoint guardado');
    try {
      const contexto = await prepararEscenario(cliente, {
        nombre: escenario.nombre,
        ajustes: { sueldo: 180_000_000, fijos: 25_000_000 },
        proyectos: {},
        pasos: [],
      });
      const proyectoId = idDelEscenario('proyecto', contexto.ids);
      let version: number | null = null;

      for (const paso of escenario.pasos) {
        const guardado = await guardarPorRpc(cliente, contexto, proyectoId, version, paso);
        version = guardado.proyecto.version;
        diferencias.push(
          ...(await compararRespuesta(cliente, proyectoId, guardado)).map(
            (linea) => `"${escenario.nombre}", ${linea}`,
          ),
        );
      }

      const asientos = await asientosDeLaReplica(cliente, contexto.usuarioId);
      const filas = await leerLibro(cliente, contexto.householdId);
      const delEscenario = [
        ...(await compararTotalesDelProyecto(cliente, contexto, proyectoId)),
        ...diferenciasDeMultiset(filas.map(comoTextoSql), asientos.map(comoTextoTs)),
        ...(await compararSaldos(cliente, contexto.householdId, asientos)),
      ];
      diferencias.push(...delEscenario.map((linea) => `"${escenario.nombre}", ${linea}`));
    } catch (error) {
      diferencias.push(
        `"${escenario.nombre}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    await cliente.query('rollback to savepoint guardado');
  }
  return diferencias;
}

export async function compararDominioYSql(cliente: pg.Client): Promise<string[]> {
  return [
    ...(await compararCascada(cliente)),
    ...(await compararTopes(cliente)),
    ...(await compararPagosPorDelante(cliente)),
    ...(await compararFormasDeCobro(cliente)),
    ...(await compararLinkDeCobro(cliente)),
    ...(await compararLinkDeResena(cliente)),
    ...(await compararValidacionDeRespuestas(cliente)),
    ...(await compararRangos(cliente)),
    ...(await compararEstados(cliente)),
    ...(await compararTransiciones(cliente)),
    ...(await compararLiquidaciones(cliente)),
    ...(await compararLibroMayor(cliente)),
    ...(await compararGuardadoDeProyecto(cliente)),
  ];
}
