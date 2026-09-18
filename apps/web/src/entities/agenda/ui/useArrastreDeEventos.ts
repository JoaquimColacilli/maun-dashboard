import { puedeArrastrarse, type EventoDeLaAgenda } from '@maun/domain';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';

import { diaEnPalabras, nombreDelEvento } from '../model/calendario';

export const ESPERA_DEL_DEDO_MS = 350;
export const MOVIMIENTO_QUE_ARRASTRA_PX = 4;
export const MOVIMIENTO_QUE_CANCELA_LA_ESPERA_PX = 10;

export type ConQue = 'puntero' | 'teclado';

export interface ArrastreEnCurso {
  evento: EventoDeLaAgenda;
  destino: string;
  conQue: ConQue;
}

interface Gesto {
  pointerId: number;
  evento: EventoDeLaAgenda;
  desde: { x: number; y: number };
  conDedo: boolean;
  empezado: boolean;
  reloj: ReturnType<typeof setTimeout> | undefined;
}

export interface PropsDelChip {
  onPointerDown: (evento: PointerEvent<HTMLElement>) => void;
  onPointerMove: (evento: PointerEvent<HTMLElement>) => void;
  onPointerUp: (evento: PointerEvent<HTMLElement>) => void;
  onPointerCancel: (evento: PointerEvent<HTMLElement>) => void;
  onKeyDown: (evento: KeyboardEvent<HTMLElement>) => void;
}

export interface UsoDelArrastre {
  fechas: readonly string[];
  alMover: (evento: EventoDeLaAgenda, fecha: string) => void;
}

export interface AccionesDelArrastre {
  arrastre: ArrastreEnCurso | null;
  anuncio: string;
  propsDelChip: (evento: EventoDeLaAgenda) => PropsDelChip | undefined;
  seAcabaDeArrastrar: () => boolean;
}

function fechaBajoElPuntero(x: number, y: number): string | undefined {
  const debajo = document.elementFromPoint(x, y);
  const celda = debajo?.closest<HTMLElement>('[data-fecha]');
  return celda?.dataset.fecha;
}

