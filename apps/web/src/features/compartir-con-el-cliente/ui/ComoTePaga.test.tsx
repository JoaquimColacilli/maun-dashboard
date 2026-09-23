import { centavos, puntosBasicos } from '@maun/domain';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import type { FormasDeCobroDelTrabajo, Proyecto, ResumenDeProyecto } from '@/entities/proyecto';
import { ProveedorDeReplica } from '@/entities/replica';
import { TABLAS_REPLICADAS, type FilaDe, type Replica, type TablaReplicada } from '@/shared/api';

import { AL_MENOS_UNA, NADA_QUE_COBRAR, SIN_DATOS_PARA_TRANSFERIR } from '../model/comoTePaga';
import { ComoTePaga } from './ComoTePaga';

const AHORA = '2026-09-19T12:00:00Z';

const AJUSTES: FilaDe<'ajustes'> = {
  id: 'aj',
  household_id: 'h',
  sueldo_mensual_centavos: 0,
  costos_fijos_centavos: 0,
  meta_cocos_centavos: 0,
  tasa_cocos_anual_bp: 0,
  sueldo_tope_mensual: false,
  perdido_con_sueldo: false,
  perdido_con_diezmo: true,
  sena_bp: 5000,
  cobro_alias: 'maun.muebles',
  cobro_cbu: '',
  cobro_titular: '',
  cobro_cuit: '',
  cobro_link: '',
  resena_link: '',
  created_at: AHORA,
  updated_at: AHORA,
  deleted_at: null,
  version: 1,
};

const PROYECTO: Proyecto = {
  id: 'p1',
  household_id: 'h',
  cliente_id: 'c1',
  titulo: 'Placard 3 puertas',
  descripcion: '',
  estado: 'en_curso',
  presupuesto_centavos: 100_000_000,
  forma_pago: null,
  cobro_sena: null,
  cobro_saldo: null,
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
  reparto_ya_en_la_apertura: false,
  vencimiento_presupuesto: null,
  presupuesto_diseno: false,
  presupuesto_despiece: false,
  presupuesto_cotizacion: false,
  presupuesto_pdf: false,
  visita_hecha: false,
  visita_importante: false,
  entrega_importante: false,
  presupuesto_importante: false,
  sena_bp: null,
  costo_madera_centavos: null,
  costo_herrajes_centavos: null,
  costo_flete_centavos: null,
  costo_ayudante_centavos: null,
  entrega_hora: null,
  visita_hora: null,
  created_at: AHORA,
  updated_at: AHORA,
  deleted_at: null,
  version: 3,
};

function resumen(proyecto: Partial<Proyecto> = {}, cobrado = 0): ResumenDeProyecto {
  const fila = { ...PROYECTO, ...proyecto };
  return {
    proyecto: fila,
    cliente: undefined,
    nombreDelCliente: 'Marcela Duarte',
    fase: 'activos',
    presupuesto: centavos(fila.presupuesto_centavos ?? 0),
    cobrado: centavos(cobrado),
    gastos: centavos(0),
    saldo: centavos((fila.presupuesto_centavos ?? 0) - cobrado),
    urgencia: undefined,
  };
}

function conLosAjustes(cambios: Partial<FilaDe<'ajustes'>> = {}): Replica {
  const tablas = {} as Record<TablaReplicada, Record<string, unknown>>;
  for (const tabla of TABLAS_REPLICADAS) tablas[tabla] = {};
  tablas.ajustes = { aj: { ...AJUSTES, ...cambios } };
  return { usuarioId: 'u1', cursor: '', reconciliadoEn: '', tablas } as unknown as Replica;
}

function montar(datos: ResumenDeProyecto, replica: Replica = conLosAjustes()) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <ProveedorDeReplica replica={replica}>
          <ComoTePaga resumen={datos} />
        </ProveedorDeReplica>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return {
    loGuardado: (): FormasDeCobroDelTrabajo[] =>
      queryClient
        .getMutationCache()
        .getAll()
        .map((mutacion) => mutacion.state.variables as FormasDeCobroDelTrabajo),
  };
}

function fila(nombre: string) {
  return screen.getByRole('group', { name: `${nombre}: cómo te la paga` });
}

