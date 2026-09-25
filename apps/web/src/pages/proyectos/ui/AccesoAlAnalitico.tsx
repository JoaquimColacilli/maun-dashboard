import { useMemo } from 'react';

import { analisisDeLaReplica, type Replica } from '@/shared/api';
import { Ir, RUTA_DEL_ANALITICO } from '@/shared/lib';
import { Icono } from '@/shared/ui';

export function AccesoAlAnalitico({ replica }: { replica: Replica }) {
  const analisis = useMemo(() => analisisDeLaReplica(replica), [replica]);
  if (analisis.trabajos.length === 0) return null;
  return (
    <Ir
      a={RUTA_DEL_ANALITICO}
      className="flex items-center gap-3 rounded-panel border border-hairline bg-paper px-4 py-3.5 text-ink no-underline hover:bg-surface"
    >
      <span
        aria-hidden
        className="flex size-10 flex-none items-center justify-center rounded-field bg-surface text-text-2"
      >
        <Icono nombre="calendar-check" tamano={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-body font-semibold">Analítico de entregas</span>
        <span className="mt-0.5 block text-label leading-snug text-text-2">
          {analisis.precision.frase}
        </span>
      </span>
      <span aria-hidden className="flex-none text-text-3">
        <Icono nombre="chevron-right" tamano={18} />
      </span>
    </Ir>
  );
}
