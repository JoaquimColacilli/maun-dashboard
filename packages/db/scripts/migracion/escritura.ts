import { randomUUID } from 'node:crypto';

import {
  calcularLiquidacion,
  centavos,
  saldosDelLibro,
  type AjustesDeLiquidacion,
  type DatosDelLibro,
  type Liquidacion,
  type LiquidacionRegistrada,
} from '@maun/domain';
import type pg from 'pg';

import type { Tesoro, TipoMovimiento } from '../../src/enums.ts';
import { describirGrupos } from './clientes.ts';
import {
  saldosEnCero,
  TESOROS_EN_ORDEN,
  type Plan,
  type ProyectoAImportar,
  type Saldos,
} from './plan.ts';

export class MigracionRechazada extends Error {}

export interface AjustesDelHousehold {
  sueldo: number;
  fijos: number;
  metaCocos: number;
  tasaBp: number;
  sueldoTopeMensual: boolean;
  perdidoConSueldo: boolean;
  perdidoConDiezmo: boolean;
}

export interface Household {
  id: string;
  nombre: string;
  usuarioId: string;
  email: string;
  ajustes: AjustesDelHousehold;
}

export interface LiquidacionHecha {
  proyecto: ProyectoAImportar;
  liquidacion: Liquidacion;
}

export interface Apertura {
  id: string;
  tesoro: Tesoro;
  diferencia: number;
  fecha: string;
  descripcion: string;
}

export interface SaldosPorOrigen {
  proyectos: Saldos;
  manuales: Saldos;
  apertura: Saldos;
  final: Saldos;
}

export interface Conteos {
  clientes: number;
  proyectos: number;
  cobrados: number;
  pagos: number;
  gastos: number;
  movimientos: number;
}

export interface AjustesDeHoy {
  sueldo: number;
  fijos: number;
  metaCocos: number;
  tasaBp: number;
}

export interface LoDeDespues {
  ajustes: AjustesDeHoy | null;
  cocos: number | null;
}

export interface AjusteDeCocosHecho {
  calculado: number;
  real: number;
  ajuste: Apertura | null;
}

export interface DespuesDeMigrar {
  ajustes: AjustesDeHoy | null;
  cocos: AjusteDeCocosHecho | null;
  saldos: Saldos;
}

export interface ResultadoDeLaMigracion {
  household: Household;
  liquidaciones: LiquidacionHecha[];
  aperturas: Apertura[];
  objetivo: Saldos;
  saldos: SaldosPorOrigen;
  conteos: Conteos;
  verificaciones: string[];
  despues: DespuesDeMigrar | null;
}

export interface OpcionesDeMigracion {
  householdId: string;
  leidos: Saldos;
  corte: string;
  confirmarClientes: (descripcion: string) => Promise<boolean>;
  despues?: LoDeDespues;
}

export const CATEGORIA_DE_APERTURA = 'Apertura';
export const CATEGORIA_DEL_AJUSTE_DE_COCOS = 'Ajuste';

export function objetivoDeLosLeidos(leidos: Saldos): Saldos {
  return { hogar: leidos.hogar, maun: leidos.maun, diezmo: 0 - leidos.diezmo, cocos: leidos.cocos };
}

