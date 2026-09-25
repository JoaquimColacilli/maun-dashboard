import type { HitoDelTrabajo } from '@maun/domain';

import type { EtapaDelMueble } from '@/shared/ui';

const ETAPA: Readonly<Record<HitoDelTrabajo, EtapaDelMueble>> = {
  estimativo: 'plano',
  presupuesto: 'plano',
  aprobado: 'plano',
  fabricacion: 'taller',
  entregado: 'terminado',
  pagado: 'pagado',
};

export function etapaDelMueble(hito: HitoDelTrabajo): EtapaDelMueble {
  return ETAPA[hito];
}
