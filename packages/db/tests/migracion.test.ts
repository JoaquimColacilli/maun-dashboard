import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type pg from 'pg';
import { describe, expect, it } from 'vitest';

import {
  agruparClientes,
  describirGrupos,
  normalizarNombre,
} from '../scripts/migracion/clientes.ts';
import { fechaDeAlta, leerSistemaViejo, parsearSaldoLeido } from '../scripts/migracion/entrada.ts';
import { MigracionRechazada, migrar } from '../scripts/migracion/escritura.ts';
import {
  guardarInforme,
  redactarInforme,
  type EncabezadoDelInforme,
} from '../scripts/migracion/informe.ts';
import { armarPlan, TESOROS_EN_ORDEN, type Saldos } from '../scripts/migracion/plan.ts';
import { enTransaccionConRollback } from '../scripts/pgtap.ts';

const CORTE = '2026-09-12';
const ARCHIVO = path.join(import.meta.dirname, 'datos', 'sistema-viejo.json');

const DEL_SISTEMA_VIEJO: Saldos = {
  hogar: 471_104_920,
  maun: 620_914_970,
  diezmo: -19_635_000,
  cocos: 60_500_000,
};

const LEIDOS: Saldos = {
  hogar: 471_104_900,
  maun: 620_915_000,
  diezmo: -19_635_000,
  cocos: 60_500_000,
};

const A_MANO: Saldos = {
  hogar: 31_769_950,
  maun: -100_000_000,
  diezmo: -45_000_000,
  cocos: 60_500_000,
};

function textoDePrueba(): string {
  return readFileSync(ARCHIVO, 'utf8');
}

function sistemaDePrueba() {
  return leerSistemaViejo(JSON.parse(textoDePrueba()));
}

function siempre(respuesta: boolean, anotar: (texto: string) => void = () => undefined) {
  return (texto: string) => {
    anotar(texto);
    return Promise.resolve(respuesta);
  };
}

async function householdDePrueba(cliente: pg.Client): Promise<string> {
  const { rows: usuario } = await cliente.query<{ id: string }>(
    `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
     values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
             $1, '', now(), now())
     returning id`,
    [`migracion-${randomUUID()}@maun.test`],
  );
  const { rows } = await cliente.query<{ id: string }>(
    'select private.crear_household($1, $2) as id',
    ['[prueba] Migración del sistema viejo', usuario[0]?.id],
  );
  return rows[0]?.id ?? '';
}

