import type { ReactNode } from 'react';

export interface SeccionesEnFilasProps {
  children: ReactNode;
  separacion?: string;
  className?: string;
}

export function SeccionesEnFilas({
  children,
  separacion = 'gap-3 @min-[40rem]/secciones:gap-4',
  className = '',
}: SeccionesEnFilasProps) {
  return (
    <div data-reparto="filas" className={['min-w-0 md:@container/secciones', className].join(' ')}>
      <div
        className={[
          'flex min-w-0 flex-col @min-[44rem]/secciones:[--campo-corto:8rem] @min-[44rem]/secciones:[--campo-medio:16rem] @min-[44rem]/secciones:[--campo-largo:24rem]',
          separacion,
        ].join(' ')}
      >
        {children}
      </div>
    </div>
  );
}

export interface SeccionEnFilaProps {
  id: string;
  titulo: ReactNode;
  bajada?: ReactNode;
  children: ReactNode;
  cuerpo?: string;
}

export function SeccionEnFila({ id, titulo, bajada, children, cuerpo = '' }: SeccionEnFilaProps) {
  return (
    <section
      aria-labelledby={id}
      data-reparto="fila"
      className="relative flex min-w-0 flex-col gap-3.5 rounded-panel border border-hairline bg-paper px-4 py-4 md:px-5 @min-[44rem]/secciones:grid @min-[44rem]/secciones:grid-cols-[15rem_minmax(0,1fr)] @min-[44rem]/secciones:items-start @min-[44rem]/secciones:gap-x-12"
    >
      <div className="flex min-w-0 flex-col gap-3.5 @min-[44rem]/secciones:gap-1.5">
        <h2 id={id} className="text-section font-semibold">
          {titulo}
        </h2>
        {bajada}
      </div>
      <div className={['flex min-w-0 flex-col gap-3.5', cuerpo].join(' ')}>{children}</div>
    </section>
  );
}
