import { describe, expect, it } from 'vitest';

import type { FilaDe } from '@/shared/api';

import {
  CONCEPTO_DE_LA_SENA,
  erroresDelContacto,
  hayQueGuardar,
  muestraLaVigencia,
  ofreceMarcarLaVisita,
  pedidoDelContacto,
  senaEditable,
  valoresConOtraVisita,
  valoresDelContacto,
  type ValoresDelContacto,
} from './contacto';

const HOY = '2026-09-12';

function valores(extra: Partial<ValoresDelContacto> = {}): ValoresDelContacto {
  return {
    clienteId: 'c',
    titulo: 'Placard',
    visita: '',
    visitaHora: '',
    visitaHecha: false,
    sena: null,
    diaDeLaSena: null,
    senaEnLaApertura: true,
    notas: '',
    vencimiento: '',
    valeHasta: '',
    ...extra,
  };
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
    sena_bp: null,
    forma_pago: null,
    cobro_sena: null,
    cobro_saldo: null,
    comprobante: 'sin_comprobante',
    fecha_visita: null,
    visita_hora: null,
    ultimo_contacto: null,
    fecha_inicio: null,
    entrega_estimada: null,
    entrega_hora: null,
    fecha_entrega: null,
    direccion_entrega: '',
    notas: '',
    vencimiento_presupuesto: null,
    costo_madera_centavos: null,
    costo_herrajes_centavos: null,
    costo_flete_centavos: null,
    costo_ayudante_centavos: null,
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
    reparto_ya_en_la_apertura: false,
    presupuesto_vale_hasta: null,
    listo_el: null,
    entrega_comprometida: null,
    entrega_comprometida_franja: null,
    tipo_de_proyecto: null,
    presupuesto_diseno: false,
    presupuesto_despiece: false,
    presupuesto_cotizacion: false,
    presupuesto_pdf: false,
    visita_hecha: false,
    visita_importante: false,
    entrega_importante: false,
    presupuesto_importante: false,
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
    ya_en_la_apertura: false,
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
        ya_en_la_apertura: false,
      },
    ]);
  });

  it('la seña entra con el día que se elija, y si es de antes de la apertura queda marcada', () => {
    const pedido = pedidoDelContacto({
      id: 'p',
      proyecto: undefined,
      valores: valores({ visita: '2026-09-10', sena: 15_000_000, diaDeLaSena: '2026-07-02' }),
      sena: undefined,
      idDeSenaNueva: 'nueva',
      hoy: HOY,
      apertura: '2026-09-11',
    });
    expect(pedido.pagos[0]).toMatchObject({ fecha: '2026-07-02', ya_en_la_apertura: true });

    const destildada = pedidoDelContacto({
      id: 'p',
      proyecto: undefined,
      valores: valores({
        sena: 15_000_000,
        diaDeLaSena: '2026-07-02',
        senaEnLaApertura: false,
      }),
      sena: undefined,
      idDeSenaNueva: 'nueva',
      hoy: HOY,
      apertura: '2026-09-11',
    });
    expect(destildada.pagos[0]).toMatchObject({ ya_en_la_apertura: false });
  });

  it('corregir el día de una seña ya cargada la manda de nuevo, con el mismo id', () => {
    const fila = proyecto({ estado: 'a_presupuestar' });
    const pedido = pedidoDelContacto({
      id: 'p',
      proyecto: fila,
      valores: { ...valoresDelContacto(fila, pago()), diaDeLaSena: '2026-09-05' },
      sena: pago(),
      idDeSenaNueva: 'x',
      hoy: HOY,
    });
    expect(pedido.pagos).toEqual([
      {
        id: 'sena',
        fecha: '2026-09-05',
        concepto: CONCEPTO_DE_LA_SENA,
        monto_centavos: 15_000_000,
        ya_en_la_apertura: false,
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
        ya_en_la_apertura: false,
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

describe('valoresDelContacto', () => {
  it('un contacto nuevo que llega desde la agenda trae la visita de ese día, y si no, arranca vacío', () => {
    expect(valoresDelContacto(undefined, undefined, '2026-09-15').visita).toBe('2026-09-15');
    expect(valoresDelContacto(undefined, undefined).visita).toBe('');
  });

  it('la visita que trae viaja en el pedido como fecha de la visita', () => {
    const pedido = pedidoDelContacto({
      id: 'p',
      proyecto: undefined,
      valores: {
        ...valoresDelContacto(undefined, undefined, '2026-09-15'),
        clienteId: 'c',
        titulo: 'Vestidor',
      },
      sena: undefined,
      idDeSenaNueva: 'x',
      hoy: HOY,
    });
    expect(pedido.datos.fecha_visita).toBe('2026-09-15');
  });
});

describe('la visita hecha en la hoja del contacto', () => {
  function pedido(
    proyectoActual: FilaDe<'proyectos'> | undefined,
    extra: Partial<ValoresDelContacto>,
  ) {
    return pedidoDelContacto({
      id: 'p',
      proyecto: proyectoActual,
      valores: valores(extra),
      sena: undefined,
      idDeSenaNueva: 'x',
      hoy: HOY,
    });
  }

  it('cargar un contacto con la visita ya pasada la deja hecha; con la visita de hoy o por venir queda agendada, y sin visita, no', () => {
    expect(pedido(undefined, { visita: '2026-09-10' }).datos.visita_hecha).toBe(true);
    expect(pedido(undefined, { visita: HOY }).datos).toMatchObject({
      estado: 'relevamiento',
      visita_hecha: false,
    });
    expect(pedido(undefined, { visita: '2026-09-20' }).datos.visita_hecha).toBe(false);
    expect(pedido(undefined, {}).datos.visita_hecha).toBe(false);
  });

  it('ponerle una fecha pasada a un contacto sin etapa lo pasa a presupuestar con la visita hecha', () => {
    expect(pedido(proyecto(), { visita: '2026-09-11' }).datos).toMatchObject({
      estado: 'a_presupuestar',
      visita_hecha: true,
    });
  });

  it('abrir la hoja trae la visita hecha, guardar sin tocarla no manda nada, y destildarla la apaga', () => {
    const fila = proyecto({
      estado: 'relevamiento',
      fecha_visita: '2026-09-10',
      visita_hecha: true,
    });
    const abiertos = valoresDelContacto(fila, undefined);
    expect(abiertos.visitaHecha).toBe(true);

    const igual = pedido(fila, abiertos);
    expect(igual.datos.visita_hecha).toBe(true);
    expect(hayQueGuardar(fila, igual)).toBe(false);

    const destildada = pedido(fila, { ...abiertos, visitaHecha: false });
    expect(destildada.datos).toMatchObject({ estado: 'relevamiento', visita_hecha: false });
    expect(hayQueGuardar(fila, destildada)).toBe(true);
  });

  it('mover la visita a un día que todavía no llegó, o borrarla, la apaga; corregirla a otro día pasado, no', () => {
    const fila = proyecto({
      estado: 'presupuesto_enviado',
      fecha_visita: '2026-09-10',
      visita_hecha: true,
    });
    const abiertos = valoresDelContacto(fila, undefined);

    expect(valoresConOtraVisita(fila, abiertos, '2026-09-08', HOY).visitaHecha).toBe(true);
    expect(valoresConOtraVisita(fila, abiertos, '2026-09-20', HOY).visitaHecha).toBe(false);
    expect(valoresConOtraVisita(fila, abiertos, '', HOY).visitaHecha).toBe(false);
    expect(pedido(fila, { ...abiertos, visita: '2026-09-20' }).datos.visita_hecha).toBe(false);
  });

  it('la casilla aparece en un contacto que ya avanzó y con la visita ya pasada', () => {
    const avanzado = proyecto({ estado: 'a_presupuestar' });
    expect(ofreceMarcarLaVisita(avanzado, valores({ visita: '2026-09-10' }), HOY)).toBe(true);
    expect(ofreceMarcarLaVisita(avanzado, valores({ visita: '2026-09-20' }), HOY)).toBe(false);
    expect(ofreceMarcarLaVisita(avanzado, valores({ visita: '' }), HOY)).toBe(false);
    expect(ofreceMarcarLaVisita(proyecto(), valores({ visita: '2026-09-10' }), HOY)).toBe(false);
    expect(ofreceMarcarLaVisita(undefined, valores({ visita: '2026-09-10' }), HOY)).toBe(false);
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
    expect(erroresDelContacto(valores({ clienteId: '', titulo: ' ' }), '', HOY)).toEqual({
      cliente: 'Elegí un cliente, o escribí su nombre para crearlo.',
      titulo: 'Contá qué pide, aunque sea en dos palabras.',
    });
    expect(erroresDelContacto(valores(), '', HOY)).toEqual({});
  });

  it('la seña ya llega en centavos, así que no hay seña mal escrita que frenar, y cero es no tener seña', () => {
    expect(erroresDelContacto(valores({ sena: 0 }), '', HOY)).toEqual({});
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

  it('una seña con un día que todavía no llegó no se guarda', () => {
    expect(
      erroresDelContacto(valores({ sena: 1_000, diaDeLaSena: '2026-09-13' }), '', HOY),
    ).toEqual({ diaDeLaSena: 'Esa fecha todavía no llegó: tiene que ser hoy o antes.' });
    expect(erroresDelContacto(valores({ sena: 1_000, diaDeLaSena: '' }), '', HOY)).toEqual({
      diaDeLaSena: 'Poné el día en que entró la plata.',
    });
    expect(erroresDelContacto(valores({ sena: 1_000, visita: '2026-09-20' }), '', HOY)).toEqual({});
  });
});

describe('hasta cuándo vale el presupuesto, en la hoja del contacto', () => {
  const mandado = proyecto({ estado: 'presupuesto_enviado', presupuesto_vale_hasta: '2026-09-27' });

  function pedidoCon(fila: FilaDe<'proyectos'>, cambios: Partial<ValoresDelContacto> = {}) {
    return pedidoDelContacto({
      id: 'p',
      proyecto: fila,
      valores: { ...valoresDelContacto(fila, undefined), ...cambios },
      sena: undefined,
      idDeSenaNueva: 'nueva',
      hoy: HOY,
    });
  }

  it('el campo aparece solo con el presupuesto mandado', () => {
    expect(muestraLaVigencia(mandado)).toBe(true);
    expect(muestraLaVigencia(proyecto({ estado: 'a_presupuestar' }))).toBe(false);
    expect(muestraLaVigencia(undefined)).toBe(false);
  });

  it('abre con la fecha guardada, y guardar sin tocarla no manda nada', () => {
    expect(valoresDelContacto(mandado, undefined).valeHasta).toBe('2026-09-27');
    const pedido = pedidoCon(mandado);
    expect(pedido.datos.presupuesto_vale_hasta).toBe('2026-09-27');
    expect(hayQueGuardar(mandado, pedido)).toBe(false);
  });

  it('cambiarla la manda, y borrarla deja el presupuesto sin fecha', () => {
    expect(pedidoCon(mandado, { valeHasta: '2026-10-15' }).datos.presupuesto_vale_hasta).toBe(
      '2026-10-15',
    );
    expect(pedidoCon(mandado, { valeHasta: '' }).datos.presupuesto_vale_hasta).toBeNull();
  });

  it('en otra etapa el campo no está, y lo que haya guardado queda como estaba', () => {
    const relevado = proyecto({ estado: 'a_presupuestar', presupuesto_vale_hasta: '2026-08-01' });
    expect(pedidoCon(relevado, { valeHasta: '2026-12-31' }).datos.presupuesto_vale_hasta).toBe(
      '2026-08-01',
    );
  });

  it('una fila guardada antes de la columna abre sin fecha y, sin tocarla, no manda la clave', () => {
    const vieja: Partial<FilaDe<'proyectos'>> = { ...proyecto({ estado: 'presupuesto_enviado' }) };
    delete vieja.presupuesto_vale_hasta;
    const fila = vieja as FilaDe<'proyectos'>;

    expect(valoresDelContacto(fila, undefined).valeHasta).toBe('');
    expect(JSON.stringify(pedidoCon(fila).datos)).not.toContain('presupuesto_vale_hasta');
  });
});
