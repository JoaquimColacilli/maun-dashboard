import { describe, expect, it } from 'vitest';

import type { OpcionDePresupuesto, Proyecto } from '@/entities/proyecto';

import {
  errorDelPasaje,
  guardadoDelPasaje,
  presupuestoDelPasaje,
  type ValoresDelPasaje,
} from './pasaje';

const HOY = '2026-09-16';
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
    );

    expect(pedido.datos).toMatchObject({ estado: 'en_curso', presupuesto_centavos: LOS_DOS });
    expect(pedido.opciones).toEqual([
      { id: 'a', descripcion: 'Opción a', monto_centavos: SOLO_ALAN, aprobada: false },
      { id: 'b', descripcion: 'Opción b', monto_centavos: LOS_DOS, aprobada: true },
    ]);
    expect(pedido).toMatchObject({ id: 'p', version: 4, pagos: [], gastos: [] });
    expect(previos).toEqual({ proyecto: CONTACTO, pagos: [], gastos: [], opciones });
  });

  it('si ninguna estaba aprobada, aprueba la elegida al pasar', () => {
    const opciones = [opcion('a', SOLO_ALAN), opcion('b', LOS_DOS)];

    const { pedido } = guardadoDelPasaje(CONTACTO, opciones, valores({ opcion: 'a' }), HOY);

    expect(pedido.datos.presupuesto_centavos).toBe(SOLO_ALAN);
    expect(pedido.opciones).toEqual([
      { id: 'a', descripcion: 'Opción a', monto_centavos: SOLO_ALAN, aprobada: true },
      { id: 'b', descripcion: 'Opción b', monto_centavos: LOS_DOS, aprobada: false },
    ]);
  });
});
