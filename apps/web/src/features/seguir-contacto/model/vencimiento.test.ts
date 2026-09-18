import { describe, expect, it } from 'vitest';

import type { FilaDe } from '@/shared/api';

import {
  etiquetaDeLaVisita,
  muestraElVencimiento,
  pedidoDelContacto,
  valoresConOtraVisita,
  type ValoresDelContacto,
} from './contacto';

const HOY = '2026-09-14';

function valores(extra: Partial<ValoresDelContacto> = {}): ValoresDelContacto {
  return {
    clienteId: 'c',
    titulo: 'Vestidor',
    visita: '',
    visitaHora: '',
    visitaHecha: false,
    sena: null,
    notas: '',
    vencimiento: '',
    ...extra,
  };
}

function contacto(extra: Partial<FilaDe<'proyectos'>> = {}): FilaDe<'proyectos'> {
  return {
    household_id: 'h',
    created_at: '2026-09-01T12:00:00Z',
    updated_at: '2026-09-01T12:00:00Z',
    deleted_at: null,
    version: 2,
    id: 'p',
    cliente_id: 'c',
    titulo: 'Vestidor',
    descripcion: '',
    estado: 'a_presupuestar',
    presupuesto_centavos: null,
    sena_bp: null,
    forma_pago: null,
    comprobante: 'sin_comprobante',
    fecha_visita: '2026-09-10',
    visita_hora: null,
    ultimo_contacto: '2026-09-10',
    fecha_inicio: null,
    entrega_estimada: null,
    entrega_hora: null,
    fecha_entrega: null,
    direccion_entrega: '',
    notas: '',
    vencimiento_presupuesto: '2026-09-17',
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

function pedido(proyecto: FilaDe<'proyectos'> | undefined, extra: Partial<ValoresDelContacto>) {
  return pedidoDelContacto({
    id: proyecto?.id ?? 'nuevo',
    proyecto,
    valores: valores(extra),
    sena: undefined,
    idDeSenaNueva: 'sena',
    hoy: HOY,
  });
}

describe('el vencimiento del presupuesto desde la hoja del contacto', () => {
  it('un contacto nuevo que ya fue relevado queda a presupuestar con la fecha límite propuesta', () => {
    const datos = pedido(undefined, { visita: '2026-09-11' }).datos;

    expect(datos.estado).toBe('a_presupuestar');
    expect(datos.vencimiento_presupuesto).toBe('2026-09-18');
  });

  it('un contacto nuevo sin visita, o con la visita más adelante, no tiene fecha límite', () => {
    expect(pedido(undefined, {}).datos.vencimiento_presupuesto).toBeNull();
    expect(pedido(undefined, { visita: '2026-09-20' }).datos.vencimiento_presupuesto).toBeNull();
  });

  it('la fecha que escribe manda, y dejarla vacía la saca', () => {
    const conFecha = contacto();

    expect(
      pedido(conFecha, { visita: '2026-09-10', vencimiento: '2026-09-22' }).datos
        .vencimiento_presupuesto,
    ).toBe('2026-09-22');
    expect(
      pedido(conFecha, { visita: '2026-09-10', vencimiento: '' }).datos.vencimiento_presupuesto,
    ).toBeNull();
  });

  it('el campo se ve mientras el presupuesto no se mandó, ni se mandó un estimativo', () => {
    expect(muestraElVencimiento(undefined)).toBe(false);
    expect(muestraElVencimiento(contacto({ estado: 'contacto' }))).toBe(true);
    expect(muestraElVencimiento(contacto({ estado: 'a_presupuestar' }))).toBe(true);
    expect(muestraElVencimiento(contacto({ estado: 'presupuesto_estimativo' }))).toBe(false);
    expect(muestraElVencimiento(contacto({ estado: 'presupuesto_enviado' }))).toBe(false);
    expect(muestraElVencimiento(contacto({ estado: 'en_curso' }))).toBe(false);
  });
});

describe('corregir el día del relevamiento después de marcarlo', () => {
  const armado = contacto();
  const enLaHoja = valores({ visita: '2026-09-10', vencimiento: '2026-09-17' });

  it('si el vencimiento era el propuesto, se corre con el día nuevo', () => {
    expect(valoresConOtraVisita(armado, enLaHoja, '2026-09-08', HOY)).toMatchObject({
      visita: '2026-09-08',
      vencimiento: '2026-09-15',
    });
  });

  it('si lo había puesto a mano, no lo toca', () => {
    const aMano = { ...enLaHoja, vencimiento: '2026-09-30' };
    expect(valoresConOtraVisita(armado, aMano, '2026-09-08', HOY)).toMatchObject({
      visita: '2026-09-08',
      vencimiento: '2026-09-30',
    });
  });

  it('una fecha a medio escribir o que todavía no llegó no mueve el vencimiento', () => {
    expect(valoresConOtraVisita(armado, enLaHoja, '', HOY).vencimiento).toBe('2026-09-17');
    expect(valoresConOtraVisita(armado, enLaHoja, '2026-09-20', HOY).vencimiento).toBe(
      '2026-09-17',
    );
  });

  it('sin vencimiento, el primer día válido lo propone', () => {
    const sinFecha = { ...enLaHoja, vencimiento: '' };
    expect(valoresConOtraVisita(armado, sinFecha, '2026-09-11', HOY).vencimiento).toBe(
      '2026-09-18',
    );
  });

  it('fuera de a presupuestar, cambiar la visita no inventa un vencimiento', () => {
    const agendado = contacto({ estado: 'relevamiento', vencimiento_presupuesto: null });
    const hoja = valores({ visita: '2026-09-20' });
    expect(valoresConOtraVisita(agendado, hoja, '2026-09-12', HOY).vencimiento).toBe('');
    expect(valoresConOtraVisita(undefined, hoja, '2026-09-12', HOY).vencimiento).toBe('');
  });

  it('la etiqueta dice relevamiento cuando la visita ya pasó y el contacto avanzó', () => {
    expect(etiquetaDeLaVisita(armado, HOY)).toBe('Día que fuiste a relevar');
    expect(etiquetaDeLaVisita(contacto({ estado: 'relevamiento' }), HOY)).toBe('Visita');
    expect(etiquetaDeLaVisita(contacto({ fecha_visita: '2026-09-20' }), HOY)).toBe('Visita');
    expect(etiquetaDeLaVisita(undefined, HOY)).toBe('Visita');
  });
});