export async function prepararHousehold(
  cliente: pg.Client,
  householdId: string,
): Promise<Household> {
  const { rows: households } = await cliente.query<{ nombre: string }>(
    'select nombre from public.households where id = $1 and deleted_at is null',
    [householdId],
  );
  const household = households[0];
  if (household === undefined) {
    throw new MigracionRechazada(`No hay ningún household vivo con el id ${householdId}.`);
  }

  const { rows: titulares } = await cliente.query<{
    user_id: string;
    email: string | null;
    households: number;
  }>(
    `select m.user_id, u.email,
            (select count(*) from public.household_members otra
             where otra.user_id = m.user_id and otra.deleted_at is null)::int as households
     from public.household_members m
     left join auth.users u on u.id = m.user_id
     where m.household_id = $1 and m.deleted_at is null and m.rol = 'titular'`,
    [householdId],
  );
  const [titular] = titulares;
  if (titular === undefined || titulares.length > 1) {
    throw new MigracionRechazada(
      `El household «${household.nombre}» tiene ${String(titulares.length)} titulares y el script necesita exactamente uno: escribe con esa cuenta, por las mismas guardas que la app.`,
    );
  }
  const email = titular.email ?? titular.user_id;
  if (titular.households !== 1) {
    throw new MigracionRechazada(
      `La cuenta ${email} pertenece a ${String(titular.households)} households. La base elige el household de cada fila por la membresía de la cuenta, así que con más de uno las filas podrían caer en otro.`,
    );
  }

  const { rows: conteo } = await cliente.query<Record<string, number>>(
    `select (select count(*) from public.clientes where household_id = $1)::int as clientes,
            (select count(*) from public.proyectos where household_id = $1)::int as proyectos,
            (select count(*) from public.pagos where household_id = $1)::int as pagos,
            (select count(*) from public.gastos where household_id = $1)::int as gastos,
            (select count(*) from public.movimientos where household_id = $1)::int as movimientos`,
    [householdId],
  );
  const conDatos = Object.entries(conteo[0] ?? {}).filter(([, cantidad]) => cantidad > 0);
  if (conDatos.length > 0) {
    throw new MigracionRechazada(
      `El household «${household.nombre}» ya tiene datos (${conDatos.map(([tabla, cantidad]) => `${String(cantidad)} ${tabla}`).join(', ')}, contando las filas borradas). El script no corre sobre un household con datos: si la migración ya se hizo, no hay que volver a correrla.`,
    );
  }

  const { rows: ajustes } = await cliente.query<{
    sueldo: string;
    fijos: string;
    meta: string;
    tasa: number;
    sueldo_tope_mensual: boolean;
    perdido_con_sueldo: boolean;
    perdido_con_diezmo: boolean;
  }>(
    `select sueldo_mensual_centavos::text as sueldo, costos_fijos_centavos::text as fijos,
            meta_cocos_centavos::text as meta, tasa_cocos_anual_bp as tasa,
            sueldo_tope_mensual, perdido_con_sueldo, perdido_con_diezmo
     from public.ajustes where household_id = $1`,
    [householdId],
  );
  const [fila] = ajustes;
  if (fila === undefined) {
    throw new MigracionRechazada(`El household «${household.nombre}» no tiene ajustes.`);
  }

  return {
    id: householdId,
    nombre: household.nombre,
    usuarioId: titular.user_id,
    email,
    ajustes: {
      sueldo: Number(fila.sueldo),
      fijos: Number(fila.fijos),
      metaCocos: Number(fila.meta),
      tasaBp: fila.tasa,
      sueldoTopeMensual: fila.sueldo_tope_mensual,
      perdidoConSueldo: fila.perdido_con_sueldo,
      perdidoConDiezmo: fila.perdido_con_diezmo,
    },
  };
}

async function actuarComo(cliente: pg.Client, usuarioId: string): Promise<void> {
  await cliente.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ sub: usuarioId, role: 'authenticated' }),
  ]);
  await cliente.query("select set_config('role', 'authenticated', true)");
}

async function volverAlDuenio(cliente: pg.Client): Promise<void> {
  await cliente.query('reset role');
  await cliente.query("select set_config('request.jwt.claims', '', true)");
}

async function insertar(cliente: pg.Client, sql: string, filas: readonly object[]): Promise<void> {
  if (filas.length === 0) return;
  await cliente.query(sql, [JSON.stringify(filas)]);
}

interface FilaDePago {
  id: string;
  proyecto_id: string;
  fecha: string;
  concepto: string;
  monto_centavos: number;
}

interface FilaDeGasto {
  id: string;
  proyecto_id: string;
  fecha: string;
  descripcion: string;
  monto_centavos: number;
}

interface FilaDeMovimiento {
  id: string;
  fecha: string;
  tipo: TipoMovimiento;
  tesoro_origen: Tesoro | null;
  tesoro_destino: Tesoro | null;
  monto_centavos: number;
  categoria: string;
  descripcion: string;
}

const SQL_DE_MOVIMIENTOS = `insert into public.movimientos (id, fecha, tipo, tesoro_origen, tesoro_destino,
       monto_centavos, categoria, descripcion)
     select m.id, m.fecha::date, m.tipo::public.tipo_movimiento, m.tesoro_origen::public.tesoro,
            m.tesoro_destino::public.tesoro, m.monto_centavos, m.categoria, m.descripcion
     from jsonb_to_recordset($1::jsonb) as m (id uuid, fecha text, tipo text, tesoro_origen text,
       tesoro_destino text, monto_centavos bigint, categoria text, descripcion text)`;

