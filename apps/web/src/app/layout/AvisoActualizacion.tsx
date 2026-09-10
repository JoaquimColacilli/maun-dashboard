import { useRegisterSW } from 'virtual:pwa-register/react';

import { Button } from '@/shared/ui';

export function AvisoActualizacion() {
  const {
    needRefresh: [hayVersionNueva],
    updateServiceWorker,
  } = useRegisterSW();

  if (!hayVersionNueva) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-4 top-4 z-20 mx-auto flex w-fit max-w-full items-center gap-3 rounded-panel bg-ink px-4 py-3 text-body text-paper shadow-toast"
    >
      Hay una versión nueva de la app.
      <Button
        size="chico"
        variant="secundario"
        onClick={() => {
          void updateServiceWorker(true);
        }}
      >
        Actualizar
      </Button>
    </div>
  );
}