describe('lo que se lee del JSON del sistema viejo', () => {
  it('el JSON de prueba entra limpio, con el ruido de float y el monto en texto, y avisa lo que no entra', () => {
    const sistema = sistemaDePrueba();
    expect(sistema.sucios).toEqual([]);
    expect(sistema.proyectos).toHaveLength(8);
    expect(sistema.proyectos[0]?.gastos.map((gasto) => gasto.monto)).toEqual([
      24_600_000, 5_800_000, 1_450_030,
    ]);
    expect(sistema.avisos).toContainEqual(
      expect.stringContaining('insumo 4 «Flete (lo pagó la clienta)» no tiene monto: no entra'),
    );
  });

  it('un importe con decimales sucios corta, y dice cuál es y en qué fila', async () => {
    const json = JSON.parse(textoDePrueba()) as { maun3_p: { pagos: { monto: number }[] }[] };
    const adelanto = json.maun3_p[0]?.pagos[1];
    if (adelanto === undefined)
      throw new Error('El JSON de prueba ya no tiene el adelanto del placard.');
    adelanto.monto = 400000.505;
    const sistema = leerSistemaViejo(json);
    expect(sistema.sucios).toEqual([
      'maun3_p[0] «Placard 3 puertas con interior en melamina» (id 1752600000000-a1b2c), pago 2: el importe 400000.505 tiene fracciones de centavo. Es un dato sucio, no un redondeo: corregilo en el JSON.',
    ]);

    const plan = armarPlan(sistema, { corte: CORTE });
    await expect(
      migrar({} as pg.Client, plan, {
        householdId: randomUUID(),
        leidos: LEIDOS,
        corte: CORTE,
        confirmarClientes: siempre(true),
      }),
    ).rejects.toThrow(MigracionRechazada);
  });

  it('también cortan un tipo que el sistema viejo nunca genera, un estado que no existía y un pago sin fecha', () => {
    const sistema = leerSistemaViejo({
      maun3_c: null,
      maun3_p: [
        {
          id: '1766000000000-x',
          cliente: 'Alguien',
          trabajo: 'Algo',
          estado: 'perdido',
          presupuesto: 1000,
          pagos: [{ concepto: 'Seña', monto: 100 }],
        },
      ],
      maun3_m: [
        { id: 'm', tipo: 'ajuste_hogar', concepto: 'Raro', monto: 10, fecha: '2026-01-01' },
      ],
    });
    expect(sistema.sucios).toEqual([
      'maun3_p[0] «Algo» (id 1766000000000-x): el estado "perdido" no es uno de los cuatro del sistema viejo.',
      'maun3_p[0] «Algo» (id 1766000000000-x), pago 1: la fecha vacío no es una fecha AAAA-MM-DD, y toda fila de plata necesita la suya.',
      'maun3_m[0] ajuste_hogar «Raro» (2026-01-01): el sistema viejo no genera nunca este tipo (es código muerto). Revisalo a mano antes de migrar.',
    ]);
  });

  it('los saldos del sistema viejo salen como los sumaba calcTesoros, con DIEZMO al revés', () => {
    const plan = armarPlan(sistemaDePrueba(), { corte: CORTE });
    expect(plan.saldosViejos).toEqual({
      ...DEL_SISTEMA_VIEJO,
      diezmoGenerado: 64_635_000,
      diezmoPagado: 45_000_000,
    });
  });

  it('entran los movimientos a mano de los nueve tipos, y se descartan los derivados de proyectos', () => {
    const plan = armarPlan(sistemaDePrueba(), { corte: CORTE });
    expect(new Set(plan.movimientos.map((movimiento) => movimiento.viejo.tipo)).size).toBe(9);
    expect(plan.movimientos).toHaveLength(10);
    expect(plan.descartados).toHaveLength(29);
    expect(new Set(plan.descartados.map((movimiento) => movimiento.tipo))).toEqual(
      new Set(['ingreso_maun', 'gasto_maun', 'diezmo_generado', 'sueldo_hogar', 'fijos_maun']),
    );

    const lados = Object.fromEntries(
      plan.movimientos.map((movimiento) => [
        movimiento.viejo.id,
        [movimiento.tipo, movimiento.origen, movimiento.destino, movimiento.monto],
      ]),
    );
    expect(lados).toEqual({
      'm-01': ['ingreso', null, 'hogar', 42_000_000],
      'm-02': ['ingreso', null, 'maun', 3_500_000],
      'm-03': ['gasto', 'hogar', null, 10_230_050],
      'm-04': ['gasto', 'maun', null, 18_500_000],
      'm-05': ['pago_diezmo', 'diezmo', null, 45_000_000],
      'm-06': ['aporte_cocos', 'maun', 'cocos', 100_000_000],
      'm-07': ['gasto', 'cocos', null, 40_000_000],
      'm-08': ['transferencia', 'cocos', 'maun', 15_000_000],
      'm-09': ['ajuste', null, 'cocos', 18_000_000],
      'm-10': ['ajuste', 'cocos', null, 2_500_000],
    });
    expect(plan.avisos).toContainEqual(expect.stringContaining('1750000000000-borrado'));
  });

  it('los saldos leídos se escriben como los muestra la app vieja', () => {
    expect(parsearSaldoLeido('4.711.049')).toBe(471_104_900);
    expect(parsearSaldoLeido('-196.350')).toBe(-19_635_000);
    expect(parsearSaldoLeido('$ 605.000')).toBe(60_500_000);
    expect(parsearSaldoLeido('1234567,5')).toBe(123_456_750);
    expect(parsearSaldoLeido('0')).toBe(0);
    expect(parsearSaldoLeido('1234.56')).toBeNull();
    expect(parsearSaldoLeido('mucho')).toBeNull();
  });
});