function filaDeAjuste(ajuste: Apertura, categoria: string): FilaDeMovimiento {
  return {
    id: ajuste.id,
    fecha: ajuste.fecha,
    tipo: 'ajuste',
    tesoro_origen: ajuste.diferencia < 0 ? ajuste.tesoro : null,
    tesoro_destino: ajuste.diferencia > 0 ? ajuste.tesoro : null,
    monto_centavos: Math.abs(ajuste.diferencia),
    categoria,
    descripcion: ajuste.descripcion,
  };
}

async function leerSaldos(
  cliente: pg.Client,
  householdId: string,
  aperturas: readonly string[],
): Promise<SaldosPorOrigen> {
  const { rows } = await cliente.query<{
    tesoro: Tesoro;
    proyectos: string;
    manuales: string;
    apertura: string;
    final: string;
  }>(
    `select t.tesoro::text as tesoro,
            coalesce(sum(l.monto_centavos) filter (where l.origen <> 'manual'), 0)::text as proyectos,
            coalesce(sum(l.monto_centavos) filter (where l.origen = 'manual' and l.asiento_id <> all ($2::uuid[])), 0)::text as manuales,
            coalesce(sum(l.monto_centavos) filter (where l.asiento_id = any ($2::uuid[])), 0)::text as apertura,
            coalesce(sum(l.monto_centavos), 0)::text as final
     from unnest(enum_range(null::public.tesoro)) as t (tesoro)
     left join public.libro_mayor l on l.tesoro = t.tesoro and l.household_id = $1
     group by t.tesoro`,
    [householdId, aperturas],
  );
  const saldos: SaldosPorOrigen = {
    proyectos: saldosEnCero(),
    manuales: saldosEnCero(),
    apertura: saldosEnCero(),
    final: saldosEnCero(),
  };
  for (const fila of rows) {
    saldos.proyectos[fila.tesoro] = Number(fila.proyectos);
    saldos.manuales[fila.tesoro] = Number(fila.manuales);
    saldos.apertura[fila.tesoro] = Number(fila.apertura);
    saldos.final[fila.tesoro] = Number(fila.final);
  }
  return saldos;
}

function iguales(uno: Saldos, otro: Saldos): boolean {
  return TESOROS_EN_ORDEN.every((tesoro) => uno[tesoro] === otro[tesoro]);
}

function describirSaldos(saldos: Saldos): string {
  return TESOROS_EN_ORDEN.map((tesoro) => `${tesoro} ${String(saldos[tesoro])}`).join(', ');
}

