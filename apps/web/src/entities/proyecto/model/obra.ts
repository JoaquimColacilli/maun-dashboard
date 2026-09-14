import { fechaLarga, formatearPesos } from '@/shared/lib';
import type { NombreDeIcono, TonoDelPaso } from '@/shared/ui';

import type { TonoDeEntrega } from './entrega';
import type { ResumenDeProyecto } from './resumen';

export interface SituacionDeLaObra {
  proximoPaso: string;
  detalle: string;
  icono: NombreDeIcono;
  tono: TonoDelPaso;
}

const TONO_DE_LA_ENTREGA: Readonly<Record<TonoDeEntrega, TonoDelPaso>> = {
  ok: 'normal',
  atencion: 'atencion',
  vencida: 'alerta',
};

export function situacionDeLaObra(
  resumen: ResumenDeProyecto,
  hoy: string,
): SituacionDeLaObra | undefined {
  const { proyecto, urgencia, saldo } = resumen;

  if (proyecto.estado === 'en_curso') {
    if (proyecto.entrega_estimada === null || urgencia === undefined) {
      return {
        proximoPaso: 'Falta entregarlo',
        detalle: 'Sin fecha de entrega estimada',
        icono: 'calendar',
        tono: 'normal',
      };
    }
    return {
      proximoPaso: 'Falta entregarlo',
      detalle: `Entrega estimada: ${urgencia.texto}`,
      icono: urgencia.icono,
      tono: TONO_DE_LA_ENTREGA[urgencia.tono],
    };
  }

  if (proyecto.estado === 'entregado') {
    return {
      proximoPaso:
        saldo !== null && saldo > 0
          ? `Falta cobrar ${formatearPesos(saldo)}`
          : 'Falta cobrarlo y repartir',
      detalle:
        proyecto.fecha_entrega === null
          ? 'Entregado, sin fecha de entrega'
          : `Entregado el ${fechaLarga(proyecto.fecha_entrega, hoy)}`,
      icono: 'calendar-check',
      tono: 'normal',
    };
  }

  return undefined;
}
