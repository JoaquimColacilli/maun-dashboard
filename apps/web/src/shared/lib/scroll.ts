import { useLayoutEffect, useRef, type RefObject } from 'react';
import { NavigationType, useNavigationType, type Location } from 'react-router';

export function useScrollPorPantalla(
  contenedor: RefObject<HTMLElement | null>,
  visible: Location,
): void {
  const tipo = useNavigationType();
  const posiciones = useRef(new Map<string, number>());
  const anterior = useRef<Location | null>(null);
  const claveVigente = useRef(visible.key);

  useLayoutEffect(() => {
    const elemento = contenedor.current;
    if (!elemento) return;
    const guardar = () => {
      posiciones.current.set(claveVigente.current, elemento.scrollTop);
    };
    elemento.addEventListener('scroll', guardar, { passive: true });
    return () => {
      elemento.removeEventListener('scroll', guardar);
    };
  }, [contenedor]);

  useLayoutEffect(() => {
    const previa = anterior.current;
    anterior.current = visible;
    claveVigente.current = visible.key;
    const elemento = contenedor.current;
    if (!previa || !elemento || previa.key === visible.key) return;

    if (previa.pathname === visible.pathname) {
      const guardada = posiciones.current.get(previa.key);
      if (guardada !== undefined) posiciones.current.set(visible.key, guardada);
      return;
    }

    const destino = tipo === NavigationType.Pop ? (posiciones.current.get(visible.key) ?? 0) : 0;
    elemento.scrollTo({ top: destino, behavior: 'instant' });
  }, [contenedor, visible, tipo]);
}
