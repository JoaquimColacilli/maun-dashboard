import { describe, expect, it } from 'vitest';

import { TABLAS_REPLICADAS, type FilaDe, type Replica, type TablaReplicada } from '@/shared/api';

import { CLIENTE_EN_BLANCO } from './formulario';
import { fechaDelProyecto, resumenDeCliente, resumenesDeClientes } from './resumen';

type Proyecto = FilaDe<'proyectos'>;
type Pago = FilaDe<'pagos'>;

const METADATOS = {
  household_id: 'h',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  deleted_at: null,
  version: 1,
} as const;

function cliente(id: string, nombre: string): FilaDe<'clientes'> {
  return { ...CLIENTE_EN_BLANCO, ...METADATOS, id, nombre };
}

function proyecto(id: string, clienteId: string, extra: Partial<Proyecto> = {}): Proyecto {
  return {
    ...METADATOS,
    id,
    cliente_id: clienteId,
    titulo: id,
    descripcion: '',
    estado: 'en_curso',
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

function pago(id: string, proyectoId: string, monto: number): Pago {
  return {
    ...METADATOS,
    id,
    proyecto_id: proyectoId,
    fecha: '2026-02-01',
    concepto: '',
    monto_centavos: monto,
  };
}

function replicaCon(filas: Partial<Record<TablaReplicada, { id: string }[]>>): Replica {
  const tablas = {} as Record<TablaReplicada, Record<string, unknown>>;
  for (const tabla of TABLAS_REPLICADAS) {
    tablas[tabla] = Object.fromEntries((filas[tabla] ?? []).map((fila) => [fila.id, fila]));
  }
  return { usuarioId: 'u', cursor: '', reconciliadoEn: '', tablas } as unknown as Replica;
}

describe('fechaDelProyecto', () => {
  it('elige la fecha más definitiva que tenga', () => {
    expect(
      fechaDelProyecto(
        proyecto('p', 'c', {
          ultimo_contacto: '2026-01-01',
          fecha_visita: '2026-02-01',
          fecha_inicio: '2026-03-01',
          fecha_cobro: '2026-05-01',
        }),
      ),
    ).toBe('2026-05-01');
  });

  it('un lead recién contactado solo tiene la del contacto', () => {
    expect(fechaDelProyecto(proyecto('p', 'c', { ultimo_contacto: '2026-01-01' }))).toBe(
      '2026-01-01',
    );
  });

  it('sin ninguna fecha no inventa una', () => {
    expect(fechaDelProyecto(proyecto('p', 'c'))).toBeUndefined();
  });
});

describe('resumenesDeClientes', () => {
  it('un cliente sin proyectos queda en cero, no afuera', () => {
    const [resumen] = resumenesDeClientes(replicaCon({ clientes: [cliente('c1', 'Ana')] }));
    expect(resumen).toMatchObject({
      facturado: 0,
      saldo: 0,
      facturados: 0,
      enSeguimiento: 0,
      ultimo: undefined,
    });
  });

  it('lo facturado son los proyectos de obra; los de seguimiento no cuentan', () => {
    const replica = replicaCon({
      clientes: [cliente('c1', 'Ana')],
      proyectos: [
        proyecto('p1', 'c1', { estado: 'cobrado', presupuesto_centavos: 100_000 }),
        proyecto('p2', 'c1', { estado: 'en_curso', presupuesto_centavos: 50_000 }),
        proyecto('p3', 'c1', { estado: 'presupuesto_enviado', presupuesto_centavos: 900_000 }),
      ],
    });
    const [resumen] = resumenesDeClientes(replica);

    expect(resumen?.facturado).toBe(150_000);
    expect(resumen?.facturados).toBe(2);
    expect(resumen?.enSeguimiento).toBe(1);
  });

  it('el saldo es lo que falta cobrar de lo que está en curso o entregado', () => {
    const replica = replicaCon({
      clientes: [cliente('c1', 'Ana')],
      proyectos: [
        proyecto('p1', 'c1', { estado: 'en_curso', presupuesto_centavos: 100_000 }),
        proyecto('p2', 'c1', { estado: 'entregado', presupuesto_centavos: 80_000 }),
        proyecto('p3', 'c1', { estado: 'cobrado', presupuesto_centavos: 500_000 }),
      ],
      pagos: [pago('g1', 'p1', 30_000), pago('g2', 'p1', 10_000)],
    });
    const [resumen] = resumenesDeClientes(replica);

    expect(resumen?.saldo).toBe(140_000);
  });

  it('un proyecto sobrecobrado no resta del saldo de los demás', () => {
    const replica = replicaCon({
      clientes: [cliente('c1', 'Ana')],
      proyectos: [
        proyecto('p1', 'c1', { estado: 'en_curso', presupuesto_centavos: 10_000 }),
        proyecto('p2', 'c1', { estado: 'en_curso', presupuesto_centavos: 100_000 }),
      ],
      pagos: [pago('g1', 'p1', 50_000)],
    });
    expect(resumenesDeClientes(replica)[0]?.saldo).toBe(100_000);
  });

  it('el último trabajo es el de la fecha más nueva', () => {
    const replica = replicaCon({
      clientes: [cliente('c1', 'Ana')],
      proyectos: [
        proyecto('viejo', 'c1', { fecha_inicio: '2025-03-01' }),
        proyecto('nuevo', 'c1', { fecha_inicio: '2026-07-01' }),
      ],
    });
    const [resumen] = resumenesDeClientes(replica);

    expect(resumen?.ultimo?.id).toBe('nuevo');
    expect(resumen?.fechaDelUltimo).toBe('2026-07-01');
    expect(resumen?.proyectos.map((p) => p.id)).toEqual(['nuevo', 'viejo']);
  });

  it('no mezcla los proyectos de un cliente con los de otro', () => {
    const replica = replicaCon({
      clientes: [cliente('c1', 'Ana'), cliente('c2', 'Bruno')],
      proyectos: [
        proyecto('p1', 'c1', { estado: 'cobrado', presupuesto_centavos: 100_000 }),
        proyecto('p2', 'c2', { estado: 'cobrado', presupuesto_centavos: 700_000 }),
      ],
    });
    const resumenes = resumenesDeClientes(replica);

    expect(resumenes.find((r) => r.cliente.id === 'c1')?.facturado).toBe(100_000);
    expect(resumenes.find((r) => r.cliente.id === 'c2')?.facturado).toBe(700_000);
  });
});

describe('resumenDeCliente', () => {
  it('devuelve el del id pedido', () => {
    const replica = replicaCon({ clientes: [cliente('c1', 'Ana'), cliente('c2', 'Bruno')] });
    expect(resumenDeCliente(replica, 'c2')?.cliente.nombre).toBe('Bruno');
  });

  it('devuelve undefined si ese cliente no está en la réplica', () => {
    expect(resumenDeCliente(replicaCon({}), 'fantasma')).toBeUndefined();
  });
});
