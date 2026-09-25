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

describe('hasta cuándo vale el presupuesto, en el formulario grande', () => {
  const HOY = '2026-09-24';

  it('no se muestra, pero guardar la conserva', () => {
    const valores = valoresDelFormulario(
      proyecto({ estado: 'presupuesto_enviado', presupuesto_vale_hasta: '2026-10-09' }),
      [],
      [],
      [],
      { hoy: HOY },
    );
    expect(datosDelFormulario(valores, HOY).presupuesto_vale_hasta).toBe('2026-10-09');
  });

  it('un trabajo nuevo y una fila de antes de la columna arrancan sin fecha', () => {
    expect(
      datosDelFormulario(valoresDelFormulario(undefined, [], [], [], { hoy: HOY }), HOY)
        .presupuesto_vale_hasta,
    ).toBeNull();
    const vieja = proyecto();
    delete (vieja as Partial<FilaDe<'proyectos'>>).presupuesto_vale_hasta;
    expect(valoresDelFormulario(vieja, [], [], [], { hoy: HOY }).presupuesto_vale_hasta).toBe('');
  });
});

describe('el tipo de proyecto en el formulario grande', () => {
  const HOY = '2026-09-25';

  it('va y vuelve sin blancos en las puntas, y vacío se guarda como sin tipo', () => {
    const valores = valoresDelFormulario(proyecto({ tipo_de_proyecto: 'Placard' }), [], [], [], {
      hoy: HOY,
    });
    expect(valores.tipo_de_proyecto).toBe('Placard');
    expect(datosDelFormulario({ ...valores, tipo_de_proyecto: '  Cocina ' }, HOY)).toMatchObject({
      tipo_de_proyecto: 'Cocina',
    });
    expect(datosDelFormulario({ ...valores, tipo_de_proyecto: '   ' }, HOY).tipo_de_proyecto).toBe(
      null,
    );
  });

  it('un trabajo nuevo y una fila de antes de la columna arrancan sin tipo', () => {
    expect(valoresDelFormulario(undefined, [], [], [], { hoy: HOY }).tipo_de_proyecto).toBe('');
    const vieja = proyecto();
    delete (vieja as Partial<FilaDe<'proyectos'>>).tipo_de_proyecto;
    expect(valoresDelFormulario(vieja, [], [], [], { hoy: HOY }).tipo_de_proyecto).toBe('');
  });

  it('listo y la comprometida no pasan por el formulario', () => {
    const datos = datosDelFormulario(
      valoresDelFormulario(
        proyecto({
          estado: 'en_curso',
          listo_el: '2026-09-24',
          entrega_comprometida: '2026-10-08',
        }),
        [],
        [],
        [],
        { hoy: HOY },
      ),
      HOY,
    );
    expect(Object.keys(datos)).not.toContain('listo_el');
    expect(Object.keys(datos)).not.toContain('entrega_comprometida');
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
    cobro_sena: null,
    cobro_saldo: null,
    comprobante: 'sin_comprobante',
    fecha_visita: '2026-09-10',
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
