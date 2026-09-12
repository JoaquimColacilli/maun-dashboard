import type { ReactNode } from 'react';

export function EnConstruccion({
  titulo,
  detalle,
  children,
}: {
  titulo: string;
  detalle: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-content flex-col gap-6 px-(--page-pad-mobile) py-8 md:px-(--page-pad-tablet) lg:px-(--page-pad-desktop)">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-h1 leading-tight lg:text-h1-lg">{titulo}</h1>
        <p className="max-w-[520px] text-body leading-relaxed text-text-2">{detalle}</p>
      </header>
      {children}
    </div>
  );
}
