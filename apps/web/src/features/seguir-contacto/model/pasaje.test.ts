import { puntosBasicos } from '@maun/domain';
import { describe, expect, it } from 'vitest';

import type { OpcionDePresupuesto, Proyecto } from '@/entities/proyecto';

import {
  errorDelPasaje,
  guardadoDelPasaje,
  presupuestoDelPasaje,
  resumenDelPasaje,
  senaDelPasaje,
  formaSugerida,
  senaSugerida,
  type ValoresDelPasaje,
} from './pasaje';

const HOY = '2026-09-16';
const PAGO = 'pago-nuevo';
const LA_MITAD = puntosBasicos(5_000);
const SOLO_ALAN = 124_800_000;
const LOS_DOS = 230_000_000;

const CONTACTO = {
  id: 'p',
  version: 4,
  cliente_id: 'c',
  titulo: 'Escritorio',
  descripcion: '',
  estado: 'presupuesto_enviado',
  presupuesto_centavos: null,
  sena_bp: null,
  forma_pago: null,
  comprobante: 'sin_comprobante',
  fecha_visita: '2026-09-01',
  ultimo_contacto: '2026-09-05',
  fecha_inicio: null,
  entrega_estimada: null,
  fecha_entrega: null,
  direccion_entrega: '',
  notas: '',
  vencimiento_presupuesto: null,
  visita_hecha: true,
} as unknown as Proyecto;

function opcion(id: string, monto: number, aprobada = false): OpcionDePresupuesto {
  return {
    id,
    household_id: 'h',
    proyecto_id: 'p',
    descripcion: `Opción ${id}`,
    monto_centavos: monto,
    aprobada,
    created_at: '2026-09-16T12:00:00Z',
    updated_at: '2026-09-16T12:00:00Z',
    deleted_at: null,
    version: 1,
  };
}

function valores(extra: Partial<ValoresDelPasaje> = {}): ValoresDelPasaje {
  return {
    presupuesto: null,
    opcion: null,
    sena: null,
    forma: 'transferencia',
    comprobante: 'sin_comprobante',
    inicio: HOY,
    entrega: '2026-10-15',
    direccion: '  Belgrano 123  ',
    ...extra,
  };
}

describe('el pasaje de un contacto sin opciones', () => {
  it('pasa a en curso con el presupuesto que se escribió, sin la clave de las opciones', () => {
    const { pedido, previos } = guardadoDelPasaje(
      CONTACTO,
      [],
      valores({ presupuesto: 120_000_000 }),
      HOY,
      PAGO,
    );

    expect(pedido.datos).toMatchObject({
      estado: 'en_curso',
      presupuesto_centavos: 120_000_000,
      ultimo_contacto: HOY,
      forma_pago: 'transferencia',
      fecha_inicio: HOY,
      entrega_estimada: '2026-10-15',
      direccion_entrega: 'Belgrano 123',
    });
    expect(pedido).toMatchObject({ id: 'p', version: 4, pagos: [], gastos: [] });
    expect('opciones' in pedido).toBe(false);
    expect(previos.opciones).toEqual([]);
  });

  it('sin presupuesto no deja pasar', () => {
    expect(errorDelPasaje([], valores())).toBe('Poné el presupuesto que aprobó, en pesos.');
    expect(errorDelPasaje([], valores({ presupuesto: 120_000_000 }))).toBeUndefined();
  });
});

