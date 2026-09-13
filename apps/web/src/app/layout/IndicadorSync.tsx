import { describirEstadoSync, useEstadoSync } from '@/shared/lib';

export function IndicadorSync() {
  const estado = useEstadoSync();
  if (estado.tipo === 'sincronizado') return null;

  return (
    <div
      role="status"
      className="pointer-events-auto w-fit max-w-full rounded-panel bg-ink px-3 py-2 text-meta text-paper shadow-toast"
    >
      {describirEstadoSync(estado)}
    </div>
  );
}
