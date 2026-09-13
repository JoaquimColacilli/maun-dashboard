import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

import { Button } from '@/shared/ui';

import {
  desplazar,
  ENCUADRE_INICIAL,
  recorteEnLaFuente,
  reescalarAlViewport,
  vistaDeLaImagen,
  zoomAlrededorDe,
  zoomMaximo,
  type Encuadre,
  type Punto,
  type Recorte,
} from '../model/encuadre';
import type { ImagenDecodificada } from '../model/imagen';

const PASO_DE_TECLADO = 10;
const PASO_LARGO = 50;
const FACTOR_DE_ZOOM = 1.25;
const CENTRO: Punto = { x: 0, y: 0 };

interface Gesto {
  encuadre: Encuadre;
  distancia: number;
  medio: Punto;
}

export interface RecortadorDeFotoProps {
  imagen: ImagenDecodificada;
  guardando: boolean;
  error: string | undefined;
  alGuardar: (recorte: Recorte) => void;
  alCancelar: () => void;
}

function puntoRelativo(elemento: HTMLElement, evento: { clientX: number; clientY: number }): Punto {
  const caja = elemento.getBoundingClientRect();
  return {
    x: evento.clientX - caja.left - caja.width / 2,
    y: evento.clientY - caja.top - caja.height / 2,
  };
}

function medioYDistancia(punteros: ReadonlyMap<number, Punto>): {
  medio: Punto;
  distancia: number;
} {
  const [uno, otro] = [...punteros.values()];
  if (!uno || !otro) return { medio: uno ?? CENTRO, distancia: 0 };
  return {
    medio: { x: (uno.x + otro.x) / 2, y: (uno.y + otro.y) / 2 },
    distancia: Math.hypot(uno.x - otro.x, uno.y - otro.y),
  };
}

