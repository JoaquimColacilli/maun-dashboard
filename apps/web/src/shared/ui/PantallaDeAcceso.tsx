import type { ReactNode } from 'react';

const BARRAS = [
  { color: 'bg-hogar', ancho: 'w-[26px]' },
  { color: 'bg-maun', ancho: 'w-[46px]' },
  { color: 'bg-diezmo', ancho: 'w-[14px]' },
  { color: 'bg-cocos', ancho: 'w-[34px]' },
] as const;

export function PantallaDeAcceso({
  titulo,
  bajada,
  children,
  pie,
}: {
  titulo: string;
  bajada: string;
  children: ReactNode;
  pie?: ReactNode;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[5fr_6fr]">
      <aside className="hidden flex-col justify-between bg-marca p-12 text-sobre-marca lg:flex">
        <span className="font-display text-h1-lg">MAUN</span>
        <div className="flex max-w-[420px] flex-col gap-4">
          <div className="flex gap-1.5">
            {BARRAS.map((barra) => (
              <span key={barra.color} className={`h-3.5 ${barra.ancho} ${barra.color}`} />
            ))}
          </div>
          <p className="text-body-lg leading-normal text-sobre-marca">
            Cuánto falta cobrar, qué se entrega esta semana y a dónde va cada peso cuando se cobra.
          </p>
        </div>
        <span className="text-label text-sobre-marca/60">Un taller, cuatro tesoros.</span>
      </aside>

      <main className="flex flex-col justify-center px-(--page-pad-mobile) py-12 md:px-(--page-pad-tablet)">
        <div className="mx-auto flex w-full max-w-[380px] flex-col gap-7">
          <header className="flex flex-col gap-3.5">
            <div className="flex gap-1 lg:hidden">
              {BARRAS.map((barra) => (
                <span key={barra.color} className={`h-2.5 ${barra.ancho} ${barra.color}`} />
              ))}
            </div>
            <h1 className="font-display text-wordmark leading-tight">{titulo}</h1>
            <p className="text-body leading-relaxed text-text-2">{bajada}</p>
          </header>
          {children}
          {pie !== undefined && <div className="flex flex-col gap-2 text-label">{pie}</div>}
        </div>
      </main>
    </div>
  );
}