describe('los clientes', () => {
  it('se normalizan sin acentos, sin mayúsculas, con los espacios colapsados y sin puntuación al final, pero la ñ no es un acento', () => {
    expect(normalizarNombre('  MARCELA   Duarte. ')).toBe('marcela duarte');
    expect(normalizarNombre('José Pérez')).toBe(normalizarNombre('JOSE PEREZ'));
    expect(normalizarNombre('Jorge Peña')).not.toBe(normalizarNombre('Jorge Pena'));
  });

  it('se juntan las variantes, y cada grupo muestra los nombres originales con sus proyectos', () => {
    const nombres = sistemaDePrueba().proyectos.map((proyecto) => proyecto.cliente);
    const grupos = agruparClientes(nombres);
    expect(grupos.map((grupo) => [grupo.nombre, grupo.variantes])).toEqual([
      ['Estudio Bramante', [{ original: 'Estudio Bramante', proyectos: 1 }]],
      ['Jorge Pena', [{ original: 'Jorge Pena', proyectos: 1 }]],
      ['Jorge Peña', [{ original: 'Jorge Peña', proyectos: 1 }]],
      [
        'José Pérez',
        [
          { original: 'José Pérez', proyectos: 1 },
          { original: 'Jose Perez', proyectos: 1 },
        ],
      ],
      [
        'Marcela Duarte',
        [
          { original: 'Marcela Duarte', proyectos: 1 },
          { original: 'marcela  duarte ', proyectos: 1 },
          { original: 'MARCELA DUARTE.', proyectos: 1 },
        ],
      ],
    ]);
    expect(describirGrupos(grupos)).toContain('"marcela  duarte ": 1 proyecto');
  });

  it('--separar deja un nombre exacto como su propio cliente', () => {
    const nombres = sistemaDePrueba().proyectos.map((proyecto) => proyecto.cliente);
    const grupos = agruparClientes(nombres, ['MARCELA DUARTE.']);
    expect(grupos).toHaveLength(6);
    expect(grupos.find((grupo) => grupo.nombre === 'MARCELA DUARTE.')?.variantes).toEqual([
      { original: 'MARCELA DUARTE.', proyectos: 1 },
    ]);
  });
});

