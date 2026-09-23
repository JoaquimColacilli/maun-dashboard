import { useMemo, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router';

import { ContextoDeLaPuerta, type PuertoDeNavegacion } from '@/shared/lib';

import { conTransicion } from '../router/transicion';

export function ProveedorDeLaPuerta({ children }: { children: ReactNode }) {
  const navegar = useNavigate();
  const puerto = useMemo<PuertoDeNavegacion>(
    () => ({
      ir: (destino, opciones) => {
        const hacer = () => {
          void navegar(destino, {
            replace: opciones.como === 'reemplazar' || opciones.como === 'terminar',
            state: opciones.state,
          });
        };
        if (!opciones.desdeLaNavegacion) {
          hacer();
          return;
        }
        conTransicion(() => {
          flushSync(hacer);
        });
      },
      volver: () => {
        void navegar(-1);
      },
      etiquetaDeVolver: (_padre, etiqueta) => etiqueta,
      hayUnaTransicion: () => false,
    }),
    [navegar],
  );
  return <ContextoDeLaPuerta value={puerto}>{children}</ContextoDeLaPuerta>;
}
