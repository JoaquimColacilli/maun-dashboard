import { useEffect, useRef, useState } from 'react';

import { copiar, type ComoQuedo } from '@/shared/lib';

import { Icono } from '@maun/ui';

export interface DatoCopiableProps {
  etiqueta: string;
  valor: string;
  paraCopiar?: string;
  nombre: string;
}

const MUESTRA_MS = 4_000;

const DICHO: Readonly<Record<Exclude<ComoQuedo, 'nada'>, string>> = {
  copiado: 'Copiado',
  seleccionado: 'Quedó seleccionado: mantené apretado y elegí Copiar',
};

const NO_SE_PUDO = 'No se pudo copiar. Marcalo con el dedo y copialo desde el menú del teléfono.';

export function DatoCopiable({ etiqueta, valor, paraCopiar, nombre }: DatoCopiableProps) {
  const [comoQuedo, setComoQuedo] = useState<ComoQuedo | null>(null);
  const [anuncio, setAnuncio] = useState('');
  const elValor = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (comoQuedo === null) return;
    const reloj = setTimeout(() => {
      setComoQuedo(null);
      setAnuncio('');
    }, MUESTRA_MS);
    return () => {
      clearTimeout(reloj);
    };
  }, [comoQuedo]);

  function alTocar(): void {
    void copiar(paraCopiar ?? valor, elValor.current).then((resultado) => {
      setComoQuedo(resultado);
      setAnuncio(resultado === 'nada' ? NO_SE_PUDO : DICHO[resultado]);
    });
  }

  return (
    <div className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 border-t border-hairline-soft py-2.5 first:border-t-0">
      <span className="min-w-0 flex-1">
        <span className="block text-label text-text-2">{etiqueta}</span>
        <span
          ref={elValor}
          className="block text-body font-semibold break-all tabular-nums select-text"
        >
          {valor}
        </span>
      </span>

      <button
        type="button"
        aria-label={nombre}
        onClick={alTocar}
        className={`flex min-h-tap flex-none items-center gap-1.5 rounded-field border px-3 text-label font-semibold ${
          comoQuedo === 'copiado'
            ? 'border-hogar text-hogar'
            : 'border-border hover:border-ink hover:bg-surface'
        }`}
      >
        <Icono nombre={comoQuedo === 'copiado' ? 'check' : 'copy'} tamano={16} />
        {comoQuedo === 'copiado' ? 'Copiado' : 'Copiar'}
      </button>

      <span role="status" className="sr-only">
        {anuncio}
      </span>

      {comoQuedo !== null && comoQuedo !== 'copiado' && (
        <span className="w-full text-label leading-normal text-atencion">
          {comoQuedo === 'seleccionado' ? DICHO.seleccionado : NO_SE_PUDO}
        </span>
      )}
    </div>
  );
}
