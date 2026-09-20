import { useEffect } from 'react';

export function usePantallaDespierta(activa: boolean): void {
  useEffect(() => {
    // Los tipos del DOM dan wakeLock por sentado, pero en Firefox de Android y en los iPhone
    // anteriores a iOS 16.4 no existe. Se pregunta por la propiedad, que es lo que se puede
    // preguntar en tiempo de ejecución.
    if (!activa || !('wakeLock' in navigator)) return;

    let vigente: WakeLockSentinel | null = null;
    let cancelado = false;

    const pedir = (): void => {
      if (cancelado || document.visibilityState !== 'visible') return;
      void navigator.wakeLock
        .request('screen')
        .then((sentinela) => {
          if (cancelado) {
            void sentinela.release().catch(() => undefined);
            return;
          }
          vigente = sentinela;
        })
        .catch(() => undefined);
    };

    const alVolver = (): void => {
      if (document.visibilityState === 'visible' && vigente === null) pedir();
    };

    pedir();
    document.addEventListener('visibilitychange', alVolver);

    return () => {
      cancelado = true;
      document.removeEventListener('visibilitychange', alVolver);
      if (vigente !== null) void vigente.release().catch(() => undefined);
      vigente = null;
    };
  }, [activa]);
}
