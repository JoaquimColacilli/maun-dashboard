import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';

export interface PrincipalYApoyoProps {
  apoyo: ReactNode;
  children: ReactNode;
  apoyoPrimero?: boolean;
  amplio?: boolean;
  separacion?: string;
  className?: string;
}

const AIRE_DEL_PEGADO = 20;

const COLUMNAS = {
  antes: {
    normal: '@min-[52rem]/apoyo:grid-cols-[22.5rem_minmax(0,1fr)]',
    amplio:
      '@min-[52rem]/apoyo:grid-cols-[22.5rem_minmax(0,1fr)] @min-[64rem]/apoyo:grid-cols-[26rem_minmax(0,1fr)]',
  },
  despues: {
    normal: '@min-[52rem]/apoyo:grid-cols-[minmax(0,1fr)_22.5rem]',
    amplio:
      '@min-[52rem]/apoyo:grid-cols-[minmax(0,1fr)_22.5rem] @min-[64rem]/apoyo:grid-cols-[minmax(0,1fr)_26rem]',
  },
} as const;

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

export function topeDelApoyo(alto: number, visible: number): number {
  return entraALaVista(alto, visible) ? AIRE_DEL_PEGADO : visible - alto - AIRE_DEL_PEGADO;
}

interface Pegado {
  lado: 'arriba' | 'abajo';
  tope: number;
}

function usePegado(apoyo: RefObject<HTMLDivElement | null>): Pegado {
  const [pegado, setPegado] = useState<Pegado>({ lado: 'arriba', tope: AIRE_DEL_PEGADO });

  useLayoutEffect(() => {
    const elemento = apoyo.current;
    if (!elemento) return;
    const contenedor = queScrollea(elemento);
    const medir = () => {
      const visible = contenedor ? contenedor.clientHeight : window.innerHeight;
      const alto = elemento.offsetHeight;
      const lado = entraALaVista(alto, visible) ? 'arriba' : 'abajo';
      const tope = topeDelApoyo(alto, visible);
      setPegado((antes) => (antes.lado === lado && antes.tope === tope ? antes : { lado, tope }));
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

  return pegado;
}

export function PrincipalYApoyo({
  apoyo,
  children,
  apoyoPrimero = false,
  amplio = false,
  separacion = 'gap-y-5',
  className = '',
}: PrincipalYApoyoProps) {
  const refDelApoyo = useRef<HTMLDivElement>(null);
  const pegado = usePegado(refDelApoyo);

  const columnaDeApoyo = (
    <div
      ref={refDelApoyo}
      data-columna="apoyo"
      data-pegado={pegado.lado}
      style={{ '--tope-del-apoyo': `${String(pegado.tope)}px` } as CSSProperties}
      className="relative min-w-0 @min-[52rem]/apoyo:sticky @min-[52rem]/apoyo:top-(--tope-del-apoyo)"
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
          COLUMNAS[apoyoPrimero ? 'antes' : 'despues'][amplio ? 'amplio' : 'normal'],
          separacion,
        ].join(' ')}
      >
        {apoyoPrimero ? columnaDeApoyo : columnaPrincipal}
        {apoyoPrimero ? columnaPrincipal : columnaDeApoyo}
      </div>
    </div>
  );
}
