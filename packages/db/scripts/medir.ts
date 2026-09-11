import { gzipSync } from 'node:zlib';

import type pg from 'pg';

import { enTransaccionConRollback } from './pgtap.ts';

interface Medicion {
  filas: number;
  saldosMs: number;
  bootstrapMs: number;
  bootstrapBytes: number;
  bootstrapGzipBytes: number;
}

async function tiempoDeEjecucion(cliente: pg.Client, sql: string): Promise<number> {
  const { rows } = await cliente.query<{ 'QUERY PLAN': [{ 'Execution Time': number }] }>(
    `explain (analyze, format json) ${sql}`,
  );
  return rows[0]?.['QUERY PLAN'][0]['Execution Time'] ?? Number.NaN;
}

async function sembrar(cliente: pg.Client, filas: number): Promise<string> {
  const proyectos = Math.round((filas * 0.4) / 10);
  const movimientos = filas - proyectos * 10;

  const { rows: usuario } = await cliente.query<{ id: string }>(
    `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
     values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
             'medicion@maun.test', '', now(), now())
     returning id`,
  );
  const userId = usuario[0]?.id;
  if (!userId) throw new Error('No se pudo crear el usuario de medición');

  const { rows: household } = await cliente.query<{ id: string }>(
    'select private.crear_household($1, $2) as id',
    ['Medición', userId],
  );
  const householdId = household[0]?.id;
  if (!householdId) throw new Error('No se pudo crear el household de medición');

  await cliente.query(
    `insert into public.clientes (household_id, nombre)
     select $1, 'Cliente ' || g from generate_series(1, 500) g`,
    [householdId],
  );
  await cliente.query(
    `insert into public.proyectos (household_id, cliente_id, titulo, estado)
     select $1, c.ids[1 + g % 500], 'Proyecto ' || g, 'entregado'
     from generate_series(1, $2::int) g,
          (select array_agg(id) as ids from public.clientes where household_id = $1) c`,
    [householdId, proyectos],
  );
  await cliente.query(
    `insert into public.pagos (household_id, proyecto_id, fecha, monto_centavos)
     select $1, p.id, date '2016-01-01' + (random() * 3650)::int, 100000 + (random() * 100000000)::bigint
     from public.proyectos p cross join generate_series(1, 5)
     where p.household_id = $1`,
    [householdId],
  );
  await cliente.query(
    `insert into public.gastos (household_id, proyecto_id, fecha, monto_centavos)
     select $1, p.id, date '2016-01-01' + (random() * 3650)::int, 100000 + (random() * 50000000)::bigint
     from public.proyectos p cross join generate_series(1, 5)
     where p.household_id = $1`,
    [householdId],
  );
  await cliente.query(
    `insert into public.movimientos (household_id, fecha, tipo, tesoro_origen, tesoro_destino, monto_centavos, categoria)
     select $1, date '2016-01-01' + (random() * 3650)::int,
            (array['gasto', 'ingreso', 'transferencia'])[1 + g % 3]::public.tipo_movimiento,
            case g % 3 when 0 then 'hogar'::public.tesoro when 1 then null else 'maun'::public.tesoro end,
            case g % 3 when 0 then null when 1 then 'hogar'::public.tesoro else 'cocos'::public.tesoro end,
            1000 + (random() * 10000000)::bigint, 'Medición'
     from generate_series(1, $2::int) g`,
    [householdId, movimientos],
  );
  await cliente.query(
    `update public.proyectos p set
       estado = 'cobrado', fecha_cobro = date '2026-01-01',
       dist_cobrado_centavos = s.cobrado, dist_gastos_centavos = s.gastos, dist_diezmo_bp = 1000,
       dist_tope_sueldo_centavos = 0, dist_tope_fijos_centavos = 0,
       dist_diezmo_centavos = greatest(0, (s.cobrado - s.gastos) / 10),
       dist_sueldo_centavos = 0, dist_fijos_centavos = 0,
       dist_remanente_centavos = (s.cobrado - s.gastos) - greatest(0, (s.cobrado - s.gastos) / 10),
       dist_objetivo_sueldo_centavos = 0, dist_objetivo_fijos_centavos = 0, dist_sueldo_mensual = false,
       dist_sueldo_previo_centavos = 0, dist_fijos_previo_centavos = 0, dist_liquidado_at = now()
     from (
       select pr.id,
              (select sum(monto_centavos)::bigint from public.pagos where proyecto_id = pr.id) as cobrado,
              (select sum(monto_centavos)::bigint from public.gastos where proyecto_id = pr.id) as gastos
       from public.proyectos pr
       where pr.household_id = $1
     ) s
     where p.id = s.id and hashtext(p.id::text) % 2 = 0`,
    [householdId],
  );
  await cliente.query(
    'analyze public.clientes, public.proyectos, public.pagos, public.gastos, public.movimientos',
  );
  return userId;
}

async function medir(cliente: pg.Client, filas: number): Promise<Medicion> {
  await cliente.query('savepoint medicion');
  try {
    const userId = await sembrar(cliente, filas);
    await cliente.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: userId, role: 'authenticated' }),
    ]);
    await cliente.query("select set_config('role', 'authenticated', true)");

    const saldosMs = await tiempoDeEjecucion(
      cliente,
      'select tesoro, sum(monto_centavos) from public.libro_mayor group by tesoro',
    );
    const bootstrapMs = await tiempoDeEjecucion(cliente, 'select public.bootstrap()');
    const { rows } = await cliente.query<{ json: string }>(
      'select public.bootstrap()::text as json',
    );
    const json = rows[0]?.json ?? '';
    return {
      filas,
      saldosMs,
      bootstrapMs,
      bootstrapBytes: Buffer.byteLength(json),
      bootstrapGzipBytes: gzipSync(json).length,
    };
  } finally {
    await cliente.query('rollback to savepoint medicion');
  }
}

const escalas = process.argv
  .slice(2)
  .map(Number)
  .filter((n) => Number.isInteger(n) && n > 0);

const mediciones = await enTransaccionConRollback(async (cliente) => {
  const resultado: Medicion[] = [];
  for (const filas of escalas.length > 0 ? escalas : [2_400, 24_000, 100_000]) {
    resultado.push(await medir(cliente, filas));
  }
  return resultado;
});

console.log(
  'Filas del libro | saldos (ms en la base) | bootstrap (ms en la base) | bootstrap (KB) | con gzip (KB)',
);
for (const m of mediciones) {
  console.log(
    [
      String(m.filas).padStart(15),
      m.saldosMs.toFixed(1).padStart(22),
      m.bootstrapMs.toFixed(1).padStart(25),
      (m.bootstrapBytes / 1024).toFixed(0).padStart(14),
      (m.bootstrapGzipBytes / 1024).toFixed(0).padStart(13),
    ].join(' | '),
  );
}
console.log('Nada quedó en la base: todo corrió en una transacción que terminó en rollback.');
