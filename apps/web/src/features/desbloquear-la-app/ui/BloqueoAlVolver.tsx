import { useLayoutEffect, useRef } from 'react';

import { PantallaDeBloqueo } from './PantallaDeBloqueo';

export function BloqueoAlVolver() {
  const dialogo = useRef<HTMLDialogElement>(null);
  const saliendo = useRef(false);

  useLayoutEffect(() => {
    const elemento = dialogo.current;
    if (!elemento) return;
    saliendo.current = false;
    if (!elemento.open) elemento.showModal();
    return () => {
      saliendo.current = true;
      if (elemento.open) elemento.close();
    };
  }, []);

  return (
    <dialog
      ref={dialogo}
      aria-label="La app está bloqueada"
      onCancel={(evento) => {
        evento.preventDefault();
      }}
      onClose={() => {
        if (!saliendo.current) dialogo.current?.showModal();
      }}
      className="fixed inset-0 m-0 size-full max-h-none max-w-none bg-paper p-0 text-ink backdrop:bg-paper"
    >
      <PantallaDeBloqueo />
    </dialog>
  );
}