describe('la migración contra un household de prueba, en rollback', () => {
  it('escribe todo por la puerta de la app, y los cuatro saldos finales son los leídos: proyectos, más lo cargado a mano, más la apertura', async () => {
    await enTransaccionConRollback(async (cliente) => {
      const householdId = await householdDePrueba(cliente);
      const plan = armarPlan(sistemaDePrueba(), { corte: CORTE });
      const resultado = await migrar(cliente, plan, {
        householdId,
        leidos: LEIDOS,
        corte: CORTE,
        confirmarClientes: siempre(true),
      });

      const objetivo = { ...LEIDOS, diezmo: 19_635_000 };
      expect(resultado.saldos.final).toEqual(objetivo);
      expect(resultado.saldos.manuales).toEqual(A_MANO);
      for (const tesoro of TESOROS_EN_ORDEN) {
        expect(resultado.saldos.final[tesoro]).toBe(
          resultado.saldos.proyectos[tesoro] +
            resultado.saldos.manuales[tesoro] +
            resultado.saldos.apertura[tesoro],
        );
      }

      const { rows: libro } = await cliente.query<{ tesoro: string; saldo: string }>(
        `select tesoro::text as tesoro, sum(monto_centavos)::text as saldo
         from public.libro_mayor where household_id = $1 group by tesoro`,
        [householdId],
      );
      expect(Object.fromEntries(libro.map((fila) => [fila.tesoro, Number(fila.saldo)]))).toEqual(
        objetivo,
      );

      expect(resultado.conteos).toEqual({
        clientes: 5,
        proyectos: 8,
        cobrados: 3,
        pagos: 11,
        gastos: 11,
        movimientos: 10 + resultado.aperturas.length,
      });

      const { rows: estados } = await cliente.query<{ estado: string; cantidad: number }>(
        `select estado::text as estado, count(*)::int as cantidad
         from public.proyectos where household_id = $1 group by estado`,
        [householdId],
      );
      expect(Object.fromEntries(estados.map((fila) => [fila.estado, fila.cantidad]))).toEqual({
        cobrado: 3,
        en_curso: 2,
        entregado: 1,
        presupuesto_enviado: 2,
      });

      const { rows: presupuestados } = await cliente.query<{ titulo: string; contacto: string }>(
        `select titulo, ultimo_contacto::text as contacto from public.proyectos
         where household_id = $1 and estado = 'presupuesto_enviado' order by titulo`,
        [householdId],
      );
      expect(presupuestados.map((fila) => [fila.titulo, fila.contacto])).toEqual([
        ['Alacena para el lavadero', fechaDeAlta('1766000000000-b8c9d')],
        ['Vajillero para el comedor', fechaDeAlta('1756900000000-c3d4e')],
      ]);

      const biblioteca = resultado.liquidaciones.find(
        (hecha) => hecha.proyecto.viejo.titulo === 'Biblioteca a medida 2,40 × 3,10',
      )?.liquidacion;
      expect(biblioteca).toMatchObject({
        fecha: '2025-12-22',
        fijos: 0,
        previo: { fijos: 25_000_000 },
      });

      const encabezado: EncabezadoDelInforme = {
        modo: 'ensayo',
        generado: new Date(),
        archivo: ARCHIVO,
        huella: 'prueba',
        householdId,
        corte: CORTE,
        leidos: LEIDOS,
        separar: [],
      };
      const informe = redactarInforme(
        plan,
        resultado,
        encabezado,
        'Ensayo: no se escribió nada. Todo corrió en una transacción que terminó en rollback.',
      );
      const ruta = guardarInforme(path.join(tmpdir(), 'maun-migracion'), encabezado, informe);
      expect(existsSync(ruta)).toBe(true);
      expect(readFileSync(ruta, 'utf8')).toContain('"marcela  duarte ": 1 proyecto');
      console.log(`Informe del ensayo de prueba: ${ruta}`);
    });
  });

  it('muestra el agrupado de clientes antes de escribir, y si no se confirma no escribe nada', async () => {
    await enTransaccionConRollback(async (cliente) => {
      const householdId = await householdDePrueba(cliente);
      const plan = armarPlan(sistemaDePrueba(), { corte: CORTE });
      let mostrado = '';

      await expect(
        migrar(cliente, plan, {
          householdId,
          leidos: LEIDOS,
          corte: CORTE,
          confirmarClientes: siempre(false, (texto) => {
            mostrado = texto;
          }),
        }),
      ).rejects.toThrow(/No se confirmó el agrupado de clientes/);

      expect(mostrado).toContain('Marcela Duarte');
      expect(mostrado).toContain('"marcela  duarte ": 1 proyecto');
      expect(mostrado).toContain('"MARCELA DUARTE.": 1 proyecto');
      expect(mostrado).toContain('"Jose Perez": 1 proyecto');

      const { rows } = await cliente.query<{ clientes: number; sueldo: string }>(
        `select (select count(*) from public.clientes where household_id = $1)::int as clientes,
                (select sueldo_mensual_centavos::text from public.ajustes where household_id = $1) as sueldo`,
        [householdId],
      );
      expect(rows[0]).toEqual({ clientes: 0, sueldo: '0' });
    });
  });

  it('se niega a correr por segunda vez sobre el mismo household', async () => {
    await enTransaccionConRollback(async (cliente) => {
      const householdId = await householdDePrueba(cliente);
      const opciones = {
        householdId,
        leidos: LEIDOS,
        corte: CORTE,
        confirmarClientes: siempre(true),
      };
      await migrar(cliente, armarPlan(sistemaDePrueba(), { corte: CORTE }), opciones);

      await expect(
        migrar(cliente, armarPlan(sistemaDePrueba(), { corte: CORTE }), opciones),
      ).rejects.toThrow(
        /ya tiene datos \(5 clientes, 8 proyectos, 11 pagos, 11 gastos, \d+ movimientos/,
      );
    });
  });
});
