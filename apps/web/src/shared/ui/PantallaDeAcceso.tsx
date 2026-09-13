import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

import { Avatar } from '@maun/ui';

import { useAnchoDePantalla, useVentanaVisible } from '@/shared/lib';

const LEMA =
  'Cuánto falta cobrar, qué se entrega esta semana y a dónde va cada peso cuando se cobra.';

const ALTO_COMPACTO = 620;
const MARGEN_AL_ACOMODAR = 12;

export const ENLACE_DE_ACCESO =
  'inline-flex min-h-tap items-center font-medium text-ink underline underline-offset-3';

export const ENLACE_DE_CAMPO =
  'relative text-label font-medium text-ink underline underline-offset-3 after:absolute after:-inset-x-2 after:-inset-y-3.5';

const PIEZAS = [
  { tesoro: 'hogar', color: 'bg-hogar', parte: 26 },
  { tesoro: 'maun', color: 'bg-maun', parte: 46 },
  { tesoro: 'diezmo', color: 'bg-diezmo', parte: 14 },
  { tesoro: 'cocos', color: 'bg-cocos', parte: 34 },
] as const;

let elCantoYaSeCorto = false;

function corte(indice: number): CSSProperties {
  return {
    animationName: 'maun-corte',
    animationDuration: 'var(--dur-corte)',
    animationTimingFunction: 'var(--ease-out)',
    animationFillMode: 'both',
    animationDelay: `calc(${String(indice)} * var(--dur-corte-stagger) / 4)`,
  };
}

function Canto() {
  const [cortar] = useState(() => !elCantoYaSeCorto);

  useEffect(() => {
    elCantoYaSeCorto = true;
  }, []);

  return (
    <div aria-hidden data-canto className="absolute inset-x-0 bottom-0 flex h-1.5 gap-0.5">
      {PIEZAS.map((pieza, indice) => (
        <span
          key={pieza.tesoro}
          className={pieza.color}
          style={{ flex: `${String(pieza.parte)} 1 0`, ...(cortar ? corte(indice) : {}) }}
        />
      ))}
    </div>
  );
}

function mostrarDentro(contenedor: HTMLElement, elemento: Element): void {
  const caja = contenedor.getBoundingClientRect();
  const pieza = elemento.getBoundingClientRect();
  if (pieza.bottom > caja.bottom - MARGEN_AL_ACOMODAR) {
    contenedor.scrollTop += pieza.bottom - caja.bottom + MARGEN_AL_ACOMODAR;
  } else if (pieza.top < caja.top + MARGEN_AL_ACOMODAR) {
    contenedor.scrollTop -= caja.top - pieza.top + MARGEN_AL_ACOMODAR;
  }
}

export interface PersonaDeLaSesion {
  nombre: string;
  email: string;
  foto: string;
}

export interface PantallaDeAccesoProps {
  titulo: string;
  bajada?: ReactNode;
  children: ReactNode;
  pie?: ReactNode;
  nota?: ReactNode;
  persona?: PersonaDeLaSesion;
}

