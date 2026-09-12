import { describe, expect, it } from 'vitest';

import { TABLAS_REPLICADAS, type FilaDe, type Replica, type TablaReplicada } from '@/shared/api';

import { resumenesDeProyectos } from './resumen';
import {
  contactosEnOrden,
  etapaAlGuardarElContacto,
  pasoSiguiente,
  situacionDelContacto,
  ultimasActividades,
  ultimoContactoAlGuardar,
} from './seguimiento';

type Proyecto = FilaDe<'proyectos'>;

const HOY = '2026-09-12';

function marca(dia: string): string {
  return `${dia}T12:00:00Z`;
}

function proyecto(id: string, extra: Partial<Proyecto> = {}): Proyecto {
  return {
    household_id: 'h',
    created_at: marca('2026-01-01'),
    updated_at: marca('2026-09-12'),
    deleted_at: null,
    version: 1,
    id,
    cliente_id: 'c',
    titulo: id,
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

function pago(id: string, proyectoId: string, actualizado: string): FilaDe<'pagos'> {
  return {
    household_id: 'h',
    created_at: actualizado,
    updated_at: actualizado,
    deleted_at: null,
    version: 1,
    id,
    proyecto_id: proyectoId,
    fecha: '2026-09-01',
    concepto: 'Seña',
    monto_centavos: 15_000_000,
  };
}

function replicaCon(filas: Partial<Record<TablaReplicada, { id: string }[]>>): Replica {
  const tablas = {} as Record<TablaReplicada, Record<string, unknown>>;
  for (const tabla of TABLAS_REPLICADAS) {
    tablas[tabla] = Object.fromEntries((filas[tabla] ?? []).map((fila) => [fila.id, fila]));
  }
  return { usuarioId: 'u', cursor: '', reconciliadoEn: '', tablas } as unknown as Replica;
}

describe('situacionDelContacto', () => {
  it('un presupuesto enviado hace nueve días dice que falta llamar y que no hubo respuesta', () => {
    const situacion = situacionDelContacto(
      proyecto('p', { estado: 'presupuesto_enviado' }),
      marca('2026-09-03'),
      HOY,
    );
    expect(situacion).toEqual({
      proximoPaso: 'Falta llamar para saber',
      espera: 'Presupuesto enviado hace 9 días, sin respuesta',
      dias: 9,
      fria: true,
      agendada: false,
    });
  });

  it('un presupuesto enviado hoy todavía no espera respuesta', () => {
    const situacion = situacionDelContacto(
      proyecto('p', { estado: 'presupuesto_enviado' }),
      marca(HOY),
      HOY,
    );
    expect(situacion.espera).toBe('Presupuesto enviado hoy');
    expect(situacion.fria).toBe(false);
  });

  it('a presupuestar y contacto cuentan desde cuándo están quietos', () => {
    expect(
      situacionDelContacto(proyecto('p', { estado: 'a_presupuestar' }), marca('2026-09-11'), HOY),
    ).toMatchObject({ proximoPaso: 'Falta presupuestar', espera: 'A presupuestar desde ayer' });

    expect(situacionDelContacto(proyecto('p'), marca(HOY), HOY)).toMatchObject({
      proximoPaso: 'Falta agendar la visita',
      espera: 'Contacto desde hoy, sin visita agendada',
      dias: 0,
    });

    expect(situacionDelContacto(proyecto('p'), marca('2026-09-06'), HOY).espera).toBe(
      'Contacto desde hace 6 días, sin visita agendada',
    );
  });

  it('se enfría a los siete días, no antes', () => {
    expect(situacionDelContacto(proyecto('p'), marca('2026-09-06'), HOY).fria).toBe(false);
    expect(situacionDelContacto(proyecto('p'), marca('2026-09-05'), HOY).fria).toBe(true);
  });

  it('pasado el mes lo dice en meses', () => {
    expect(situacionDelContacto(proyecto('p'), marca('2026-07-01'), HOY).espera).toBe(
      'Contacto desde hace 2 meses, sin visita agendada',
    );
  });

  it('una marca adelantada por el reloj de otro dispositivo cuenta como hoy', () => {
    expect(situacionDelContacto(proyecto('p'), marca('2026-09-14'), HOY).dias).toBe(0);
  });

  it('una visita agendada no está esperando: dice cuándo hay que ir', () => {
    const situacion = situacionDelContacto(
      proyecto('p', { estado: 'relevamiento', fecha_visita: '2026-09-18' }),
      marca('2026-08-01'),
      HOY,
    );
    expect(situacion).toMatchObject({
      proximoPaso: 'Ir a relevar el vie 18 sep',
      espera: 'Visita en 6 días',
      agendada: true,
      fria: false,
    });
  });

  it('la visita de hoy y la que ya pasó piden algo distinto', () => {
    expect(
      situacionDelContacto(
        proyecto('p', { estado: 'relevamiento', fecha_visita: HOY }),
        marca(HOY),
        HOY,
      ),
    ).toMatchObject({
      proximoPaso: 'Ir a relevar hoy',
      espera: 'La visita es hoy',
      agendada: false,
    });

    expect(
      situacionDelContacto(
        proyecto('p', { estado: 'relevamiento', fecha_visita: '2026-09-08' }),
        marca('2026-09-08'),
        HOY,
      ),
    ).toMatchObject({
      proximoPaso: 'Falta pasar lo relevado a presupuestar',
      espera: 'La visita fue hace 4 días',
    });
  });

  it('con el último contacto anotado, la espera cuenta desde ahí y no desde la última edición', () => {
    const situacion = situacionDelContacto(
      proyecto('p', { estado: 'presupuesto_enviado', ultimo_contacto: '2026-09-03' }),
      marca(HOY),
      HOY,
    );
    expect(situacion).toMatchObject({
      espera: 'Presupuesto enviado hace 9 días, sin respuesta',
      dias: 9,
      fria: true,
    });
  });

  it('un relevamiento sin fecha pide ponérsela', () => {
    expect(
      situacionDelContacto(proyecto('p', { estado: 'relevamiento' }), marca(HOY), HOY),
    ).toMatchObject({
      proximoPaso: 'Falta ponerle fecha a la visita',
      espera: 'Relevamiento desde hoy, sin fecha de visita',
    });
  });
});

describe('ultimasActividades', () => {
  it('un pago o un gasto más nuevo que la fila mueve la última actividad del contacto', () => {
    const replica = replicaCon({
      proyectos: [proyecto('p', { updated_at: marca('2026-09-01') })],
      pagos: [pago('g', 'p', marca('2026-09-10'))],
    });
    expect(ultimasActividades(replica).get('p')).toBe(marca('2026-09-10'));
  });
});

describe('contactosEnOrden', () => {
  it('primero lo que hace más que espera, después lo agendado por fecha de visita, y nada de obra', () => {
    const replica = replicaCon({
      proyectos: [
        proyecto('nuevo', { updated_at: marca('2026-09-10') }),
        proyecto('viejo', { estado: 'a_presupuestar', updated_at: marca('2026-09-03') }),
        proyecto('visita-lejos', {
          estado: 'relevamiento',
          fecha_visita: '2026-09-20',
          updated_at: marca('2026-08-01'),
        }),
        proyecto('visita-cerca', {
          estado: 'relevamiento',
          fecha_visita: '2026-09-15',
          updated_at: marca('2026-09-12'),
        }),
        proyecto('obra', { estado: 'en_curso', updated_at: marca('2026-01-01') }),
        proyecto('perdido', { estado: 'perdido', updated_at: marca('2026-01-01') }),
      ],
    });

    const orden = contactosEnOrden(resumenesDeProyectos(replica, HOY), replica, HOY).map(
      (contacto) => contacto.resumen.proyecto.id,
    );
    expect(orden).toEqual(['viejo', 'nuevo', 'visita-cerca', 'visita-lejos']);
  });

  it('cargarle la seña a un contacto viejo lo manda al fondo', () => {
    const replica = replicaCon({
      proyectos: [
        proyecto('a', { updated_at: marca('2026-09-01') }),
        proyecto('b', { updated_at: marca('2026-09-05') }),
      ],
      pagos: [pago('g', 'a', marca('2026-09-11'))],
    });
    const orden = contactosEnOrden(resumenesDeProyectos(replica, HOY), replica, HOY).map(
      (contacto) => contacto.resumen.proyecto.id,
    );
    expect(orden).toEqual(['b', 'a']);
  });

  it('ordena por el día del último contacto, y dentro del mismo día por la última actividad', () => {
    const replica = replicaCon({
      proyectos: [
        proyecto('sin-anotar', { updated_at: marca('2026-09-08') }),
        proyecto('corregido-hoy', {
          estado: 'presupuesto_enviado',
          ultimo_contacto: '2026-09-05',
          updated_at: marca(HOY),
        }),
        proyecto('mismo-dia', {
          ultimo_contacto: '2026-09-08',
          updated_at: '2026-09-08T09:00:00Z',
        }),
      ],
    });
    const orden = contactosEnOrden(resumenesDeProyectos(replica, HOY), replica, HOY).map(
      (contacto) => contacto.resumen.proyecto.id,
    );
    expect(orden).toEqual(['corregido-hoy', 'mismo-dia', 'sin-anotar']);
  });

  it('con la misma marca el desempate es estable, por id', () => {
    const replica = replicaCon({ proyectos: [proyecto('z'), proyecto('a'), proyecto('m')] });
    const orden = contactosEnOrden(resumenesDeProyectos(replica, HOY), replica, HOY).map(
      (contacto) => contacto.resumen.proyecto.id,
    );
    expect(orden).toEqual(['a', 'm', 'z']);
  });
});

describe('etapaAlGuardarElContacto', () => {
  it('un contacto nuevo toma la etapa de la fecha de la visita', () => {
    expect(etapaAlGuardarElContacto(undefined, '', HOY)).toBe('contacto');
    expect(etapaAlGuardarElContacto(undefined, HOY, HOY)).toBe('relevamiento');
    expect(etapaAlGuardarElContacto(undefined, '2026-09-20', HOY)).toBe('relevamiento');
    expect(etapaAlGuardarElContacto(undefined, '2026-09-10', HOY)).toBe('a_presupuestar');
  });

  it('ponerle fecha a un contacto lo avanza; lo que ya avanzó no se toca', () => {
    expect(etapaAlGuardarElContacto('contacto', '2026-09-10', HOY)).toBe('a_presupuestar');
    expect(etapaAlGuardarElContacto('relevamiento', '', HOY)).toBe('relevamiento');
    expect(etapaAlGuardarElContacto('presupuesto_enviado', '2026-09-20', HOY)).toBe(
      'presupuesto_enviado',
    );
  });
});

describe('ultimoContactoAlGuardar', () => {
  it('un contacto nuevo lo anota con el día que se pasa, o con hoy si ese día todavía no llegó', () => {
    expect(ultimoContactoAlGuardar(undefined, 'contacto', HOY)).toBe(HOY);
    expect(ultimoContactoAlGuardar(undefined, 'a_presupuestar', HOY, '2026-09-10')).toBe(
      '2026-09-10',
    );
    expect(ultimoContactoAlGuardar(undefined, 'relevamiento', HOY, '2026-09-20')).toBe(HOY);
  });

  it('cambiar de etapa lo mueve; editar sin cambiar de etapa lo deja donde estaba', () => {
    const enviado = proyecto('p', { estado: 'presupuesto_enviado', ultimo_contacto: '2026-09-01' });
    expect(ultimoContactoAlGuardar(enviado, 'presupuesto_enviado', HOY)).toBe('2026-09-01');
    expect(ultimoContactoAlGuardar(enviado, 'a_presupuestar', HOY)).toBe(HOY);
    expect(ultimoContactoAlGuardar(proyecto('q'), 'contacto', HOY)).toBeNull();
  });
});

describe('pasoSiguiente', () => {
  it('cada etapa ofrece el paso que la termina, y el último es aprobar', () => {
    expect(pasoSiguiente('contacto').hacia).toBe('relevamiento');
    expect(pasoSiguiente('relevamiento')).toEqual({
      hacia: 'a_presupuestar',
      etiqueta: 'Ya fui a relevar',
    });
    expect(pasoSiguiente('a_presupuestar').hacia).toBe('presupuesto_enviado');
    expect(pasoSiguiente('presupuesto_enviado').hacia).toBe('en_curso');
  });
});