async function liquidar(
  cliente: pg.Client,
  plan: Plan,
  household: Household,
): Promise<LiquidacionHecha[]> {
  const ajustes: AjustesDeLiquidacion = {
    sueldoMensual: plan.sistema.configuracion.sueldo,
    costosFijos: plan.sistema.configuracion.fijos,
    sueldoTopeMensual: household.ajustes.sueldoTopeMensual,
    perdidoConSueldo: household.ajustes.perdidoConSueldo,
    perdidoConDiezmo: household.ajustes.perdidoConDiezmo,
  };
  const aCobrar = plan.proyectos
    .filter((proyecto) => proyecto.liquidar)
    .sort(
      (uno, otro) =>
        (uno.fechaDeCobro ?? '').localeCompare(otro.fechaDeCobro ?? '') ||
        uno.viejo.indice - otro.viejo.indice,
    );

  const registradas: LiquidacionRegistrada[] = [];
  const hechas: LiquidacionHecha[] = [];
  for (const proyecto of aCobrar) {
    const fecha = proyecto.fechaDeCobro ?? '';
    const liquidacion = calcularLiquidacion({
      destino: 'cobrado',
      fecha,
      cobrado: proyecto.cobrado,
      gastos: proyecto.gastos,
      ajustes,
      reapertura: null,
      liquidaciones: registradas,
    });

    const { rows } = await cliente.query<{
      liquidado_en: number;
      diezmo: string;
      sueldo: string;
      fijos: string;
      remanente: string;
      sueldo_previo: string;
      fijos_previo: string;
    }>(
      `select (extract(epoch from p.dist_liquidado_at) * 1000)::float8 as liquidado_en,
              p.dist_diezmo_centavos::text as diezmo, p.dist_sueldo_centavos::text as sueldo,
              p.dist_fijos_centavos::text as fijos, p.dist_remanente_centavos::text as remanente,
              p.dist_sueldo_previo_centavos::text as sueldo_previo,
              p.dist_fijos_previo_centavos::text as fijos_previo
       from public.cobrar_proyecto($1, 1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) p`,
      [
        proyecto.id,
        fecha,
        liquidacion.cobrado,
        liquidacion.gastos,
        liquidacion.topeSueldo,
        liquidacion.topeFijos,
        liquidacion.diezmo,
        liquidacion.sueldo,
        liquidacion.fijos,
        liquidacion.remanente,
        liquidacion.previo.sueldo,
        liquidacion.previo.fijos,
      ],
    );
    const [fila] = rows;
    const enDominio = [
      liquidacion.diezmo,
      liquidacion.sueldo,
      liquidacion.fijos,
      liquidacion.remanente,
      liquidacion.previo.sueldo,
      liquidacion.previo.fijos,
    ].join(',');
    const enBase =
      fila === undefined
        ? 'nada'
        : [
            fila.diezmo,
            fila.sueldo,
            fila.fijos,
            fila.remanente,
            fila.sueldo_previo,
            fila.fijos_previo,
          ]
            .map(Number)
            .join(',');
    if (fila === undefined || enBase !== enDominio) {
      throw new Error(
        `${proyecto.viejo.donde}: la base congeló ${enBase} y el dominio calculó ${enDominio} (diezmo, sueldo, fijos, remanente y acumulado del mes).`,
      );
    }

    registradas.push({
      estado: 'cobrado',
      fecha: liquidacion.fecha,
      liquidadaEn: fila.liquidado_en,
      sueldo: liquidacion.sueldo,
      fijos: liquidacion.fijos,
      objetivoSueldo: liquidacion.objetivos.sueldo,
      objetivoFijos: liquidacion.objetivos.fijos,
      sueldoMensual: liquidacion.objetivos.sueldoMensual,
    });
    hechas.push({ proyecto, liquidacion });
  }
  return hechas;
}

async function aplicarLoDeDespues(
  cliente: pg.Client,
  household: Household,
  opciones: OpcionesDeMigracion,
  antes: Saldos,
  verificaciones: string[],
): Promise<DespuesDeMigrar | null> {
  const pedido = opciones.despues;
  if (pedido === undefined || (pedido.ajustes === null && pedido.cocos === null)) return null;

  await actuarComo(cliente, household.usuarioId);

  if (pedido.ajustes !== null) {
    const { rowCount } = await cliente.query(
      `update public.ajustes set sueldo_mensual_centavos = $2, costos_fijos_centavos = $3,
         meta_cocos_centavos = $4, tasa_cocos_anual_bp = $5
       where household_id = $1`,
      [
        household.id,
        pedido.ajustes.sueldo,
        pedido.ajustes.fijos,
        pedido.ajustes.metaCocos,
        pedido.ajustes.tasaBp,
      ],
    );
    if (rowCount !== 1)
      throw new Error('No se pudieron dejar los ajustes de hoy con la cuenta del titular.');
  }

  let cocos: AjusteDeCocosHecho | null = null;
  if (pedido.cocos !== null) {
    const { rows } = await cliente.query<{ saldo: string }>(
      `select coalesce(sum(monto_centavos), 0)::text as saldo
       from public.libro_mayor where household_id = $1 and tesoro = 'cocos'`,
      [household.id],
    );
    const calculado = Number(rows[0]?.saldo);
    if (!Number.isSafeInteger(calculado)) {
      throw new Error(
        `No se pudo leer el saldo de COCOS después de migrar: ${String(rows[0]?.saldo)}.`,
      );
    }
    const diferencia = pedido.cocos - calculado;
    const ajuste: Apertura | null =
      diferencia === 0
        ? null
        : {
            id: randomUUID(),
            tesoro: 'cocos',
            diferencia,
            fecha: opciones.corte,
            descripcion:
              diferencia > 0
                ? 'Ajuste de Cocos (intereses o depósito)'
                : 'Ajuste de Cocos (retiro o corrección)',
          };
    if (ajuste !== null) {
      await insertar(cliente, SQL_DE_MOVIMIENTOS, [
        filaDeAjuste(ajuste, CATEGORIA_DEL_AJUSTE_DE_COCOS),
      ]);
    }
    cocos = { calculado, real: pedido.cocos, ajuste };
  }

  await volverAlDuenio(cliente);

  if (pedido.ajustes !== null) {
    const { rows } = await cliente.query<AjustesDeHoy>(
      `select sueldo_mensual_centavos::float8 as "sueldo", costos_fijos_centavos::float8 as "fijos",
              meta_cocos_centavos::float8 as "metaCocos", tasa_cocos_anual_bp as "tasaBp"
       from public.ajustes where household_id = $1`,
      [household.id],
    );
    if (JSON.stringify(rows[0]) !== JSON.stringify(pedido.ajustes)) {
      throw new Error(
        `Los ajustes quedaron en ${JSON.stringify(rows[0])} y tenían que quedar en ${JSON.stringify(pedido.ajustes)}.`,
      );
    }
    verificaciones.push(
      'Después de migrar, los ajustes quedaron exactamente en los de hoy. Los cobros ya se habían congelado con la configuración del sistema viejo, y cambiar los ajustes no los reescribe.',
    );
  }

  const esperado: Saldos = { ...antes, cocos: pedido.cocos ?? antes.cocos };
  const { final } = await leerSaldos(cliente, household.id, []);
  if (!iguales(final, esperado)) {
    throw new Error(
      `Después de lo de después los saldos son ${describirSaldos(final)} y tenían que ser ${describirSaldos(esperado)}.`,
    );
  }
  if (cocos !== null) {
    verificaciones.push(
      'COCOS quedó exactamente en el saldo real pedido: el ajuste es la diferencia contra el saldo que la vista libro_mayor daba después de migrar, no un importe escrito. HOGAR, MAUN y DIEZMO no se movieron.',
    );
  }

  return { ajustes: pedido.ajustes, cocos, saldos: final };
}

