import type { VistaDelCliente } from '@maun/domain';

import type { EtapaDelTrabajo } from '@/shared/ui';

export function etapaDelDibujo(vista: VistaDelCliente): EtapaDelTrabajo {
  switch (vista.etapa) {
    case 'antes-del-presupuesto':
      return vista.hitoActual === 'estimativo' ? 'estimativo' : 'preparando';
    case 'esperando-la-sena':
      return 'presupuesto';
    case 'aprobado':
      return vista.datos.sena.situacion === 'cubierta' && vista.datos.sena.sena > 0
        ? 'sena'
        : 'presupuesto';
    default:
      return vista.etapa;
  }
}
