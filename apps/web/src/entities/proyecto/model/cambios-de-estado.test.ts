import {
  centavos,
  ESTADOS,
  ESTADOS_DE_SEGUIMIENTO,
  TRANSICIONES,
  type EstadoProyecto,
} from '@maun/domain';
import { describe, expect, it } from 'vitest';

import type { FilaDe } from '@/shared/api';

import { guardadoDeUnPaso } from '../api/mutacion';
import { cambiosAlPasar, cambiosDeEstado } from './cambios-de-estado';
import { urgenciaDeEntrega } from './entrega';
import { situacionDeLaObra } from './obra';
import type { ResumenDeProyecto } from './resumen';

type Proyecto = FilaDe<'proyectos'>;

const HOY = '2026-09-14';

function proyecto(extra: Partial<Proyecto> = {}): Proyecto {
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
    estado: 'en_curso',
    presupuesto_centavos: 50_000_000,
    forma_pago: null,
    comprobante: 'sin_comprobante',
    fecha_visita: null,
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
    ...extra,
  };
}

function resumen(fila: Proyecto, cobrado = 0): ResumenDeProyecto {
  const presupuesto = fila.presupuesto_centavos;
  return {
    proyecto: fila,
    cliente: undefined,
    nombreDelCliente: 'Cliente',
    fase: 'activos',
    presupuesto: centavos(presupuesto ?? 0),
    cobrado: centavos(cobrado),
    gastos: centavos(0),
    saldo: presupuesto === null ? null : centavos(Math.max(0, presupuesto - cobrado)),
    urgencia: urgenciaDeEntrega(fila.entrega_estimada, fila.estado, HOY),
  };
}

describe('los cambios de estado que ofrece una ficha', () => {
  it('desde cada estado son exactamente las transiciones de la máquina del dominio', () => {
    for (const estado of ESTADOS) {
      expect(cambiosDeEstado(estado).map((cambio) => cambio.hacia)).toEqual(TRANSICIONES[estado]);
    }
  });

  it('nunca llevan a cobrado ni a perdido: eso son operaciones con su propia pantalla', () => {
    for (const estado of ESTADOS) {
      const destinos: EstadoProyecto[] = cambiosDeEstado(estado).map((cambio) => cambio.hacia);
      expect(destinos).not.toContain('cobrado');
      expect(destinos).not.toContain('perdido');
    }
    expect(cambiosDeEstado('cobrado')).toEqual([]);
    expect(cambiosDeEstado('perdido')).toEqual([]);
  });

  it('en una obra se escriben en el idioma del taller, y lo que retrocede va aparte', () => {
    expect(cambiosDeEstado('en_curso')).toEqual([
      {
        hacia: 'presupuesto_enviado',
        etiqueta: 'Volvió a presupuesto',
        sentido: 'atras',
        camino: 'guardar',
      },
      { hacia: 'entregado', etiqueta: 'Ya lo entregué', sentido: 'adelante', camino: 'guardar' },
    ]);
    expect(cambiosDeEstado('entregado')).toEqual([
      { hacia: 'en_curso', etiqueta: 'Volvió al taller', sentido: 'atras', camino: 'guardar' },
    ]);
  });

  it('mandar un estimativo se dice como lo dice el taller', () => {
    expect(
      cambiosDeEstado('contacto').find((cambio) => cambio.hacia === 'presupuesto_estimativo'),
    ).toEqual({
      hacia: 'presupuesto_estimativo',
      etiqueta: 'Mandé un estimativo',
      sentido: 'adelante',
      camino: 'guardar',
    });
  });

  it('aprobar un contacto no es un cambio rápido: pasa por la pantalla del pasaje', () => {
    for (const etapa of ESTADOS_DE_SEGUIMIENTO) {
      const aprobar = cambiosDeEstado(etapa).find((cambio) => cambio.hacia === 'en_curso');
      expect(aprobar).toMatchObject({ etiqueta: 'Ya lo aprobó', camino: 'pasaje' });
    }
  });

  it('dentro de un mismo estado ninguna acción repite el texto', () => {
    for (const estado of ESTADOS) {
      const etiquetas = cambiosDeEstado(estado).map((cambio) => cambio.etiqueta);
      expect(new Set(etiquetas).size).toBe(etiquetas.length);
      expect(etiquetas.every((etiqueta) => etiqueta.trim() !== '')).toBe(true);
    }
  });
});

