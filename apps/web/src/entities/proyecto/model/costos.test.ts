import { describe, expect, it } from 'vitest';

import type { FilaDe } from '@/shared/api';

import {
  cambiaAlgunCosto,
  cambiosDeCostos,
  COLUMNA_DEL_COSTO,
  costosDelProyecto,
  costosGuardados,
  COSTOS_DEL_TRABAJO,
  hayCostosEstimados,
  margenDelTrabajo,
  totalEstimado,
} from './costos';
import { datosDelFormulario, valoresDelFormulario } from './formulario';

const HOY = '2026-09-17';

function proyecto(extra: Partial<FilaDe<'proyectos'>> = {}): FilaDe<'proyectos'> {
  return {
    household_id: 'h',
    created_at: '2026-09-01T12:00:00Z',
    updated_at: '2026-09-01T12:00:00Z',
    deleted_at: null,
    version: 3,
    id: 'p',
    cliente_id: 'c',
    titulo: 'Baulera',
    descripcion: '',
    estado: 'a_presupuestar',
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

describe('los costos estimados de un trabajo', () => {
  it('son las cuatro categorías que nombró el dueño, con su columna', () => {
    expect(COSTOS_DEL_TRABAJO.map((costo) => costo.etiqueta)).toEqual([
      'Madera',
      'Herrajes',
      'Flete',
      'Ayudante',
    ]);
    expect(COSTOS_DEL_TRABAJO.map((costo) => COLUMNA_DEL_COSTO[costo.categoria])).toEqual(
      COSTOS_DEL_TRABAJO.map((costo) => costo.columna),
    );
  });

  it('un trabajo sin estimar no tiene costos, y eso no es cero', () => {
    expect(hayCostosEstimados(proyecto())).toBe(false);
    expect(costosDelProyecto(proyecto())).toEqual({
      madera: null,
      herrajes: null,
      flete: null,
      ayudante: null,
    });
  });

  it('una fila guardada en el dispositivo antes de las columnas no rompe', () => {
    const vieja = proyecto();
    delete (vieja as Partial<FilaDe<'proyectos'>>).costo_madera_centavos;
    expect(costosDelProyecto(vieja).madera).toBeNull();
    expect(hayCostosEstimados(vieja)).toBe(false);
  });

  it('suma lo cargado', () => {
    const cargado = proyecto({ costo_madera_centavos: 19_786_353, costo_flete_centavos: 0 });
    expect(totalEstimado(cargado)).toBe(19_786_353);
    expect(hayCostosEstimados(cargado)).toBe(true);
  });

  it('sabe si un guardado cambia algo, para no subir la versión al pedo', () => {
    const cargado = proyecto({ costo_madera_centavos: 100 });
    expect(cambiaAlgunCosto(cargado, { costo_madera_centavos: 100 })).toBe(false);
    expect(cambiaAlgunCosto(cargado, { costo_madera_centavos: 200 })).toBe(true);
    expect(cambiaAlgunCosto(cargado, { costo_flete_centavos: 0 })).toBe(true);
  });

  it('lo guardado se lee como el pedido que lo devolvería igual', () => {
    const cargado = proyecto({ costo_madera_centavos: 1, costo_ayudante_centavos: 2 });
    expect(costosGuardados(cargado)).toEqual(
      cambiosDeCostos({ madera: 1, herrajes: null, flete: null, ayudante: 2 }),
    );
  });
});

describe('el margen', () => {
  it('sin presupuesto muestra solo el total estimado', () => {
    const cargado = proyecto({
      costo_madera_centavos: 19_786_353,
      costo_flete_centavos: 10_000_000,
    });
    expect(margenDelTrabajo(cargado)).toEqual({
      situacion: 'sin-presupuesto',
      estimado: 29_786_353,
      cargadas: 2,
    });
  });

  it('con presupuesto es la resta, y nada más', () => {
    const cargado = proyecto({
      presupuesto_centavos: 62_800_000,
      costo_madera_centavos: 19_786_353,
      costo_herrajes_centavos: 12_000_000,
    });
    expect(margenDelTrabajo(cargado)).toEqual({
      situacion: 'con-margen',
      estimado: 31_786_353,
      cargadas: 2,
      presupuesto: 62_800_000,
      margen: 31_013_647,
    });
  });

  it('sin costos cargados no dice nada, aunque haya presupuesto', () => {
    expect(margenDelTrabajo(proyecto({ presupuesto_centavos: 62_800_000 }))).toEqual({
      situacion: 'sin-estimar',
    });
  });
});

describe('los costos estimados no tocan el presupuesto', () => {
  it('el formulario grande no los manda: guardar el agregado no puede pisarlos', () => {
    const cargado = proyecto({
      presupuesto_centavos: 62_800_000,
      costo_madera_centavos: 19_786_353,
    });
    const datos = datosDelFormulario(valoresDelFormulario(cargado, [], [], [], { hoy: HOY }), HOY);
    expect(datos).not.toHaveProperty('costo_madera_centavos');
    expect(datos.presupuesto_centavos).toBe(62_800_000);
  });

  it('y cargarlos no cambia el presupuesto por ningún camino', () => {
    const antes = proyecto({ presupuesto_centavos: 62_800_000 });
    const despues = proyecto({
      presupuesto_centavos: 62_800_000,
      costo_madera_centavos: 19_786_353,
      costo_herrajes_centavos: 12_000_000,
      costo_flete_centavos: 10_000_000,
      costo_ayudante_centavos: 30_000_000,
    });
    expect(despues.presupuesto_centavos).toBe(antes.presupuesto_centavos);
    expect(cambiosDeCostos({ madera: 1, herrajes: 2, flete: 3, ayudante: 4 })).not.toHaveProperty(
      'presupuesto_centavos',
    );
  });
});
