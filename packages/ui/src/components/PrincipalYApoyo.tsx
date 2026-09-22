import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';

export interface PrincipalYApoyoProps {
  apoyo: ReactNode;
  children: ReactNode;
  apoyoPrimero?: boolean;
  separacion?: string;
  className?: string;
}

const AIRE_DEL_PEGADO = 20;

function queScrollea(elemento: HTMLElement): HTMLElement | null {
  for (let actual = elemento.parentElement; actual; actual = actual.parentElement) {
    const { overflowY } = getComputedStyle(actual);
    if (overflowY === 'auto' || overflowY === 'scroll') return actual;
  }
  return null;
}

export function entraALaVista(alto: number, visible: number): boolean {
  return alto + 2 * AIRE_DEL_PEGADO <= visible;
}

function useEntraALaVista(apoyo: RefObject<HTMLDivElement | null>): boolean {
  const [entra, setEntra] = useState(false);

  useLayoutEffect(() => {
    const elemento = apoyo.current;
    if (!elemento) return;
    const contenedor = queScrollea(elemento);
    const medir = () => {
      const visible = contenedor ? contenedor.clientHeight : window.innerHeight;
      setEntra(entraALaVista(elemento.offsetHeight, visible));
    };
    medir();
    const observador = 'ResizeObserver' in globalThis ? new ResizeObserver(medir) : null;
    observador?.observe(elemento);
    if (contenedor) observador?.observe(contenedor);
    window.addEventListener('resize', medir);
    return () => {
      observador?.disconnect();
      window.removeEventListener('resize', medir);
    };
  }, [apoyo]);

  return entra;
}

export function PrincipalYApoyo({
  apoyo,
  children,
  apoyoPrimero = false,
  separacion = 'gap-y-5',
  className = '',
}: PrincipalYApoyoProps) {
  const refDelApoyo = useRef<HTMLDivElement>(null);
  const pegado = useEntraALaVista(refDelApoyo);

  const columnaDeApoyo = (
    <div
      ref={refDelApoyo}
      data-columna="apoyo"
      data-pegado={pegado ? '' : undefined}
      className="relative min-w-0 @min-[52rem]/apoyo:data-pegado:sticky @min-[52rem]/apoyo:data-pegado:top-5"
    >
      {apoyo}
    </div>
  );
  const columnaPrincipal = (
    <div data-columna="principal" className="relative min-w-0">
      {children}
    </div>
  );

  return (
    <div data-reparto="apoyo" className={['min-w-0 md:@container/apoyo', className].join(' ')}>
      <div
        className={[
          'grid grid-cols-1 items-start @min-[52rem]/apoyo:gap-x-11',
          apoyoPrimero
            ? '@min-[52rem]/apoyo:grid-cols-[22.5rem_minmax(0,1fr)]'
            : '@min-[52rem]/apoyo:grid-cols-[minmax(0,1fr)_22.5rem]',
          separacion,
        ].join(' ')}
      >
        {apoyoPrimero ? columnaDeApoyo : columnaPrincipal}
        {apoyoPrimero ? columnaPrincipal : columnaDeApoyo}
      </div>
    </div>
  );
}
