import { centavos, puntosBasicos, SENA_HABITUAL } from '@maun/domain';
import { describe, expect, it } from 'vitest';

import { TABLAS_REPLICADAS, type FilaDe, type Replica, type TablaReplicada } from '@/shared/api';

import {
  conLaOpcionAprobada,
  datosDelFormulario,
  presupuestoDeLasOpciones,
  valoresDelFormulario,
  type FilaDeOpcion,
} from './formulario';
import {
  opcionAprobada,
  opcionesDelProyecto,
  senaDelProyecto,
  senaDelTaller,
  senaDelTrabajo,
  type OpcionDePresupuesto,
} from './opciones';

const HOY = '2026-09-16';

function replicaCon(filas: Partial<Record<TablaReplicada, { id: string }[]>>): Replica {
  const tablas = {} as Record<TablaReplicada, Record<string, unknown>>;
  for (const tabla of TABLAS_REPLICADAS) {
    tablas[tabla] = Object.fromEntries((filas[tabla] ?? []).map((fila) => [fila.id, fila]));
  }
  return { usuarioId: 'u', cursor: '', reconciliadoEn: '', tablas } as unknown as Replica;
}

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

function proyecto(extra: Partial<FilaDe<'proyectos'>> = {}): FilaDe<'proyectos'> {
  return {
    household_id: 'h',
    created_at: '2026-09-01T12:00:00Z',
    updated_at: '2026-09-01T12:00:00Z',
    deleted_at: null,
    version: 1,
    id: 'p',
    cliente_id: 'c',
    titulo: 'Escritorio',
    descripcion: '',
    estado: 'presupuesto_enviado',
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

function ajustes(extra: Partial<FilaDe<'ajustes'>> = {}): FilaDe<'ajustes'> {
  return {
    id: 'a',
    household_id: 'h',
    sueldo_mensual_centavos: 0,
    costos_fijos_centavos: 0,
    meta_cocos_centavos: 0,
    tasa_cocos_anual_bp: 0,
    sena_bp: 5000,
    cobro_alias: '',
    cobro_cbu: '',
    cobro_titular: '',
    cobro_cuit: '',
    cobro_link: '',
    resena_link: '',
    sueldo_tope_mensual: false,
    perdido_con_sueldo: false,
    perdido_con_diezmo: true,
    created_at: '2026-09-01T12:00:00Z',
    updated_at: '2026-09-01T12:00:00Z',
    deleted_at: null,
    version: 1,
    ...extra,
  };
}

describe('las opciones de un trabajo', () => {
  it('salen de la réplica, solo las de ese trabajo, en el orden en que se cargaron', () => {
    const replica = replicaCon({
      opciones_de_presupuesto: [
        opcion('b', 230_000_000),
        opcion('a', 124_800_000),
        { ...opcion('c', 1), proyecto_id: 'otro' },
      ],
    });
    expect(opcionesDelProyecto(replica, 'p').map((o) => o.id)).toEqual(['a', 'b']);
  });

  it('la aprobada es a lo sumo una', () => {
    expect(opcionAprobada([opcion('a', 1), opcion('b', 2, true)])?.id).toBe('b');
    expect(opcionAprobada([opcion('a', 1)])).toBeUndefined();
  });
});

describe('tildar una opción en el formulario', () => {
  const filas: FilaDeOpcion[] = [
    { id: 'a', detalle: 'Solo el de Alan', monto: 124_800_000, aprobada: false },
    { id: 'b', detalle: 'Los 2', monto: 230_000_000, aprobada: true },
  ];

  it('tildar una destilda las demás: la base solo acepta una', () => {
    const despues = conLaOpcionAprobada(filas, 'a', true);
    expect(despues.map((f) => f.aprobada)).toEqual([true, false]);
  });

  it('destildar la aprobada deja el trabajo sin ninguna', () => {
    const despues = conLaOpcionAprobada(filas, 'b', false);
    expect(despues.map((f) => f.aprobada)).toEqual([false, false]);
  });
});

describe('el presupuesto sale de las opciones', () => {
  const dos: FilaDeOpcion[] = [
    { id: 'a', detalle: 'Solo el de Alan', monto: 124_800_000, aprobada: false },
    { id: 'b', detalle: 'Los 2', monto: 230_000_000, aprobada: false },
  ];

  it('sin opciones no decide nada', () => {
    expect(presupuestoDeLasOpciones([])).toBeNull();
  });

  it('con opciones y ninguna aprobada, el trabajo no tiene presupuesto', () => {
    expect(presupuestoDeLasOpciones(dos)).toBeNull();
  });

  it('con una aprobada, es su importe', () => {
    expect(presupuestoDeLasOpciones(conLaOpcionAprobada(dos, 'b', true))).toBe(230_000_000);
  });

  it('el formulario manda ese número y no el que quedó escrito arriba', () => {
    const valores = valoresDelFormulario(proyecto(), [], [], [], { hoy: HOY });
    const conOpciones = { ...valores, presupuesto: 99_900_000, opciones: dos };
    expect(datosDelFormulario(conOpciones, HOY).presupuesto_centavos).toBeNull();
    expect(
      datosDelFormulario({ ...conOpciones, opciones: conLaOpcionAprobada(dos, 'a', true) }, HOY)
        .presupuesto_centavos,
    ).toBe(124_800_000);
  });

  it('sin opciones, el presupuesto es el que se carga a mano, como siempre', () => {
    const valores = valoresDelFormulario(proyecto(), [], [], [], { hoy: HOY });
    expect(
      datosDelFormulario({ ...valores, presupuesto: 70_000_000, opciones: [] }, HOY)
        .presupuesto_centavos,
    ).toBe(70_000_000);
  });
});

describe('qué seña se pide', () => {
  it('la del taller cuando el trabajo no tiene una propia', () => {
    expect(senaDelTaller(ajustes())).toBe(5000);
    expect(senaDelProyecto(proyecto())).toBeNull();
  });

  it('la del trabajo le gana a la del taller', () => {
    expect(senaDelProyecto(proyecto({ sena_bp: 4000 }))).toBe(4000);
  });

  it('una fila guardada en el dispositivo antes de la columna usa la de siempre', () => {
    const viejos = ajustes();
    delete (viejos as Partial<FilaDe<'ajustes'>>).sena_bp;
    expect(senaDelTaller(viejos)).toBe(SENA_HABITUAL);

    const viejo = proyecto();
    delete (viejo as Partial<FilaDe<'proyectos'>>).sena_bp;
    expect(senaDelProyecto(viejo)).toBeNull();
  });

  it('sin ajustes replicados todavía, la de siempre', () => {
    expect(senaDelTaller(undefined)).toBe(SENA_HABITUAL);
  });
});

describe('la seña del trabajo, de punta a punta', () => {
  const replica = replicaCon({ ajustes: [ajustes()] });

  it('sin presupuesto lo dice, no muestra ceros', () => {
    expect(senaDelTrabajo(replica, proyecto(), centavos(0))).toEqual({
      situacion: 'sin-presupuesto',
    });
  });

  it('descuenta lo que ya cobró en la visita del relevamiento', () => {
    expect(
      senaDelTrabajo(
        replica,
        proyecto({ presupuesto_centavos: 230_000_000 }),
        centavos(15_000_000),
      ),
    ).toMatchObject({ situacion: 'falta', esperada: 115_000_000, falta: 100_000_000 });
  });

  it('usa el porcentaje propio del trabajo cuando lo tiene', () => {
    expect(
      senaDelTrabajo(
        replica,
        proyecto({ presupuesto_centavos: 230_000_000, sena_bp: 3000 }),
        centavos(0),
      ),
    ).toMatchObject({ porcentaje: puntosBasicos(3000), esperada: 69_000_000 });
  });

  it('cuando ya la cubrió lo dice, en vez de un negativo', () => {
    expect(
      senaDelTrabajo(
        replica,
        proyecto({ presupuesto_centavos: 230_000_000 }),
        centavos(150_000_000),
      ),
    ).toMatchObject({ situacion: 'cubierta', deMas: 35_000_000 });
  });
});
