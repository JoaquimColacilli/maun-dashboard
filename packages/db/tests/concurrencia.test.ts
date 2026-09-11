import { calcularDistribucion, centavos, DIEZMO, type Distribucion } from '@maun/domain';
import type pg from 'pg';
import { afterEach, describe, expect, it } from 'vitest';

import { conectar } from '../scripts/conexion.ts';

const HOUSEHOLD_DEL_SEED = '5eed0000-0000-7000-8000-000000000001';
const PROYECTO_DEL_SEED = '5eed0000-0000-7000-8000-000000020002';
const PAGO_DEL_SEED = '5eed0000-0000-7000-8000-000000030004';

const abiertas: pg.Client[] = [];
const pendientes: Promise<unknown>[] = [];

async function sesion(): Promise<pg.Client> {
  const cliente = await conectar();
  abiertas.push(cliente);
  return cliente;
}

function sinRechazoSuelto<T>(promesa: Promise<T>): Promise<T> {
  pendientes.push(promesa.catch(() => undefined));
  return promesa;
}

afterEach(async () => {
  const clientes = abiertas.splice(0);
  await Promise.allSettled(clientes.map((cliente) => cliente.query('rollback')));
  await Promise.allSettled(pendientes.splice(0));
  await Promise.allSettled(clientes.map((cliente) => cliente.end()));
});

async function pidDe(cliente: pg.Client): Promise<number> {
  const { rows } = await cliente.query<{ pid: number }>('select pg_backend_pid() as pid');
  return rows[0]?.pid ?? -1;
}

async function esperarQueEspere(monitor: pg.Client, pid: number): Promise<number[]> {
  for (let intento = 0; intento < 100; intento++) {
    const { rows } = await monitor.query<{ bloqueantes: number[] }>(
      'select pg_blocking_pids($1) as bloqueantes',
      [pid],
    );
    const bloqueantes = rows[0]?.bloqueantes ?? [];
    if (bloqueantes.length > 0) return bloqueantes;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`La sesión ${String(pid)} nunca quedó esperando un lock.`);
}

async function locksSobrePagosYGastos(monitor: pg.Client, pid: number): Promise<number> {
  const { rows } = await monitor.query<{ cantidad: number }>(
    `select count(*)::int as cantidad from pg_locks
     where pid = $1 and relation in ('public.pagos'::regclass, 'public.gastos'::regclass)`,
    [pid],
  );
  return rows[0]?.cantidad ?? -1;
}

async function abrirTransaccion(cliente: pg.Client): Promise<void> {
  await cliente.query('begin');
  await cliente.query("set local lock_timeout = '30s'");
}

interface DatosDeCobro {
  version: number;
  distribucion: Distribucion;
}

async function leerDatosDeCobro(monitor: pg.Client): Promise<DatosDeCobro> {
  const { rows } = await monitor.query<{
    estado: string;
    borrado: boolean;
    version: number;
    cobrado: string;
    gastos: string;
    tope_sueldo: string;
    tope_fijos: string;
  }>(
    `select p.estado, p.deleted_at is not null as borrado, p.version,
            (select coalesce(sum(monto_centavos), 0)::bigint from public.pagos where proyecto_id = p.id and deleted_at is null) as cobrado,
            (select coalesce(sum(monto_centavos), 0)::bigint from public.gastos where proyecto_id = p.id and deleted_at is null) as gastos,
            coalesce(p.reapertura_tope_sueldo_centavos, a.sueldo_mensual_centavos) as tope_sueldo,
            coalesce(p.reapertura_tope_fijos_centavos, a.costos_fijos_centavos) as tope_fijos
     from public.proyectos p join public.ajustes a on a.household_id = p.household_id
     where p.id = $1`,
    [PROYECTO_DEL_SEED],
  );
  const fila = rows[0];
  if (fila?.estado !== 'entregado' || fila.borrado) {
    throw new Error(
      'El test de concurrencia usa el proyecto entregado del seed (5eed…020002). Cargalo con `pnpm --filter @maun/db db:seed`.',
    );
  }
  return {
    version: fila.version,
    distribucion: calcularDistribucion({
      cobrado: centavos(Number(fila.cobrado)),
      gastos: centavos(Number(fila.gastos)),
      diezmoBp: DIEZMO,
      topeSueldo: centavos(Number(fila.tope_sueldo)),
      topeFijos: centavos(Number(fila.tope_fijos)),
    }),
  };
}

