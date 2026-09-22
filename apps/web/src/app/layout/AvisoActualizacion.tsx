import { aplicarLaVersionNueva, useVersionNueva } from '@/shared/lib';
import { Button } from '@/shared/ui';

export function AvisoActualizacion() {
  const hayVersionNueva = useVersionNueva();

  if (!hayVersionNueva) return null;

  return (
    <div
      role="status"
      data-aviso-de-version
      className="fixed inset-x-4 top-4 z-20 mx-auto flex w-fit max-w-full items-center gap-3 rounded-panel bg-ink px-4 py-3 text-body text-paper shadow-toast"
    >
      Hay una versión nueva de la app.
      <Button size="chico" variant="secundario" onClick={aplicarLaVersionNueva}>
        Actualizar
      </Button>
    </div>
  );
}