describe('el pasaje de un contacto con opciones', () => {
  it('lo escrito como presupuesto no cuenta: vale el importe de la opción elegida', () => {
    const opciones = [opcion('a', SOLO_ALAN), opcion('b', LOS_DOS)];

    expect(presupuestoDelPasaje(opciones, { presupuesto: 99_900, opcion: null })).toBeNull();
    expect(presupuestoDelPasaje(opciones, { presupuesto: 99_900, opcion: 'b' })).toBe(LOS_DOS);
  });

  it('sin una opción elegida no deja pasar, tampoco si la elegida ya no está', () => {
    const opciones = [opcion('a', SOLO_ALAN), opcion('b', LOS_DOS)];

    expect(errorDelPasaje(opciones, { presupuesto: 99_900, opcion: null })).toBe(
      'Elegí la opción que aprobó.',
    );
    expect(errorDelPasaje(opciones, { presupuesto: null, opcion: 'borrada' })).toBe(
      'Elegí la opción que aprobó.',
    );
    expect(errorDelPasaje(opciones, { presupuesto: null, opcion: 'a' })).toBeUndefined();
  });

  it('con la que ya estaba aprobada, pasa sin mandar las opciones, así no las toca', () => {
    const opciones = [opcion('a', SOLO_ALAN, true), opcion('b', LOS_DOS)];

    const { pedido, previos } = guardadoDelPasaje(
      CONTACTO,
      opciones,
      valores({ opcion: 'a' }),
      HOY,
      PAGO,
    );

    expect(pedido.datos).toMatchObject({ estado: 'en_curso', presupuesto_centavos: SOLO_ALAN });
    expect('opciones' in pedido).toBe(false);
    expect(previos.opciones).toEqual([]);
  });

  it('si elige otra, la aprueba en el mismo guardado y la anterior queda sin tildar', () => {
    const opciones = [opcion('a', SOLO_ALAN, true), opcion('b', LOS_DOS)];

    const { pedido, previos } = guardadoDelPasaje(
      CONTACTO,
      opciones,
      valores({ opcion: 'b' }),
      HOY,
      PAGO,
    );

    expect(pedido.datos).toMatchObject({ estado: 'en_curso', presupuesto_centavos: LOS_DOS });
    expect(pedido.opciones).toEqual([
      { id: 'a', descripcion: 'Opción a', monto_centavos: SOLO_ALAN, aprobada: false },
      { id: 'b', descripcion: 'Opción b', monto_centavos: LOS_DOS, aprobada: true },
    ]);
    expect(pedido).toMatchObject({ id: 'p', version: 4, pagos: [], gastos: [] });
    expect(previos).toEqual({
      proyecto: CONTACTO,
      pagos: [],
      gastos: [],
      opciones,
      necesidades: [],
    });
  });

  it('si ninguna estaba aprobada, aprueba la elegida al pasar', () => {
    const opciones = [opcion('a', SOLO_ALAN), opcion('b', LOS_DOS)];

    const { pedido } = guardadoDelPasaje(CONTACTO, opciones, valores({ opcion: 'a' }), HOY, PAGO);

    expect(pedido.datos.presupuesto_centavos).toBe(SOLO_ALAN);
    expect(pedido.opciones).toEqual([
      { id: 'a', descripcion: 'Opción a', monto_centavos: SOLO_ALAN, aprobada: true },
      { id: 'b', descripcion: 'Opción b', monto_centavos: LOS_DOS, aprobada: false },
    ]);
  });
});

