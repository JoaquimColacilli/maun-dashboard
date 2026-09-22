import type { EstadoLiquidado } from '@maun/domain';
import type pg from 'pg';
import { afterEach, describe, expect, it } from 'vitest';

import {
  HOUSEHOLD_DEL_SEED,
  liquidarPreparada,
  prepararLiquidacion,
  type LiquidacionPreparada,
} from '../scripts/comparacion.ts';
import { conectar } from '../scripts/conexion.ts';

const PROYECTO_DEL_SEED = '5eed0000-0000-7000-8000-000000020002';
const LEAD_DEL_SEED = '5eed0000-0000-7000-8000-000000020011';
const PAGO_DEL_SEED = '5eed0000-0000-7000-8000-000000030004';
const ENCUESTA_DEL_SEED = '5eed0000-0000-7000-8000-000000060001';
const TOKEN_DE_LA_ENCUESTA_DEL_SEED = '5eed-encuesta-del-vanitory-0001';

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

async function lecturasDeProyectos(monitor: pg.Client, pid: number): Promise<number> {
  const { rows } = await monitor.query<{ cantidad: number }>(
    `select count(*)::int as cantidad from pg_locks
     where pid = $1 and relation = 'public.proyectos'::regclass and mode = 'AccessShareLock'`,
    [pid],
  );
  return rows[0]?.cantidad ?? -1;
}

async function abrirTransaccion(cliente: pg.Client): Promise<void> {
  await cliente.query('begin');
  await cliente.query("set local lock_timeout = '30s'");
}

const ESTADO_DEL_SEED: Record<EstadoLiquidado, string> = {
  cobrado: 'entregado',
  perdido: 'contacto',
};

async function leerDatos(
  monitor: pg.Client,
  proyectoId: string,
  destino: EstadoLiquidado,
): Promise<LiquidacionPreparada> {
  const { rows } = await monitor.query<{ estado: string; borrado: boolean }>(
    'select estado::text as estado, deleted_at is not null as borrado from public.proyectos where id = $1',
    [proyectoId],
  );
  const fila = rows[0];
  if (fila?.estado !== ESTADO_DEL_SEED[destino] || fila.borrado) {
    throw new Error(
      `El test de concurrencia usa proyectos del seed (${proyectoId}, ${ESTADO_DEL_SEED[destino]}). Cargalo con \`pnpm --filter @maun/db db:seed\`.`,
    );
  }
  return prepararLiquidacion(monitor, HOUSEHOLD_DEL_SEED, proyectoId, destino, '2026-09-11');
}

