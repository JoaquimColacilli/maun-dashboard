import {
  ESTADOS,
  estaLiquidado,
  faseDe,
  TRANSICIONES,
  type EstadoLiquidado,
  type EstadoProyecto,
} from '@maun/domain';

import type { CambiosDeProyecto } from '@/shared/api';

import type { Proyecto } from './catalogos';

export type EstadoSinLiquidar = Exclude<EstadoProyecto, EstadoLiquidado>;

export type SentidoDelCambio = 'adelante' | 'atras';

export interface CambioDeEstado {
  hacia: EstadoSinLiquidar;
  etiqueta: string;
  sentido: SentidoDelCambio;
  camino: 'guardar' | 'pasaje';
}

function sinLiquidar(estado: EstadoProyecto): estado is EstadoSinLiquidar {
  return !estaLiquidado(estado);
}

function etiquetaDelCambio(desde: EstadoProyecto, hacia: EstadoSinLiquidar): string {
  switch (hacia) {
    case 'contacto':
      return 'Volver a contacto';
    case 'relevamiento':
      return 'Pasar a relevamiento';
    case 'a_presupuestar':
      return 'Pasar a presupuestar';
    case 'presupuesto_enviado':
      return faseDe(desde) === 'seguimiento' ? 'Mandé el presupuesto' : 'Volvió a presupuesto';
    case 'en_curso':
      return faseDe(desde) === 'seguimiento' ? 'Ya lo aprobó' : 'Volvió al taller';
    case 'entregado':
      return 'Ya lo entregué';
  }
}

export function cambiosDeEstado(desde: EstadoProyecto): CambioDeEstado[] {
  const posicion = ESTADOS.indexOf(desde);
  return TRANSICIONES[desde].filter(sinLiquidar).map((hacia): CambioDeEstado => ({
    hacia,
    etiqueta: etiquetaDelCambio(desde, hacia),
    sentido: ESTADOS.indexOf(hacia) > posicion ? 'adelante' : 'atras',
    camino: faseDe(desde) === 'seguimiento' && faseDe(hacia) === 'activos' ? 'pasaje' : 'guardar',
  }));
}

export function cambiosAlPasar(
  proyecto: Proyecto,
  hacia: EstadoSinLiquidar,
  hoy: string,
): CambiosDeProyecto {
  if (hacia === 'entregado') {
    return { estado: hacia, fecha_entrega: proyecto.fecha_entrega ?? hoy };
  }
  if (proyecto.estado === 'entregado') return { estado: hacia, fecha_entrega: null };
  return { estado: hacia };
}
