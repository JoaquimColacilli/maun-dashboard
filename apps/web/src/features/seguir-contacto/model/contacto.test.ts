import { describe, expect, it } from 'vitest';

import type { FilaDe } from '@/shared/api';

import {
  CONCEPTO_DE_LA_SENA,
  erroresDelContacto,
  hayQueGuardar,
  pedidoDelContacto,
  senaEditable,
  valoresDelContacto,
  type ValoresDelContacto,
} from './contacto';

const HOY = '2026-09-12';

function valores(extra: Partial<ValoresDelContacto> = {}): ValoresDelContacto {
  return { clienteId: 'c', titulo: 'Placard', visita: '', sena: null, notas: '', ...extra };
}

function proyecto(extra: Partial<FilaDe<'proyectos'>> = {}): FilaDe<'proyectos'> {
  return {
    household_id: 'h',
    created_at: '2026-09-01T12:00:00Z',
    updated_at: '2026-09-01T12:00:00Z',
    deleted_at: null,
    version: 3,
    id: 'p',
    cliente_id: 'c',
    titulo: 'Placard',
    descripcion: '',
    estado: 'contacto',
    presupuesto_centavos: null,
    forma_pago: null,
    comprobante: 'sin_comprobante',
    fecha_visita: null,
    ultimo_contacto: null,
    fecha_inicio: null,
    entrega_estimada: null,
    fecha_entrega: null,
    direccion_entrega: '',
    notas: '',
    fecha_cobro: null,
    dist_cobrado_centavos: null,
    dist_gastos_centavos: null,
    dist_diezmo_bp: null,
    dist_tope_sueldo_centavos: null,
    dist_tope_fijos_centavos: null,
    dist_diezmo_centavos: null,
    dist_sueldo_centavos: null,
    dist_fijos_centavos: null,
    dist_remanente_centavos: null,
    dist_objetivo_sueldo_centavos: null,
    dist_objetivo_fijos_centavos: null,
    dist_sueldo_mensual: null,
    dist_sueldo_previo_centavos: null,
    dist_fijos_previo_centavos: null,
    dist_liquidado_at: null,
    reapertura_objetivo_sueldo_centavos: null,
    reapertura_objetivo_fijos_centavos: null,
    reapertura_sueldo_mensual: null,
    reapertura_fecha_cobro: null,
    ...extra,
  };
}

function pago(extra: Partial<FilaDe<'pagos'>> = {}): FilaDe<'pagos'> {
  return {
    household_id: 'h',
    created_at: '2026-09-08T12:00:00Z',
    updated_at: '2026-09-08T12:00:00Z',
    deleted_at: null,
    version: 1,
    id: 'sena',
    proyecto_id: 'p',
    fecha: '2026-09-08',
    concepto: CONCEPTO_DE_LA_SENA,
    monto_centavos: 15_000_000,
    ...extra,
  };
}

