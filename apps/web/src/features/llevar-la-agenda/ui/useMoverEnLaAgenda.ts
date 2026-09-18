import type { EventoDeLaAgenda } from '@maun/domain';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useArrastreDeEventos, type AccionesDelArrastre } from '@/entities/agenda';
import { hoyLocal } from '@/shared/lib';

import { mover, type Avisador } from '../model/acciones';

export function useMoverEnLaAgenda(
  fechas: readonly string[],
  avisar?: Avisador,
): AccionesDelArrastre {
  const cliente = useQueryClient();
  const alMover = useCallback(
    (evento: EventoDeLaAgenda, fecha: string) => {
      mover(cliente, evento, fecha, hoyLocal(), avisar);
    },
    [cliente, avisar],
  );

  return useArrastreDeEventos({ fechas, alMover });
}
