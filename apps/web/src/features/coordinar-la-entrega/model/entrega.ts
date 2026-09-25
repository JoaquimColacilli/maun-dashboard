import { sumarDias, type DiaElegido, type FranjaDeEntrega } from '@maun/domain';

import {
  entregaGuardada,
  FRANJA_DE_LA_ENTREGA,
  listoDelTrabajo,
  type Proyecto,
} from '@/entities/proyecto';

export type FechaQueSeElige = 'estimada' | 'comprometida' | 'propuesta';

export function desdeCuando(que: FechaQueSeElige, hoy: string): string {
  return que === 'propuesta' ? sumarDias(hoy, 1) : hoy;
}

export function errorDeLaFecha(
  que: FechaQueSeElige,
  fecha: string,
  hoy: string,
): string | undefined {
  if (fecha.trim() === '') return 'Elegí el día.';
  if (fecha < desdeCuando(que, hoy)) {
    return que === 'propuesta'
      ? 'El día que le proponés tiene que ser desde mañana.'
      : 'Esa fecha ya pasó y tu cliente no la vería: elegí una desde hoy.';
  }
  return undefined;
}

export interface FechaQuePaso {
  cual: 'estimada' | 'comprometida';
  fecha: string;
}

export function fechasQuePasaron(proyecto: Proyecto, hoy: string): FechaQuePaso[] {
  if (proyecto.estado !== 'en_curso') return [];
  const { entrega_comprometida: comprometida } = entregaGuardada(proyecto);
  const pasadas: FechaQuePaso[] = [];
  if (proyecto.entrega_estimada !== null && proyecto.entrega_estimada < hoy) {
    pasadas.push({ cual: 'estimada', fecha: proyecto.entrega_estimada });
  }
  if (comprometida !== null && comprometida < hoy) {
    pasadas.push({ cual: 'comprometida', fecha: comprometida });
  }
  return pasadas;
}

export type MomentoDeLaEntrega = 'fabricando' | 'listo' | 'comprometida';

export function momentoDeLaEntrega(proyecto: Proyecto): MomentoDeLaEntrega {
  if (entregaGuardada(proyecto).entrega_comprometida !== null) return 'comprometida';
  return listoDelTrabajo(proyecto) === null ? 'fabricando' : 'listo';
}

export interface OpcionParaConfirmar {
  fecha: string;
  franja: FranjaDeEntrega;
  etiqueta: string;
}

export function opcionesParaConfirmar(dia: DiaElegido, hoy: string): OpcionParaConfirmar[] {
  if (dia.fecha < hoy) return [];
  return dia.franjas.map((franja) => ({
    fecha: dia.fecha,
    franja,
    etiqueta: FRANJA_DE_LA_ENTREGA[franja].replace(/^a la /, 'A la '),
  }));
}