describe('pedidoDelContacto', () => {
  it('un contacto nuevo va sin presupuesto, sin seña y en la etapa de contacto', () => {
    const pedido = pedidoDelContacto({
      id: 'p',
      proyecto: undefined,
      valores: valores({ notas: '  lo llamó la hermana  ' }),
      sena: undefined,
      idDeSenaNueva: 'nueva',
      hoy: HOY,
    });

    expect(pedido.version).toBeNull();
    expect(pedido.datos).toMatchObject({
      cliente_id: 'c',
      titulo: 'Placard',
      estado: 'contacto',
      presupuesto_centavos: null,
      fecha_visita: null,
      ultimo_contacto: HOY,
      notas: 'lo llamó la hermana',
    });
    expect(pedido.pagos).toEqual([]);
    expect(pedido.gastos).toEqual([]);
  });

  it('la seña cobrada en una visita que ya pasó entra con la fecha de la visita y queda a presupuestar', () => {
    const pedido = pedidoDelContacto({
      id: 'p',
      proyecto: undefined,
      valores: valores({ visita: '2026-09-10', sena: 15_000_000 }),
      sena: undefined,
      idDeSenaNueva: 'nueva',
      hoy: HOY,
    });

    expect(pedido.datos.estado).toBe('a_presupuestar');
    expect(pedido.datos.ultimo_contacto).toBe('2026-09-10');
    expect(pedido.pagos).toEqual([
      {
        id: 'nueva',
        fecha: '2026-09-10',
        concepto: CONCEPTO_DE_LA_SENA,
        monto_centavos: 15_000_000,
      },
    ]);
  });

  it('una seña cobrada antes de una visita que todavía no pasó entra con la fecha de hoy', () => {
    const pedido = pedidoDelContacto({
      id: 'p',
      proyecto: undefined,
      valores: valores({ visita: '2026-09-20', sena: 5_000_000 }),
      sena: undefined,
      idDeSenaNueva: 'nueva',
      hoy: HOY,
    });
    expect(pedido.datos.estado).toBe('relevamiento');
    expect(pedido.datos.ultimo_contacto).toBe(HOY);
    expect(pedido.pagos[0]).toMatchObject({ fecha: HOY, monto_centavos: 5_000_000 });
  });

  it('corregir las notas no mueve el último contacto; ponerle fecha a la visita, sí', () => {
    const quieto = proyecto({ estado: 'presupuesto_enviado', ultimo_contacto: '2026-09-01' });
    const notas = pedidoDelContacto({
      id: 'p',
      proyecto: quieto,
      valores: valores({ notas: 'le gusta el roble' }),
      sena: undefined,
      idDeSenaNueva: 'x',
      hoy: HOY,
    });
    expect(notas.datos.ultimo_contacto).toBe('2026-09-01');

    const conVisita = pedidoDelContacto({
      id: 'p',
      proyecto: proyecto({ ultimo_contacto: '2026-09-01' }),
      valores: valores({ visita: '2026-09-11' }),
      sena: undefined,
      idDeSenaNueva: 'x',
      hoy: HOY,
    });
    expect(conVisita.datos).toMatchObject({
      estado: 'a_presupuestar',
      ultimo_contacto: '2026-09-11',
    });
  });

  it('editar el monto de la seña es el mismo pago, con el mismo id', () => {
    const fila = proyecto({ estado: 'a_presupuestar' });
    const pedido = pedidoDelContacto({
      id: 'p',
      proyecto: fila,
      valores: valores({ sena: 18_000_000 }),
      sena: pago(),
      idDeSenaNueva: 'no-se-usa',
      hoy: HOY,
    });

    expect(pedido.version).toBe(3);
    expect(pedido.pagos).toEqual([
      {
        id: 'sena',
        fecha: '2026-09-08',
        concepto: CONCEPTO_DE_LA_SENA,
        monto_centavos: 18_000_000,
      },
    ]);
  });

  it('la seña que no cambió no viaja, y la que se borra viaja marcada', () => {
    const fila = proyecto({ estado: 'a_presupuestar' });
    const igual = pedidoDelContacto({
      id: 'p',
      proyecto: fila,
      valores: valoresDelContacto(fila, pago()),
      sena: pago(),
      idDeSenaNueva: 'x',
      hoy: HOY,
    });
    expect(igual.pagos).toEqual([]);
    expect(hayQueGuardar(fila, igual)).toBe(false);

    const sinSena = pedidoDelContacto({
      id: 'p',
      proyecto: fila,
      valores: valores({ sena: null }),
      sena: pago(),
      idDeSenaNueva: 'x',
      hoy: HOY,
    });
    expect(sinSena.pagos).toEqual([{ id: 'sena', borrado: true }]);
    expect(hayQueGuardar(fila, sinSena)).toBe(true);
  });

  it('editar un contacto conserva lo que el formulario liviano no muestra', () => {
    const fila = proyecto({
      estado: 'presupuesto_enviado',
      presupuesto_centavos: 90_000_000,
      direccion_entrega: 'Belgrano 123',
    });
    const pedido = pedidoDelContacto({
      id: 'p',
      proyecto: fila,
      valores: valores({ titulo: 'Placard y vanitory' }),
      sena: undefined,
      idDeSenaNueva: 'x',
      hoy: HOY,
    });
    expect(pedido.datos).toMatchObject({
      estado: 'presupuesto_enviado',
      presupuesto_centavos: 90_000_000,
      direccion_entrega: 'Belgrano 123',
      titulo: 'Placard y vanitory',
    });
  });
});

describe('senaEditable', () => {
  it('solo es editable desde acá cuando hay un pago, no ninguno ni varios', () => {
    expect(senaEditable([])).toBeUndefined();
    expect(senaEditable([pago()])?.id).toBe('sena');
    expect(senaEditable([pago(), pago({ id: 'otro' })])).toBeUndefined();
  });
});

describe('erroresDelContacto', () => {
  it('pide cliente y qué pide, y nada más es obligatorio', () => {
    expect(erroresDelContacto(valores({ clienteId: '', titulo: ' ' }), '')).toEqual({
      cliente: 'Elegí un cliente, o escribí su nombre para crearlo.',
      titulo: 'Contá qué pide, aunque sea en dos palabras.',
    });
    expect(erroresDelContacto(valores(), '')).toEqual({});
  });

  it('la seña ya llega en centavos, así que no hay seña mal escrita que frenar, y cero es no tener seña', () => {
    expect(erroresDelContacto(valores({ sena: 0 }), '')).toEqual({});
    const pedido = pedidoDelContacto({
      id: 'p',
      proyecto: undefined,
      valores: valores({ sena: 0 }),
      sena: undefined,
      idDeSenaNueva: 'nueva',
      hoy: HOY,
    });
    expect(pedido.pagos).toEqual([]);
  });
});