async function entrarAlHousehold(cliente: pg.Client): Promise<void> {
  const { rows } = await cliente.query<{ id: string }>(
    `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
     values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
             'concurrencia@maun.test', '', now(), now())
     returning id`,
  );
  const userId = rows[0]?.id ?? '';
  await cliente.query(
    `insert into public.household_members (household_id, user_id, rol) values ($1, $2, 'miembro')`,
    [HOUSEHOLD_DEL_SEED, userId],
  );
  await cliente.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ sub: userId, role: 'authenticated' }),
  ]);
  await cliente.query("select set_config('role', 'authenticated', true)");
}

function cobrar(cliente: pg.Client, datos: DatosDeCobro): Promise<pg.QueryResult> {
  const d = datos.distribucion;
  return cliente.query(
    'select * from public.cobrar_proyecto($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
    [
      PROYECTO_DEL_SEED,
      datos.version,
      '2026-09-11',
      d.cobrado,
      d.gastos,
      d.topeSueldo,
      d.topeFijos,
      d.diezmo,
      d.sueldo,
      d.fijos,
      d.remanente,
    ],
  );
}

describe('cobro y pagos sobre el mismo proyecto, con dos conexiones reales y todo en rollback', () => {
  it('el cobro bloquea el proyecto antes de leer pagos y gastos: frente a un pago en curso, espera sin haber sumado', async () => {
    const pago = await sesion();
    const cobro = await sesion();
    const monitor = await sesion();

    await abrirTransaccion(pago);
    await pago.query(
      `insert into public.pagos (household_id, proyecto_id, fecha, concepto, monto_centavos)
       values ($1, $2, '2026-09-11', 'Pago concurrente de prueba', 100000)`,
      [HOUSEHOLD_DEL_SEED, PROYECTO_DEL_SEED],
    );

    const datos = await leerDatosDeCobro(monitor);
    await abrirTransaccion(cobro);
    await entrarAlHousehold(cobro);
    const pidCobro = await pidDe(cobro);
    const resultado = sinRechazoSuelto(cobrar(cobro, datos));

    expect(await esperarQueEspere(monitor, pidCobro)).toContain(await pidDe(pago));
    expect(await locksSobrePagosYGastos(monitor, pidCobro)).toBe(0);

    await pago.query('rollback');
    await expect(resultado).resolves.toBeDefined();
  });

  it('el lock del cobro es for update: espera incluso a quien solo tiene el proyecto con for key share', async () => {
    const bloqueador = await sesion();
    const cobro = await sesion();
    const monitor = await sesion();

    await abrirTransaccion(bloqueador);
    await bloqueador.query('select 1 from public.proyectos where id = $1 for key share', [
      PROYECTO_DEL_SEED,
    ]);

    const datos = await leerDatosDeCobro(monitor);
    await abrirTransaccion(cobro);
    await entrarAlHousehold(cobro);
    const pidCobro = await pidDe(cobro);
    const resultado = sinRechazoSuelto(cobrar(cobro, datos));

    expect(await esperarQueEspere(monitor, pidCobro)).toContain(await pidDe(bloqueador));

    await bloqueador.query('rollback');
    await expect(resultado).resolves.toBeDefined();
  });

  it('si el cobro llega primero, la guarda del pago lo espera antes de decidir (no la foreign key)', async () => {
    const pago = await sesion();
    const cobro = await sesion();
    const monitor = await sesion();

    const datos = await leerDatosDeCobro(monitor);
    await abrirTransaccion(cobro);
    await entrarAlHousehold(cobro);
    await cobrar(cobro, datos);

    await abrirTransaccion(pago);
    const pidPago = await pidDe(pago);
    const edicion = sinRechazoSuelto(
      pago.query(`update public.pagos set concepto = concepto || ' (editado)' where id = $1`, [
        PAGO_DEL_SEED,
      ]),
    );

    expect(await esperarQueEspere(monitor, pidPago)).toContain(await pidDe(cobro));

    await cobro.query('rollback');
    await expect(edicion).resolves.toBeDefined();
  });
});