async function entrarAlHousehold(cliente: pg.Client): Promise<void> {
  const { rows } = await cliente.query<{ id: string }>(
    `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
     values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
             'concurrencia-' || gen_random_uuid() || '@maun.test', '', now(), now())
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

async function comoAnonimo(cliente: pg.Client): Promise<void> {
  await cliente.query('select set_config(\'request.jwt.claims\', \'{"role": "anon"}\', true)');
  await cliente.query("select set_config('role', 'anon', true)");
}

interface PreguntaDeLaFoto {
  id: string;
  tipo: string;
}

async function respuestaParaElSeed(monitor: pg.Client, id: string): Promise<string> {
  const { rows } = await monitor.query<{ contestada: boolean; preguntas: PreguntaDeLaFoto[] }>(
    `select exists (select 1 from public.respuestas r where r.encuesta_id = e.id) as contestada,
            coalesce(
              (select jsonb_agg(jsonb_build_object('id', p ->> 'id', 'tipo', p ->> 'tipo'))
               from jsonb_array_elements(e.preguntas) as p
               where (p ->> 'obligatoria')::boolean),
              '[]'::jsonb
            ) as preguntas
     from public.encuestas_enviadas e
     where e.id = $1 and e.revocada_at is null and e.deleted_at is null`,
    [ENCUESTA_DEL_SEED],
  );
  const fila = rows[0];
  if (fila === undefined || fila.contestada) {
    throw new Error(
      'El test de concurrencia usa la encuesta sin contestar del seed. Cargalo con `pnpm --filter @maun/db db:seed`.',
    );
  }
  return JSON.stringify({
    id,
    renglones: fila.preguntas.map((pregunta) => ({
      pregunta: pregunta.id,
      valor: pregunta.tipo === 'sitalvezno' ? 3 : 5,
    })),
  });
}

async function contestar(cliente: pg.Client, respuesta: string): Promise<unknown> {
  const { rows } = await cliente.query<{ resultado: unknown }>(
    'select public.contestar_encuesta($1, $2::jsonb) as resultado',
    [TOKEN_DE_LA_ENCUESTA_DEL_SEED, respuesta],
  );
  return rows[0]?.resultado;
}

describe('dos personas contra el mismo enlace de la encuesta, con conexiones reales y todo en rollback', () => {
  it('dos respuestas a la vez: la segunda espera a la primera en el índice único antes de guardar nada', async () => {
    const primera = await sesion();
    const segunda = await sesion();
    const monitor = await sesion();

    const respuestaUno = await respuestaParaElSeed(monitor, '0192a3b4-c5d6-7e8f-9a0b-000000000001');
    const respuestaDos = await respuestaParaElSeed(monitor, '0192a3b4-c5d6-7e8f-9a0b-000000000002');

    await abrirTransaccion(primera);
    await comoAnonimo(primera);
    expect(await contestar(primera, respuestaUno)).toEqual({ estado: 'guardada' });

    await abrirTransaccion(segunda);
    await comoAnonimo(segunda);
    const pidSegunda = await pidDe(segunda);
    const resultado = sinRechazoSuelto(contestar(segunda, respuestaDos));

    expect(await esperarQueEspere(monitor, pidSegunda)).toContain(await pidDe(primera));

    await primera.query('rollback');
    await expect(resultado).resolves.toEqual({ estado: 'guardada' });
  });

  it('dar de baja el enlace espera a la respuesta que se está guardando', async () => {
    const cliente = await sesion();
    const duenio = await sesion();
    const monitor = await sesion();

    const respuesta = await respuestaParaElSeed(monitor, '0192a3b4-c5d6-7e8f-9a0b-000000000003');

    await abrirTransaccion(cliente);
    await comoAnonimo(cliente);
    expect(await contestar(cliente, respuesta)).toEqual({ estado: 'guardada' });

    await abrirTransaccion(duenio);
    await entrarAlHousehold(duenio);
    const pidDuenio = await pidDe(duenio);
    const baja = sinRechazoSuelto(
      duenio.query('update public.encuestas_enviadas set revocada_at = now() where id = $1', [
        ENCUESTA_DEL_SEED,
      ]),
    );

    expect(await esperarQueEspere(monitor, pidDuenio)).toContain(await pidDe(cliente));

    await cliente.query('rollback');
    await expect(baja).resolves.toBeDefined();
  });
});

describe('liquidaciones y pagos sobre el mismo household, con conexiones reales y todo en rollback', () => {
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

    const datos = await leerDatos(monitor, PROYECTO_DEL_SEED, 'cobrado');
    await abrirTransaccion(cobro);
    await entrarAlHousehold(cobro);
    const pidCobro = await pidDe(cobro);
    const resultado = sinRechazoSuelto(liquidarPreparada(cobro, datos));

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

    const datos = await leerDatos(monitor, PROYECTO_DEL_SEED, 'cobrado');
    await abrirTransaccion(cobro);
    await entrarAlHousehold(cobro);
    const pidCobro = await pidDe(cobro);
    const resultado = sinRechazoSuelto(liquidarPreparada(cobro, datos));

    expect(await esperarQueEspere(monitor, pidCobro)).toContain(await pidDe(bloqueador));

    await bloqueador.query('rollback');
    await expect(resultado).resolves.toBeDefined();
  });

  it('si el cobro llega primero, la guarda del pago lo espera antes de decidir (no la foreign key)', async () => {
    const pago = await sesion();
    const cobro = await sesion();
    const monitor = await sesion();

    const datos = await leerDatos(monitor, PROYECTO_DEL_SEED, 'cobrado');
    await abrirTransaccion(cobro);
    await entrarAlHousehold(cobro);
    await liquidarPreparada(cobro, datos);

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

  it('dos liquidaciones del mismo household, de proyectos distintos, se esperan en la fila de ajustes antes de sumar el mes, pagos y gastos', async () => {
    const primera = await sesion();
    const segunda = await sesion();
    const monitor = await sesion();

    const cobro = await leerDatos(monitor, PROYECTO_DEL_SEED, 'cobrado');
    const cierre = await leerDatos(monitor, LEAD_DEL_SEED, 'perdido');
    await abrirTransaccion(primera);
    await entrarAlHousehold(primera);
    await abrirTransaccion(segunda);
    await entrarAlHousehold(segunda);

    await liquidarPreparada(primera, cobro);
    const pidSegunda = await pidDe(segunda);
    const resultado = sinRechazoSuelto(liquidarPreparada(segunda, cierre));

    expect(await esperarQueEspere(monitor, pidSegunda)).toContain(await pidDe(primera));
    expect(await locksSobrePagosYGastos(monitor, pidSegunda)).toBe(0);
    expect(await lecturasDeProyectos(monitor, pidSegunda)).toBe(0);

    await primera.query('rollback');
    await expect(resultado).resolves.toBeDefined();
  });

  it('una liquidación espera a una edición de los ajustes en curso: no liquida con un objetivo que está cambiando', async () => {
    const edicion = await sesion();
    const cobro = await sesion();
    const monitor = await sesion();

    const datos = await leerDatos(monitor, PROYECTO_DEL_SEED, 'cobrado');
    await abrirTransaccion(edicion);
    await edicion.query(
      'update public.ajustes set meta_cocos_centavos = meta_cocos_centavos + 1 where household_id = $1',
      [HOUSEHOLD_DEL_SEED],
    );

    await abrirTransaccion(cobro);
    await entrarAlHousehold(cobro);
    const pidCobro = await pidDe(cobro);
    const resultado = sinRechazoSuelto(liquidarPreparada(cobro, datos));

    expect(await esperarQueEspere(monitor, pidCobro)).toContain(await pidDe(edicion));
    expect(await locksSobrePagosYGastos(monitor, pidCobro)).toBe(0);
    expect(await lecturasDeProyectos(monitor, pidCobro)).toBe(0);

    await edicion.query('rollback');
    await expect(resultado).resolves.toBeDefined();
  });
});
