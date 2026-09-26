import type { EventoPropio } from '@maun/domain';
import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

import type { AccionesDeLaAgenda } from './FilaDeEvento';

interface CasillaPorEnfocar {
  id: string;
  hecha: boolean;
}

export interface AccionesConFoco<T extends HTMLElement> {
  raiz: RefObject<T | null>;
  acciones: AccionesDeLaAgenda;
}

export function useAccionesConFoco<T extends HTMLElement>(
  acciones: AccionesDeLaAgenda,
): AccionesConFoco<T> {
  const raiz = useRef<T>(null);
  const porEnfocar = useRef<CasillaPorEnfocar | null>(null);
  const [recienHecha, setRecienHecha] = useState<string | null>(null);

  useLayoutEffect(() => {
    const pendiente = porEnfocar.current;
    if (pendiente === null) return;
    const casilla = raiz.current?.querySelector<HTMLElement>(
      `[data-anotacion="${pendiente.id}"][data-hecha="${String(pendiente.hecha)}"] [role="checkbox"]`,
    );
    if (!casilla) return;
    porEnfocar.current = null;
    casilla.focus();
  });

  return {
    raiz,
    acciones: {
      ...acciones,
      alTildar: (evento: EventoPropio) => {
        porEnfocar.current = { id: evento.id, hecha: !evento.hecha };
        setRecienHecha(evento.hecha ? null : evento.id);
        acciones.alTildar(evento);
      },
      recienHecha,
      alTerminarDeTachar: () => {
        setRecienHecha(null);
      },
    },
  };
}
