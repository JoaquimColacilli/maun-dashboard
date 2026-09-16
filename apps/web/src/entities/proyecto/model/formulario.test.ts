import { describe, expect, it } from 'vitest';

import type { FilaDe } from '@/shared/api';

import { datosActualesDelProyecto } from './liquidacion';
import {
  cambiaLaFila,
  datosDelFormulario,
  valoresDelFormulario,
  versionDelGuardado,
} from './formulario';

describe('valoresDelFormulario', () => {
  it('un proyecto nuevo que llega desde la agenda trae la entrega estimada de ese día, y si no, arranca vacío', () => {
    expect(
      valoresDelFormulario(undefined, [], [], [], { hoy: '2026-09-14', entrega: '2026-10-01' })
        .entrega_estimada,
    ).toBe('2026-10-01');
    expect(
      valoresDelFormulario(undefined, [], [], [], { hoy: '2026-09-14' }).entrega_estimada,
    ).toBe('');
  });
});

describe('la visita hecha en el formulario grande', () => {
  const HOY = '2026-09-14';

  it('se conserva al guardar, aunque el formulario no la muestre', () => {
    const valores = valoresDelFormulario(proyecto({ visita_hecha: true }), [], [], [], {
      hoy: HOY,
    });
    expect(valores.visita_hecha).toBe(true);
    expect(datosDelFormulario(valores, HOY).visita_hecha).toBe(true);
    expect(valoresDelFormulario(undefined, [], [], [], { hoy: HOY }).visita_hecha).toBe(false);
  });

  it('se apaga si la visita se mueve a un día que todavía no llegó o se borra', () => {
    const valores = valoresDelFormulario(proyecto({ visita_hecha: true }), [], [], [], {
      hoy: HOY,
    });
    expect(datosDelFormulario({ ...valores, fecha_visita: '2026-09-20' }, HOY).visita_hecha).toBe(
      false,
    );
    expect(datosDelFormulario({ ...valores, fecha_visita: '' }, HOY).visita_hecha).toBe(false);
  });

  it('una fila guardada en el dispositivo antes de la columna arranca sin la visita hecha', () => {
    const vieja = proyecto();
    delete (vieja as Partial<FilaDe<'proyectos'>>).visita_hecha;
    expect(valoresDelFormulario(vieja, [], [], [], { hoy: HOY }).visita_hecha).toBe(false);
  });
});

function proyecto(extra: Partial<FilaDe<'proyectos'>> = {}): FilaDe<'proyectos'> {
  return {
    household_id: 'h',
    created_at: '2026-09-01T12:00:00Z',
    updated_at: '2026-09-01T12:00:00Z',
    deleted_at: null,
    version: 4,
    id: 'p',
    cliente_id: 'c',
    titulo: 'Placard',
    descripcion: '',
    estado: 'a_presupuestar',
    presupuesto_centavos: null,
    sena_bp: null,
    forma_pago: null,
    comprobante: 'sin_comprobante',
    fecha_visita: '2026-09-10',
    ultimo_contacto: null,
    fecha_inicio: null,
    entrega_estimada: null,
    fecha_entrega: null,
    direccion_entrega: '',
    notas: '',
    vencimiento_presupuesto: null,
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

describe('versionDelGuardado', () => {
  it('un alta arranca en la versión que le pone la base', () => {
    expect(versionDelGuardado(null, datosActualesDelProyecto(proyecto()))).toBe(1);
  });

  it('guardar la fila igual no sube la versión, porque la base tampoco la sube', () => {
    const fila = proyecto();
    expect(versionDelGuardado(fila, datosActualesDelProyecto(fila))).toBe(4);
  });

  it('cambiar una columna la sube en uno, igual que el trigger', () => {
    const fila = proyecto();
    expect(
      versionDelGuardado(fila, {
        ...datosActualesDelProyecto(fila),
        estado: 'presupuesto_enviado',
      }),
    ).toBe(5);
  });

  it('una edición parcial solo mira las columnas que manda', () => {
    const fila = proyecto({ notas: 'medir la pared' });
    expect(versionDelGuardado(fila, { notas: 'medir la pared' })).toBe(4);
    expect(versionDelGuardado(fila, { notas: 'medir la pared del fondo' })).toBe(5);
    expect(cambiaLaFila(fila, {})).toBe(false);
  });
});
