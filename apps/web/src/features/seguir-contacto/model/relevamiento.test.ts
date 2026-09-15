import { describe, expect, it } from 'vitest';

import type { Proyecto } from '@/entities/proyecto';

import { CONCEPTO_DE_LA_SENA } from './contacto';
import {
  cambiosAlPasarAPresupuestar,
  conOtroDia,
  conOtroVencimiento,
  errorDelDia,
  pagoAntesDePresupuestar,
  pasoDelRelevamiento,
  valoresDelRelevamiento,
} from './relevamiento';

const HOY = '2026-09-14';

function contacto(fechaVisita: string | null): Proyecto {
  return { estado: 'relevamiento', fecha_visita: fechaVisita } as unknown as Proyecto;
}

describe('el formulario de «Ya fui a relevar»', () => {
  it('arranca con el día de la visita si ya pasó, y con hoy si era para más adelante', () => {
    expect(valoresDelRelevamiento(contacto('2026-09-10'), HOY)).toEqual({
      dia: '2026-09-10',
      vencimiento: '2026-09-17',
      vencimientoAMano: false,
      pago: null,
    });
    expect(valoresDelRelevamiento(contacto('2026-09-18'), HOY).dia).toBe(HOY);
    expect(valoresDelRelevamiento(contacto(null), HOY)).toMatchObject({
      dia: HOY,
      vencimiento: '2026-09-21',
    });
  });

  it('cambiar el día corre el vencimiento hasta que se lo toca a mano', () => {
    const iniciales = valoresDelRelevamiento(contacto('2026-09-10'), HOY);
    const otroDia = conOtroDia(iniciales, '2026-09-07', HOY);
    expect(otroDia).toMatchObject({ dia: '2026-09-07', vencimiento: '2026-09-14' });

    const prometido = conOtroVencimiento(otroDia, '2026-09-25');
    expect(conOtroDia(prometido, '2026-09-11', HOY)).toMatchObject({
      dia: '2026-09-11',
      vencimiento: '2026-09-25',
      vencimientoAMano: true,
    });
  });

  it('un día a medio escribir o que todavía no llegó no mueve el vencimiento y no se puede anotar', () => {
    const iniciales = valoresDelRelevamiento(contacto('2026-09-10'), HOY);
    expect(conOtroDia(iniciales, '', HOY).vencimiento).toBe('2026-09-17');
    expect(conOtroDia(iniciales, '2026-09-20', HOY).vencimiento).toBe('2026-09-17');

    expect(errorDelDia({ ...iniciales, dia: '' }, HOY)).toBe('Poné el día que fuiste a relevar.');
    expect(errorDelDia({ ...iniciales, dia: '2026-09-20' }, HOY)).toMatch(/todavía no llegó/);
    expect(errorDelDia(iniciales, HOY)).toBeUndefined();
  });

  it('anotarlo pasa a presupuestar con el día, la visita hecha y el vencimiento, y la seña si la escribió', () => {
    const iniciales = valoresDelRelevamiento(contacto('2026-09-10'), HOY);
    expect(pasoDelRelevamiento(iniciales, 'pago')).toEqual({
      cambios: {
        estado: 'a_presupuestar',
        fecha_visita: '2026-09-10',
        visita_hecha: true,
        vencimiento_presupuesto: '2026-09-17',
      },
      pagos: [],
    });

    const conPago = pasoDelRelevamiento({ ...iniciales, pago: 3_000_000, vencimiento: '' }, 'pago');
    expect(conPago.cambios.vencimiento_presupuesto).toBeNull();
    expect(conPago.pagos).toEqual([
      {
        id: 'pago',
        fecha: '2026-09-10',
        concepto: CONCEPTO_DE_LA_SENA,
        monto_centavos: 3_000_000,
      },
    ]);
  });

  it('pasar a presupuestar desde el estimativo, con la visita ya pasada, la deja hecha; sin visita o con la visita por venir, no', () => {
    expect(cambiosAlPasarAPresupuestar(contacto('2026-09-10'), HOY)).toEqual({
      estado: 'a_presupuestar',
      visita_hecha: true,
    });
    expect(cambiosAlPasarAPresupuestar(contacto(HOY), HOY)).toMatchObject({ visita_hecha: true });
    expect(cambiosAlPasarAPresupuestar(contacto('2026-09-20'), HOY)).toEqual({
      estado: 'a_presupuestar',
    });
    expect(cambiosAlPasarAPresupuestar(contacto(null), HOY)).toEqual({ estado: 'a_presupuestar' });
  });

  it('pasar a presupuestar desde el estimativo lleva el pago de hoy si lo escribió, y cero es no tener pago', () => {
    expect(pagoAntesDePresupuestar(null, 'p', HOY)).toEqual([]);
    expect(pagoAntesDePresupuestar(0, 'p', HOY)).toEqual([]);
    expect(pagoAntesDePresupuestar(2_000_000, 'p', HOY)).toEqual([
      { id: 'p', fecha: HOY, concepto: CONCEPTO_DE_LA_SENA, monto_centavos: 2_000_000 },
    ]);
  });
});