export async function migrar(
  cliente: pg.Client,
  plan: Plan,
  opciones: OpcionesDeMigracion,
): Promise<ResultadoDeLaMigracion> {
  if (plan.sistema.sucios.length > 0) {
    throw new MigracionRechazada(
      `El JSON tiene ${String(plan.sistema.sucios.length)} datos sucios: no se migra nada hasta corregirlos.`,
    );
  }

  const household = await prepararHousehold(cliente, opciones.householdId);
  if (!(await opciones.confirmarClientes(describirGrupos(plan.clientes)))) {
    throw new MigracionRechazada(
      'No se confirmó el agrupado de clientes: no se escribió nada. Para que un nombre quede como su propio cliente, pasalo con --separar "<nombre exacto>".',
    );
  }

  const pagos: FilaDePago[] = plan.proyectos.flatMap((proyecto) =>
    proyecto.viejo.pagos.map((pago) => ({
      id: randomUUID(),
      proyecto_id: proyecto.id,
      fecha: pago.fecha,
      concepto: pago.concepto,
      monto_centavos: pago.monto,
    })),
  );
  const gastos: FilaDeGasto[] = plan.proyectos.flatMap((proyecto) =>
    proyecto.gastosAImportar.map((gasto) => ({
      id: randomUUID(),
      proyecto_id: proyecto.id,
      fecha: gasto.fecha,
      descripcion: gasto.descripcion,
      monto_centavos: gasto.monto,
    })),
  );
  const movimientos: FilaDeMovimiento[] = plan.movimientos.map((movimiento) => ({
    id: movimiento.id,
    fecha: movimiento.fecha,
    tipo: movimiento.tipo,
    tesoro_origen: movimiento.origen,
    tesoro_destino: movimiento.destino,
    monto_centavos: movimiento.monto,
    categoria: movimiento.categoria,
    descripcion: movimiento.descripcion,
  }));

  await actuarComo(cliente, household.usuarioId);

  const { configuracion } = plan.sistema;
  const { rowCount } = await cliente.query(
    `update public.ajustes set sueldo_mensual_centavos = $2, costos_fijos_centavos = $3,
       meta_cocos_centavos = $4, tasa_cocos_anual_bp = $5
     where household_id = $1`,
    [
      household.id,
      configuracion.sueldo,
      configuracion.fijos,
      configuracion.metaCocos,
      configuracion.tasaBp,
    ],
  );
  if (rowCount !== 1)
    throw new Error('No se pudieron escribir los ajustes con la cuenta del titular.');

  await insertar(
    cliente,
    `insert into public.clientes (id, nombre)
     select c.id, c.nombre from jsonb_to_recordset($1::jsonb) as c (id uuid, nombre text)`,
    plan.clientes.map((grupo) => ({ id: grupo.id, nombre: grupo.nombre })),
  );
  await insertar(
    cliente,
    `insert into public.proyectos (id, cliente_id, titulo, estado, presupuesto_centavos, forma_pago,
       ultimo_contacto, fecha_inicio, entrega_estimada, notas)
     select p.id, p.cliente_id, p.titulo, p.estado::public.estado_proyecto, p.presupuesto_centavos,
            p.forma_pago::public.forma_pago, p.ultimo_contacto::date, p.fecha_inicio::date,
            p.entrega_estimada::date, p.notas
     from jsonb_to_recordset($1::jsonb) as p (id uuid, cliente_id uuid, titulo text, estado text,
       presupuesto_centavos bigint, forma_pago text, ultimo_contacto text, fecha_inicio text,
       entrega_estimada text, notas text)`,
    plan.proyectos.map((proyecto) => ({
      id: proyecto.id,
      cliente_id: proyecto.clienteId,
      titulo: proyecto.viejo.titulo,
      estado: proyecto.estado,
      presupuesto_centavos: proyecto.presupuesto,
      forma_pago: proyecto.viejo.formaDePago,
      ultimo_contacto: proyecto.ultimoContacto,
      fecha_inicio: proyecto.viejo.inicio,
      entrega_estimada: proyecto.viejo.entrega,
      notas: proyecto.notas,
    })),
  );
  await insertar(
    cliente,
    `insert into public.pagos (id, proyecto_id, fecha, concepto, monto_centavos)
     select g.id, g.proyecto_id, g.fecha::date, g.concepto, g.monto_centavos
     from jsonb_to_recordset($1::jsonb) as g (id uuid, proyecto_id uuid, fecha text, concepto text,
       monto_centavos bigint)`,
    pagos,
  );
  await insertar(
    cliente,
    `insert into public.gastos (id, proyecto_id, fecha, descripcion, monto_centavos)
     select g.id, g.proyecto_id, g.fecha::date, g.descripcion, g.monto_centavos
     from jsonb_to_recordset($1::jsonb) as g (id uuid, proyecto_id uuid, fecha text,
       descripcion text, monto_centavos bigint)`,
    gastos,
  );
  await insertar(cliente, SQL_DE_MOVIMIENTOS, movimientos);

  const liquidaciones = await liquidar(cliente, plan, household);

  const objetivo = objetivoDeLosLeidos(opciones.leidos);
  const antes = await leerSaldos(cliente, household.id, []);
  const aperturas: Apertura[] = TESOROS_EN_ORDEN.flatMap((tesoro) => {
    const diferencia = objetivo[tesoro] - antes.final[tesoro];
    if (diferencia === 0) return [];
    return [
      {
        id: randomUUID(),
        tesoro,
        diferencia,
        fecha: opciones.corte,
        descripcion: `Apertura: diferencia contra el saldo del sistema viejo al ${opciones.corte}`,
      },
    ];
  });
  const filasDeApertura: FilaDeMovimiento[] = aperturas.map((apertura) =>
    filaDeAjuste(apertura, CATEGORIA_DE_APERTURA),
  );
  await insertar(cliente, SQL_DE_MOVIMIENTOS, filasDeApertura);

  await volverAlDuenio(cliente);

  const verificaciones: string[] = [];
  const { rows: filasDeConteo } = await cliente.query<Conteos>(
    `select (select count(*) from public.clientes where household_id = $1 and deleted_at is null)::int as clientes,
            (select count(*) from public.proyectos where household_id = $1 and deleted_at is null)::int as proyectos,
            (select count(*) from public.proyectos where household_id = $1 and estado = 'cobrado')::int as cobrados,
            (select count(*) from public.pagos where household_id = $1 and deleted_at is null)::int as pagos,
            (select count(*) from public.gastos where household_id = $1 and deleted_at is null)::int as gastos,
            (select count(*) from public.movimientos where household_id = $1 and deleted_at is null)::int as movimientos`,
    [household.id],
  );
  const conteos = filasDeConteo[0] ?? {
    clientes: 0,
    proyectos: 0,
    cobrados: 0,
    pagos: 0,
    gastos: 0,
    movimientos: 0,
  };
  const esperados: Conteos = {
    clientes: plan.clientes.length,
    proyectos: plan.proyectos.length,
    cobrados: liquidaciones.length,
    pagos: pagos.length,
    gastos: gastos.length,
    movimientos: movimientos.length + aperturas.length,
  };
  if (JSON.stringify(conteos) !== JSON.stringify(esperados)) {
    throw new Error(
      `Las filas del household no son las del plan: en la base ${JSON.stringify(conteos)}, en el plan ${JSON.stringify(esperados)}.`,
    );
  }
  verificaciones.push(
    `En el household quedaron exactamente las filas del plan: ${String(conteos.clientes)} clientes, ${String(conteos.proyectos)} proyectos (${String(conteos.cobrados)} cobrados), ${String(conteos.pagos)} pagos, ${String(conteos.gastos)} gastos y ${String(conteos.movimientos)} movimientos (${String(aperturas.length)} de apertura).`,
  );
  verificaciones.push(
    `Los ${String(liquidaciones.length)} cobros pasaron por cobrar_proyecto, y la base congeló exactamente la distribución que calcula @maun/domain.`,
  );

  const saldos = await leerSaldos(
    cliente,
    household.id,
    aperturas.map((apertura) => apertura.id),
  );

  const liquidacionPorProyecto = new Map(
    liquidaciones.map((hecha) => [hecha.proyecto.id, hecha.liquidacion]),
  );
  const datos: DatosDelLibro = {
    movimientos: [...movimientos, ...filasDeApertura].map((fila) => ({
      id: fila.id,
      fecha: fila.fecha,
      tipo: fila.tipo,
      tesoroOrigen: fila.tesoro_origen,
      tesoroDestino: fila.tesoro_destino,
      monto: centavos(fila.monto_centavos),
      categoria: fila.categoria,
      descripcion: fila.descripcion,
      proyectoId: null,
    })),
    pagos: pagos.map((pago) => ({
      id: pago.id,
      proyectoId: pago.proyecto_id,
      fecha: pago.fecha,
      concepto: pago.concepto,
      monto: centavos(pago.monto_centavos),
    })),
    gastos: gastos.map((gasto) => ({
      id: gasto.id,
      proyectoId: gasto.proyecto_id,
      fecha: gasto.fecha,
      descripcion: gasto.descripcion,
      monto: centavos(gasto.monto_centavos),
    })),
    proyectos: plan.proyectos.map((proyecto) => {
      const liquidacion = liquidacionPorProyecto.get(proyecto.id);
      return {
        id: proyecto.id,
        titulo: proyecto.viejo.titulo,
        estado: liquidacion === undefined ? proyecto.estado : 'cobrado',
        fechaCobro: liquidacion?.fecha ?? null,
        diezmo: liquidacion?.diezmo ?? centavos(0),
        sueldo: liquidacion?.sueldo ?? centavos(0),
      };
    }),
  };
  const enDominio = saldosDelLibro(datos);
  if (!iguales(saldos.final, enDominio)) {
    throw new Error(
      `La vista libro_mayor da ${describirSaldos(saldos.final)} y @maun/domain da ${describirSaldos(enDominio)} sobre las mismas filas.`,
    );
  }
  verificaciones.push(
    'Los saldos de la vista libro_mayor son los mismos que calcula @maun/domain sobre las mismas filas.',
  );

  if (!iguales(saldos.final, objetivo)) {
    throw new Error(
      `Después de la apertura los saldos son ${describirSaldos(saldos.final)} y tenían que ser ${describirSaldos(objetivo)}.`,
    );
  }
  verificaciones.push(
    'Los cuatro saldos finales son exactamente los que leíste en el sistema viejo (el de DIEZMO, con el signo de la base).',
  );

  const despues = await aplicarLoDeDespues(
    cliente,
    household,
    opciones,
    saldos.final,
    verificaciones,
  );

  return {
    household,
    liquidaciones,
    aperturas,
    objetivo,
    saldos,
    conteos,
    verificaciones,
    despues,
  };
}