export function useArrastreDeEventos({ fechas, alMover }: UsoDelArrastre): AccionesDelArrastre {
  const [arrastre, setArrastre] = useState<ArrastreEnCurso | null>(null);
  const [anuncio, setAnuncio] = useState('');
  const gesto = useRef<Gesto | null>(null);
  const recien = useRef(false);
  const enCurso = useRef<ArrastreEnCurso | null>(null);

  // El puntero decide al soltar, en el mismo evento: el estado de React llega un render tarde.
  function anotar(siguiente: ArrastreEnCurso | null): void {
    enCurso.current = siguiente;
    setArrastre(siguiente);
  }

  const soltar = useCallback(() => {
    clearTimeout(gesto.current?.reloj);
    gesto.current = null;
  }, []);

  const cancelar = useCallback(
    (evento: EventoDeLaAgenda) => {
      soltar();
      enCurso.current = null;
      setArrastre(null);
      setAnuncio(`Lo dejaste donde estaba, el ${diaEnPalabras(evento.fecha)}.`);
    },
    [soltar],
  );

  const confirmar = useCallback(
    (arrastrado: ArrastreEnCurso) => {
      soltar();
      enCurso.current = null;
      setArrastre(null);
      if (arrastrado.destino === arrastrado.evento.fecha) {
        setAnuncio(`Lo dejaste donde estaba, el ${diaEnPalabras(arrastrado.evento.fecha)}.`);
        return;
      }
      setAnuncio(
        `Moviste ${nombreDelEvento(arrastrado.evento)} al ${diaEnPalabras(arrastrado.destino)}. El aviso tiene Deshacer.`,
      );
      alMover(arrastrado.evento, arrastrado.destino);
    },
    [alMover, soltar],
  );

  useEffect(() => {
    if (arrastre === null) return;
    const alTeclear = (tecla: globalThis.KeyboardEvent) => {
      if (tecla.key !== 'Escape') return;
      tecla.preventDefault();
      cancelar(arrastre.evento);
    };
    document.addEventListener('keydown', alTeclear, true);
    return () => {
      document.removeEventListener('keydown', alTeclear, true);
    };
  }, [arrastre, cancelar]);

  useEffect(
    () => () => {
      clearTimeout(gesto.current?.reloj);
    },
    [],
  );

  function empezar(evento: EventoDeLaAgenda, conQue: ConQue): void {
    anotar({ evento, destino: evento.fecha, conQue });
    setAnuncio(
      conQue === 'teclado'
        ? `Agarraste ${nombreDelEvento(evento)}, del ${diaEnPalabras(evento.fecha)}. Movelo con las flechas, soltalo con Enter y cancelá con Escape.`
        : `Agarraste ${nombreDelEvento(evento)}, del ${diaEnPalabras(evento.fecha)}.`,
    );
  }

  function moverA(destino: string, evento: EventoDeLaAgenda): void {
    const previo = enCurso.current;
    if (previo === null || previo.destino === destino) return;
    anotar({ ...previo, destino });
    setAnuncio(`${nombreDelEvento(evento)}, sobre el ${diaEnPalabras(destino)}.`);
  }

  function propsDelChip(evento: EventoDeLaAgenda): PropsDelChip | undefined {
    if (!puedeArrastrarse(evento)) return undefined;

    return {
      onPointerDown: (puntero) => {
        if (puntero.button !== 0 || enCurso.current !== null) return;
        // Un pointerup siempre trae su click: la marca se pone ahí y se consume ahí. Se limpia al
        // empezar por si un gesto anterior terminó sin click (el puntero se fue de la ventana).
        recien.current = false;
        const conDedo = puntero.pointerType !== 'mouse';
        const elemento = puntero.currentTarget;
        try {
          elemento.setPointerCapture(puntero.pointerId);
        } catch {
          return;
        }
        gesto.current = {
          pointerId: puntero.pointerId,
          evento,
          desde: { x: puntero.clientX, y: puntero.clientY },
          conDedo,
          empezado: false,
          reloj: conDedo
            ? setTimeout(() => {
                const actual = gesto.current;
                if (actual === null || actual.empezado) return;
                actual.empezado = true;
                empezar(evento, 'puntero');
              }, ESPERA_DEL_DEDO_MS)
            : undefined,
        };
      },
      onPointerMove: (puntero) => {
        const actual = gesto.current;
        if (actual === null || actual.pointerId !== puntero.pointerId) return;
        const corrido = Math.hypot(
          puntero.clientX - actual.desde.x,
          puntero.clientY - actual.desde.y,
        );

        if (!actual.empezado) {
          if (actual.conDedo) {
            // Con el dedo, moverse antes de que corra la espera es scrollear, no arrastrar.
            if (corrido > MOVIMIENTO_QUE_CANCELA_LA_ESPERA_PX) soltar();
            return;
          }
          if (corrido < MOVIMIENTO_QUE_ARRASTRA_PX) return;
          actual.empezado = true;
          empezar(actual.evento, 'puntero');
        }

        const destino = fechaBajoElPuntero(puntero.clientX, puntero.clientY);
        if (destino !== undefined && fechas.includes(destino)) moverA(destino, actual.evento);
      },
      onPointerUp: (puntero) => {
        const actual = gesto.current;
        if (actual === null || actual.pointerId !== puntero.pointerId) return;
        if (!actual.empezado) {
          soltar();
          return;
        }
        recien.current = true;
        const arrastrado = enCurso.current;
        if (arrastrado !== null) confirmar(arrastrado);
        else soltar();
      },
      onPointerCancel: () => {
        const actual = gesto.current;
        if (actual === null) return;
        if (actual.empezado) cancelar(actual.evento);
        else soltar();
      },
      onKeyDown: (tecla) => {
        const arrastrado = enCurso.current;
        if (arrastrado === null) {
          // Enter sigue abriendo el evento: agarrar es la barra, que no tenía uso acá.
          if (tecla.key !== ' ' && tecla.key !== 'Spacebar') return;
          tecla.preventDefault();
          empezar(evento, 'teclado');
          return;
        }
        if (arrastrado.evento.id !== evento.id) return;

        if (tecla.key === 'Enter' || tecla.key === ' ' || tecla.key === 'Spacebar') {
          tecla.preventDefault();
          confirmar(arrastrado);
          return;
        }

        const pasos: Record<string, number> = {
          ArrowLeft: -1,
          ArrowRight: 1,
          ArrowUp: -7,
          ArrowDown: 7,
        };
        const paso = pasos[tecla.key];
        if (paso === undefined) return;
        tecla.preventDefault();
        const indice = fechas.indexOf(arrastrado.destino);
        const siguiente = fechas[indice + paso];
        if (siguiente === undefined) {
          setAnuncio('No hay día para ese lado.');
          return;
        }
        moverA(siguiente, evento);
      },
    };
  }

  return {
    arrastre,
    anuncio,
    propsDelChip,
    seAcabaDeArrastrar: () => {
      const paso = recien.current;
      recien.current = false;
      return paso;
    },
  };
}
