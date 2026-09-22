import type { TipoDePregunta } from '@maun/domain';

import type { NombreDeIcono } from '@/shared/ui';

export interface DatosDelTipo {
  etiqueta: string;
  descripcion: string;
  icono: NombreDeIcono;
}

export const TIPO: Readonly<Record<TipoDePregunta, DatosDelTipo>> = {
  escala5: {
    etiqueta: 'Escala de cinco',
    descripcion: 'Cinco caritas con su palabra',
    icono: 'smile',
  },
  sitalvezno: { etiqueta: 'Sí / tal vez / no', descripcion: 'Tres botones', icono: 'circle-check' },
  una: { etiqueta: 'Una sola opción', descripcion: 'Elige una entre varias', icono: 'circle-dot' },
  varias: {
    etiqueta: 'Varias opciones',
    descripcion: 'Puede elegir más de una',
    icono: 'list-checks',
  },
  texto: { etiqueta: 'Texto libre', descripcion: 'Escribe lo que quiera', icono: 'pencil-line' },
};

export function cuantasRespuestas(cantidad: number): string {
  return cantidad === 1 ? '1 respuesta' : `${String(cantidad)} respuestas`;
}