export function RecortadorDeFoto({
  imagen,
  guardando,
  error,
  alGuardar,
  alCancelar,
}: RecortadorDeFotoProps) {
  const escenario = useRef<HTMLDivElement>(null);
  const viewportPrevio = useRef(0);
  const punteros = useRef(new Map<number, Punto>());
  const gesto = useRef<Gesto | null>(null);
  const encuadreVigente = useRef<Encuadre>(ENCUADRE_INICIAL);
  const [viewport, setViewport] = useState(0);
  const [encuadre, setEncuadre] = useState<Encuadre>(ENCUADRE_INICIAL);
  const idAyuda = useId();

  const fuente = imagen.tamano;
  const maximo = zoomMaximo(fuente);

  useEffect(() => {
    encuadreVigente.current = encuadre;
  }, [encuadre]);

  useLayoutEffect(() => {
    const elemento = escenario.current;
    if (!elemento) return;
    const medir = () => {
      const lado = elemento.getBoundingClientRect().width;
      if (lado <= 0) return;
      const anterior = viewportPrevio.current;
      viewportPrevio.current = lado;
      if (anterior > 0 && anterior !== lado) {
        setEncuadre((actual) => reescalarAlViewport(actual, anterior, lado));
      }
      setViewport(lado);
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(elemento);
    return () => {
      observador.disconnect();
    };
  }, []);

  useEffect(() => {
    const elemento = escenario.current;
    if (!elemento || viewport <= 0) return;
    const alRodar = (evento: WheelEvent) => {
      evento.preventDefault();
      const escala = evento.deltaMode === 1 ? 16 : 1;
      const sensibilidad = evento.ctrlKey ? 0.01 : 0.0015;
      const factor = Math.exp(-evento.deltaY * escala * sensibilidad);
      const punto = puntoRelativo(elemento, evento);
      setEncuadre((actual) =>
        zoomAlrededorDe(fuente, viewport, actual, actual.zoom * factor, punto, maximo),
      );
    };
    elemento.addEventListener('wheel', alRodar, { passive: false });
    return () => {
      elemento.removeEventListener('wheel', alRodar);
    };
  }, [fuente, viewport, maximo]);

  function empezarGesto(): void {
    const { medio, distancia } = medioYDistancia(punteros.current);
    gesto.current = { encuadre: encuadreVigente.current, distancia, medio };
  }

  function zoomDesdeElCentro(factor: number): void {
    if (viewport <= 0) return;
    setEncuadre((actual) =>
      zoomAlrededorDe(fuente, viewport, actual, actual.zoom * factor, CENTRO, maximo),
    );
  }

  const vista = viewport > 0 ? vistaDeLaImagen(fuente, viewport, encuadre) : null;

  return (
    <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:px-6 md:py-5">
      <p id={idAyuda} className="text-label leading-relaxed text-text-2">
        Arrastrá la foto para encuadrarla y acercala con el zoom. Con el teclado: las flechas la
        mueven y + y − la acercan o la alejan.
      </p>

      <div
        ref={escenario}
        tabIndex={0}
        role="group"
        aria-roledescription="recortador de foto"
        aria-label="Encuadre de la foto"
        aria-describedby={idAyuda}
        data-zoom={encuadre.zoom.toFixed(2)}
        className="relative mx-auto aspect-square w-full max-w-[320px] cursor-grab touch-none overflow-hidden rounded-field bg-surface-2 select-none active:cursor-grabbing"
        onPointerDown={(evento) => {
          evento.currentTarget.setPointerCapture(evento.pointerId);
          punteros.current.set(evento.pointerId, puntoRelativo(evento.currentTarget, evento));
          empezarGesto();
        }}
        onPointerMove={(evento) => {
          const previo = punteros.current.get(evento.pointerId);
          if (!previo || viewport <= 0) return;
          const actual = puntoRelativo(evento.currentTarget, evento);
          punteros.current.set(evento.pointerId, actual);

          if (punteros.current.size === 1) {
            setEncuadre((vigente) =>
              desplazar(fuente, viewport, vigente, {
                x: actual.x - previo.x,
                y: actual.y - previo.y,
              }),
            );
            return;
          }

          const inicio = gesto.current;
          if (!inicio || inicio.distancia === 0) return;
          const { medio, distancia } = medioYDistancia(punteros.current);
          const movido = desplazar(fuente, viewport, inicio.encuadre, {
            x: medio.x - inicio.medio.x,
            y: medio.y - inicio.medio.y,
          });
          setEncuadre(
            zoomAlrededorDe(
              fuente,
              viewport,
              movido,
              (inicio.encuadre.zoom * distancia) / inicio.distancia,
              medio,
              maximo,
            ),
          );
        }}
        onPointerUp={(evento) => {
          punteros.current.delete(evento.pointerId);
          empezarGesto();
        }}
        onPointerCancel={(evento) => {
          punteros.current.delete(evento.pointerId);
          empezarGesto();
        }}
        onKeyDown={(evento) => {
          if (viewport <= 0) return;
          const paso = evento.shiftKey ? PASO_LARGO : PASO_DE_TECLADO;
          const movimientos: Partial<Record<string, Punto>> = {
            ArrowLeft: { x: -paso, y: 0 },
            ArrowRight: { x: paso, y: 0 },
            ArrowUp: { x: 0, y: -paso },
            ArrowDown: { x: 0, y: paso },
          };
          const delta = movimientos[evento.key];
          if (delta) {
            evento.preventDefault();
            setEncuadre((vigente) => desplazar(fuente, viewport, vigente, delta));
            return;
          }
          if (evento.key === '+' || evento.key === '=') {
            evento.preventDefault();
            zoomDesdeElCentro(FACTOR_DE_ZOOM);
          } else if (evento.key === '-' || evento.key === '_') {
            evento.preventDefault();
            zoomDesdeElCentro(1 / FACTOR_DE_ZOOM);
          } else if (evento.key === '0') {
            evento.preventDefault();
            setEncuadre(ENCUADRE_INICIAL);
          }
        }}
      >
        {vista && (
          <img
            src={imagen.url}
            alt=""
            draggable={false}
            className="pointer-events-none absolute top-0 left-0 max-w-none origin-top-left"
            style={{
              width: vista.ancho,
              height: vista.alto,
              transform: `translate(${String(vista.izquierda)}px, ${String(vista.arriba)}px)`,
            }}
          />
        )}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-pill [box-shadow:0_0_0_100vmax_var(--velo)]"
        />
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="secundario"
          size="chico"
          aria-label="Alejar"
          disabled={encuadre.zoom <= 1}
          onClick={() => {
            zoomDesdeElCentro(1 / FACTOR_DE_ZOOM);
          }}
        >
          −
        </Button>
        <input
          type="range"
          min={1}
          max={maximo}
          step={0.01}
          value={encuadre.zoom}
          aria-label="Zoom"
          disabled={maximo <= 1}
          onChange={(evento) => {
            const zoom = Number(evento.target.value);
            if (viewport <= 0) return;
            setEncuadre((vigente) =>
              zoomAlrededorDe(fuente, viewport, vigente, zoom, CENTRO, maximo),
            );
          }}
          className="min-w-0 flex-1 accent-ink"
        />
        <Button
          variant="secundario"
          size="chico"
          aria-label="Acercar"
          disabled={encuadre.zoom >= maximo}
          onClick={() => {
            zoomDesdeElCentro(FACTOR_DE_ZOOM);
          }}
        >
          +
        </Button>
      </div>

      {error !== undefined && (
        <p role="alert" className="text-label leading-relaxed font-medium text-alerta">
          {error}
        </p>
      )}

      <div className="flex gap-2.5">
        <Button variant="secundario" className="flex-1" onClick={alCancelar}>
          Cancelar
        </Button>
        <Button
          className="flex-1"
          cargando={guardando}
          disabled={viewport <= 0}
          onClick={() => {
            if (viewport > 0) alGuardar(recorteEnLaFuente(fuente, viewport, encuadre));
          }}
        >
          Guardar la foto
        </Button>
      </div>
    </div>
  );
}