describe('cómo te paga', () => {
  it('con la seña pendiente ofrece las dos filas', () => {
    montar(resumen());

    expect(fila('La seña')).toBeInTheDocument();
    expect(fila('El saldo')).toBeInTheDocument();
  });

  it('con la seña cubierta solo queda el saldo', () => {
    montar(resumen({}, 60_000_000));

    expect(screen.queryByRole('group', { name: 'La seña: cómo te la paga' })).toBeNull();
    expect(fila('El saldo')).toBeInTheDocument();
  });

  it('saldado no ofrece nada y lo dice', () => {
    montar(resumen({}, 100_000_000));

    expect(screen.queryByRole('group', { name: /cómo te la paga/ })).toBeNull();
    expect(screen.getByText(NADA_QUE_COBRAR)).toBeInTheDocument();
  });

  it('sin nada guardado y con alias cargado, las dos formas vienen prendidas', () => {
    montar(resumen());

    for (const forma of ['Transferencia', 'Efectivo']) {
      expect(within(fila('La seña')).getByRole('checkbox', { name: forma })).toHaveAttribute(
        'aria-checked',
        'true',
      );
    }
  });

  it('sin datos para transferir en Ajustes, solo efectivo y una línea que lleva a cargarlos', () => {
    montar(resumen(), conLosAjustes({ cobro_alias: '', cobro_cbu: '' }));

    expect(
      within(fila('La seña')).getByRole('checkbox', { name: 'Transferencia' }),
    ).toHaveAttribute('aria-checked', 'false');
    expect(within(fila('La seña')).getByRole('checkbox', { name: 'Efectivo' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByText(SIN_DATOS_PARA_TRANSFERIR)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cargalos en Ajustes' })).toHaveAttribute(
      'href',
      '/ajustes',
    );
  });

  it('con los datos cargados, esa línea no está', () => {
    montar(resumen());

    expect(screen.queryByText(SIN_DATOS_PARA_TRANSFERIR)).toBeNull();
  });

  it('apagar una de las dos guarda la otra sola, por su columna, con la versión que vio', () => {
    const { loGuardado } = montar(resumen());

    fireEvent.click(within(fila('La seña')).getByRole('checkbox', { name: 'Efectivo' }));

    expect(loGuardado()).toEqual([
      {
        id: 'p1',
        cambios: { cobro_sena: ['transferencia'] },
        previos: { cobro_sena: null, cobro_saldo: null },
        version: 3,
      },
    ]);
  });

  it('la seña por transferencia y el saldo en efectivo: cada instancia toca su columna', () => {
    const { loGuardado } = montar(
      resumen({
        cobro_sena: ['transferencia'],
        cobro_saldo: ['transferencia', 'efectivo'],
      }),
    );

    fireEvent.click(within(fila('El saldo')).getByRole('checkbox', { name: 'Transferencia' }));

    expect(loGuardado().at(-1)?.cambios).toEqual({ cobro_saldo: ['efectivo'] });
  });

  it('prender la que faltaba deja las dos, siempre en el mismo orden', () => {
    const { loGuardado } = montar(resumen({ cobro_sena: ['efectivo'] }));

    fireEvent.click(within(fila('La seña')).getByRole('checkbox', { name: 'Transferencia' }));

    expect(loGuardado().at(-1)?.cambios).toEqual({ cobro_sena: ['transferencia', 'efectivo'] });
  });

  it('no se puede dejar un pago sin ninguna forma: no guarda y lo explica', () => {
    const { loGuardado } = montar(resumen({ cobro_sena: ['efectivo'] }));

    fireEvent.click(within(fila('La seña')).getByRole('checkbox', { name: 'Efectivo' }));

    expect(loGuardado()).toEqual([]);
    expect(screen.getByRole('alert')).toHaveTextContent(AL_MENOS_UNA);
    expect(within(fila('La seña')).getByRole('checkbox', { name: 'Efectivo' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('el porcentaje de seña del trabajo pisa al del taller para decidir qué falta', () => {
    montar(resumen({ sena_bp: puntosBasicos(2000) }, 25_000_000));

    expect(screen.queryByRole('group', { name: 'La seña: cómo te la paga' })).toBeNull();
    expect(fila('El saldo')).toBeInTheDocument();
  });
});