describe('lo que cambia al pasar de estado', () => {
  it('entregarlo anota hoy como día de entrega, salvo que ya tuviera uno', () => {
    expect(cambiosAlPasar(proyecto(), 'entregado', HOY)).toEqual({
      estado: 'entregado',
      fecha_entrega: HOY,
    });
    expect(cambiosAlPasar(proyecto({ fecha_entrega: '2026-09-10' }), 'entregado', HOY)).toEqual({
      estado: 'entregado',
      fecha_entrega: '2026-09-10',
    });
  });

  it('si vuelve al taller, la entrega deja de estar hecha', () => {
    const entregado = proyecto({ estado: 'entregado', fecha_entrega: '2026-09-10' });
    expect(cambiosAlPasar(entregado, 'en_curso', HOY)).toEqual({
      estado: 'en_curso',
      fecha_entrega: null,
    });
  });

  it('volver a presupuesto solo cambia el estado', () => {
    expect(cambiosAlPasar(proyecto(), 'presupuesto_enviado', HOY)).toEqual({
      estado: 'presupuesto_enviado',
    });
  });

  it('el guardado es el agregado entero con la versión que se vio, sin tocar pagos ni gastos', () => {
    const fila = proyecto({ ultimo_contacto: '2026-08-01' });
    const guardado = guardadoDeUnPaso(fila, { estado: 'presupuesto_enviado' }, HOY);

    expect(guardado.pedido).toMatchObject({ id: 'p', version: 3, pagos: [], gastos: [] });
    expect(guardado.pedido.datos.estado).toBe('presupuesto_enviado');
    expect(guardado.pedido.datos.titulo).toBe('Placard');
    expect(guardado.pedido.datos.ultimo_contacto).toBe(HOY);
    expect(guardado.previos).toEqual({ proyecto: fila, pagos: [], gastos: [] });
  });
});

describe('lo que falta en una obra', () => {
  it('en curso falta entregarla, con la entrega estimada y su urgencia', () => {
    expect(situacionDeLaObra(resumen(proyecto({ entrega_estimada: '2026-10-13' })), HOY)).toEqual({
      proximoPaso: 'Falta entregarlo',
      detalle: 'Entrega estimada: en 29 días',
      icono: 'calendar',
      tono: 'normal',
    });
    expect(
      situacionDeLaObra(resumen(proyecto({ entrega_estimada: '2026-09-11' })), HOY),
    ).toMatchObject({ detalle: 'Entrega estimada: vencida hace 3 días', tono: 'alerta' });
    expect(situacionDeLaObra(resumen(proyecto()), HOY)).toMatchObject({
      detalle: 'Sin fecha de entrega estimada',
    });
  });

  it('entregada falta cobrarla, y dice cuánto', () => {
    const entregado = proyecto({ estado: 'entregado', fecha_entrega: '2026-09-14' });
    expect(situacionDeLaObra(resumen(entregado, 10_000_000), HOY)).toMatchObject({
      proximoPaso: expect.stringMatching(/^Falta cobrar \$\s?400\.000$/) as unknown,
      detalle: 'Entregado el lun 14 sep',
    });
    expect(situacionDeLaObra(resumen(entregado, 50_000_000), HOY)).toMatchObject({
      proximoPaso: 'Falta cobrarlo y repartir',
    });
  });

  it('un contacto o un proyecto cerrado no tienen situación de obra', () => {
    expect(situacionDeLaObra(resumen(proyecto({ estado: 'contacto' })), HOY)).toBeUndefined();
    expect(situacionDeLaObra(resumen(proyecto({ estado: 'cobrado' })), HOY)).toBeUndefined();
  });
});
