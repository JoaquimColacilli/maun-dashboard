import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { ContextoDeLaPuerta, type PuertoDeNavegacion } from '@/shared/lib';

import { conTransicion } from '../router/transicion';
import { historialDelNavegador } from './historial';
import { etiquetaDeVolver, planDeIr, planDeVolver, type Paso, type Situacion } from './pila';

const TOPE_DE_UN_PASO_MS = 1_500;

function conTope(paso: void | Promise<void>): Promise<void> {
  return Promise.race([
    Promise.resolve(paso),
    new Promise<void>((listo) => {
      setTimeout(listo, TOPE_DE_UN_PASO_MS);
    }),
  ]);
}

function esCelular(): boolean {
  return !globalThis.matchMedia('(min-width: 768px)').matches;
}

export function ProveedorDeLaPuerta({ children }: { children: ReactNode }) {
  const navegar = useNavigate();
  const location = useLocation();
  const ubicacion = useRef(location);
  useLayoutEffect(() => {
    ubicacion.current = location;
  });

  const puerto = useMemo<PuertoDeNavegacion>(() => {
    const situacion = (): Situacion => {
      const historial = historialDelNavegador();
      const { pathname, search } = ubicacion.current;
      return {
        actual: `${pathname}${search}`,
        anteriores: historial.anteriores(),
        movil: esCelular(),
        conHistorial: historial.disponible(),
      };
    };

    const ejecutar = async (pasos: readonly Paso[]) => {
      for (const paso of pasos) {
        if (paso.tipo === 'atras') {
          await conTope(navegar(-paso.saltos));
          continue;
        }
        await conTope(
          navegar(paso.url, { replace: paso.tipo === 'reemplazar', state: paso.state }),
        );
      }
    };

    return {
      ir: (destino, opciones) => {
        const { pasos } = planDeIr(destino, opciones, situacion());
        if (pasos.length === 0) return;
        if (opciones.desdeLaNavegacion) {
          conTransicion(() => ejecutar(pasos));
          return;
        }
        void ejecutar(pasos);
      },
      volver: (padre) => {
        void ejecutar(planDeVolver(padre, situacion()).pasos);
      },
      etiquetaDeVolver: (padre, etiqueta) =>
        etiquetaDeVolver(padre, etiqueta, historialDelNavegador().anteriores()),
      hayUnaTransicion: () => false,
    };
  }, [navegar]);

  return <ContextoDeLaPuerta value={puerto}>{children}</ContextoDeLaPuerta>;
}