export function PantallaDeAcceso({
  titulo,
  bajada,
  children,
  pie,
  nota,
  persona,
}: PantallaDeAccesoProps) {
  const ancho = useAnchoDePantalla();
  const ventana = useVentanaVisible();
  const desplazable = useRef<HTMLDivElement>(null);
  const encabezado = useRef<HTMLHeadingElement>(null);

  const enCelular = ancho === 'movil';
  const altoVisible = enCelular ? ventana?.alto : undefined;
  const compacto = altoVisible !== undefined && altoVisible < ALTO_COMPACTO;

  useEffect(() => {
    encabezado.current?.focus({ preventScroll: true });
  }, [titulo]);

  useEffect(() => {
    const contenedor = desplazable.current;
    if (altoVisible === undefined || !contenedor) return;
    let cuadro = 0;
    const acomodar = () => {
      cancelAnimationFrame(cuadro);
      cuadro = requestAnimationFrame(() => {
        const activo = contenedor.ownerDocument.activeElement;
        if (!(activo instanceof HTMLInputElement) || !contenedor.contains(activo)) return;
        const enviar = activo.form?.querySelector('button[type="submit"]');
        if (enviar) mostrarDentro(contenedor, enviar);
        mostrarDentro(contenedor, activo);
      });
    };
    acomodar();
    contenedor.addEventListener('focusin', acomodar);
    return () => {
      cancelAnimationFrame(cuadro);
      contenedor.removeEventListener('focusin', acomodar);
    };
  }, [altoVisible]);

  const nombreVisible = persona && (persona.nombre === '' ? persona.email : persona.nombre);

  return (
    <div
      ref={desplazable}
      data-pantalla-de-acceso
      style={
        enCelular && ventana !== undefined
          ? { height: ventana.alto, transform: `translateY(${String(ventana.arriba)}px)` }
          : undefined
      }
      className="h-full overflow-y-auto overscroll-contain bg-paper"
    >
      <div className="flex min-h-full flex-col lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:grid-rows-[auto_1fr_auto]">
        <aside
          className={`relative flex flex-1 flex-col gap-1 overflow-hidden bg-marca px-(--page-pad-mobile) pt-[calc(env(safe-area-inset-top)+18px)] text-sobre-marca md:px-(--page-pad-tablet) lg:row-span-3 lg:grid lg:min-h-0 lg:grid-rows-subgrid lg:gap-0 lg:p-12 ${
            compacto ? 'min-h-0 pb-4' : 'min-h-[calc(env(safe-area-inset-top)+64px)] pb-7'
          }`}
        >
          <p className="font-display text-h1-lg leading-none lg:row-start-1">MAUN</p>
          <p className="text-label text-sobre-marca/60 lg:row-start-3 lg:self-end">
            Un taller, cuatro tesoros.
          </p>
          {!compacto &&
            (persona && nombreVisible !== undefined ? (
              <div className="mt-auto flex min-w-0 items-center gap-3.5 pt-8 lg:row-start-2 lg:mt-0 lg:self-center lg:pt-0">
                <Avatar nombre={nombreVisible} foto={persona.foto} tamano="grande" />
                <div className="min-w-0">
                  <p className="truncate text-body-lg font-semibold">{nombreVisible}</p>
                  {persona.nombre !== '' && (
                    <p className="truncate text-label text-sobre-marca/70">{persona.email}</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="mt-auto max-w-[24ch] pt-8 text-lema leading-snug text-pretty lg:row-start-2 lg:mt-0 lg:max-w-[420px] lg:self-center lg:pt-0">
                {LEMA}
              </p>
            ))}
          <Canto />
        </aside>

        <main className="flex flex-none flex-col px-(--page-pad-mobile) pt-7 pb-[calc(env(safe-area-inset-bottom)+20px)] md:px-(--page-pad-tablet) lg:row-span-3 lg:grid lg:grid-rows-subgrid lg:px-16 lg:py-12 xl:px-24">
          <div className="flex w-full max-w-[400px] flex-col gap-6 md:mx-auto lg:row-start-2 lg:mx-0 lg:self-center">
            <header className="flex flex-col gap-2">
              <h1
                ref={encabezado}
                tabIndex={-1}
                className="font-display text-h1 leading-tight focus:outline-none lg:text-h1-lg"
              >
                {titulo}
              </h1>
              {bajada !== undefined && (
                <p className="text-body leading-relaxed text-text-2">{bajada}</p>
              )}
            </header>
            {children}
            {pie !== undefined && (
              <div className="-mt-2 flex flex-col text-label text-text-2">{pie}</div>
            )}
          </div>
          {nota !== undefined && (
            <p className="mt-5 w-full max-w-[400px] text-meta leading-relaxed text-text-3 md:mx-auto lg:row-start-3 lg:mx-0 lg:mt-0 lg:self-end">
              {nota}
            </p>
          )}
        </main>
      </div>
    </div>
  );
}