describe('la seña que se carga al aprobar', () => {
  it('sugiere lo que falta para llegar al porcentaje del taller, sin contar dos veces lo ya cobrado', () => {
    const esperada = senaDelPasaje(LOS_DOS, 30_000_000, LA_MITAD, null);

    expect(esperada).toMatchObject({ situacion: 'falta', esperada: 115_000_000 });
    expect(senaSugerida(esperada)).toBe(85_000_000);
  });

  it('el porcentaje propio del trabajo pisa al del taller', () => {
    expect(senaDelPasaje(LOS_DOS, 0, LA_MITAD, puntosBasicos(3_000))).toMatchObject({
      porcentaje: 3_000,
      esperada: 69_000_000,
    });
  });

  it('si lo que ya cobró cubre la seña, no sugiere nada', () => {
    const esperada = senaDelPasaje(LOS_DOS, 200_000_000, LA_MITAD, null);

    expect(esperada.situacion).toBe('cubierta');
    expect(senaSugerida(esperada)).toBeNull();
  });

  it('sin presupuesto elegido todavía no hay seña que sugerir', () => {
    expect(senaSugerida(senaDelPasaje(null, 0, LA_MITAD, null))).toBeNull();
  });

  it('el resumen suma lo de antes con lo de ahora una sola vez', () => {
    expect(resumenDelPasaje(LOS_DOS, 30_000_000, 85_000_000)).toEqual({
      antes: 30_000_000,
      ahora: 85_000_000,
      cobrado: 115_000_000,
      saldo: 115_000_000,
    });
  });

  it('sin cargar nada, el resumen es el de siempre', () => {
    expect(resumenDelPasaje(LOS_DOS, 30_000_000, null)).toEqual({
      antes: 30_000_000,
      ahora: 0,
      cobrado: 30_000_000,
      saldo: 200_000_000,
    });
  });

  it('cobrar de más no deja un saldo negativo, y sin presupuesto no hay saldo', () => {
    expect(resumenDelPasaje(LOS_DOS, 0, 300_000_000).saldo).toBe(0);
    expect(resumenDelPasaje(null, 0, 300_000_000).saldo).toBeNull();
  });

  it('el pago entra en el mismo guardado que la aprobación, con la fecha de inicio', () => {
    const { pedido } = guardadoDelPasaje(
      CONTACTO,
      [],
      valores({ presupuesto: LOS_DOS, sena: 115_000_000, inicio: '2026-09-20' }),
      HOY,
      PAGO,
    );

    expect(pedido.pagos).toEqual([
      { id: PAGO, fecha: '2026-09-20', concepto: 'Seña', monto_centavos: 115_000_000 },
    ]);
    expect(pedido.datos).toMatchObject({ estado: 'en_curso', fecha_inicio: '2026-09-20' });
  });

  it('con opciones, el pago viaja junto con la opción que se aprueba', () => {
    const opciones = [opcion('a', SOLO_ALAN), opcion('b', LOS_DOS)];

    const { pedido } = guardadoDelPasaje(
      CONTACTO,
      opciones,
      valores({ opcion: 'b', sena: 1_000 }),
      HOY,
      PAGO,
    );

    expect(pedido.pagos).toEqual([
      { id: PAGO, fecha: HOY, concepto: 'Seña', monto_centavos: 1_000 },
    ]);
    expect(pedido.opciones).toEqual([
      { id: 'a', descripcion: 'Opción a', monto_centavos: SOLO_ALAN, aprobada: false },
      { id: 'b', descripcion: 'Opción b', monto_centavos: LOS_DOS, aprobada: true },
    ]);
  });

  it('sin seña sigue pasando sin pagos, como hasta ahora', () => {
    expect(
      guardadoDelPasaje(CONTACTO, [], valores({ presupuesto: 1 }), HOY, PAGO).pedido.pagos,
    ).toEqual([]);
    expect(
      guardadoDelPasaje(CONTACTO, [], valores({ presupuesto: 1, sena: 0 }), HOY, PAGO).pedido.pagos,
    ).toEqual([]);
  });

  it('sin fecha de inicio, el pago queda con el día de hoy', () => {
    const { pedido } = guardadoDelPasaje(
      CONTACTO,
      [],
      valores({ presupuesto: 1, sena: 500, inicio: '' }),
      HOY,
      PAGO,
    );

    expect(pedido.pagos).toEqual([{ id: PAGO, fecha: HOY, concepto: 'Seña', monto_centavos: 500 }]);
    expect(pedido.datos.fecha_inicio).toBeNull();
  });
});

describe('con qué forma de pago arranca la seña al aprobar', () => {
  it('con una sola forma configurada, arranca en esa', () => {
    expect(formaSugerida(null, ['efectivo'])).toBe('efectivo');
    expect(formaSugerida(null, ['transferencia'])).toBe('transferencia');
  });

  it('con las dos, la elige él: arranca como hasta ahora', () => {
    expect(formaSugerida(null, ['transferencia', 'efectivo'])).toBe('transferencia');
  });

  it('lo que el trabajo ya tenía guardado manda: no se lo pisa', () => {
    expect(formaSugerida('cuotas', ['efectivo'])).toBe('cuotas');
    expect(formaSugerida('mixto', ['transferencia'])).toBe('mixto');
  });
});
