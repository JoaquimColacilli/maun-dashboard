import { elMueble } from '@maun/domain';

import { Carita, type UltimaSinLeer } from '@/entities/opinion';
import { rutaDeLaRespuesta, Ir } from '@/shared/lib';
import { Icono } from '@/shared/ui';

export function UltimaOpinion({ ultima }: { ultima: UltimaSinLeer }) {
  const quien = ultima.cliente === '' ? 'Un cliente' : ultima.cliente;
  const frase =
    ultima.comentario === null ? (ultima.titular?.etiqueta ?? null) : `«${ultima.comentario}»`;

  return (
    <Ir
      a={rutaDeLaRespuesta(ultima.respuestaId)}
      className="flex items-start gap-2.75 rounded-panel border border-op-mal bg-paper px-3.25 py-3 text-left text-ink no-underline hover:bg-surface"
    >
      {ultima.titular !== null && (
        <span className="flex-none pt-px">
          <Carita paso={ultima.titular} tamano={20} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-label text-text-2">
          {quien} opinó de su {elMueble(ultima.trabajo)}
        </span>
        {frase !== null && (
          <span className="mt-0.5 line-clamp-2 block text-body-sm leading-normal">{frase}</span>
        )}
      </span>
      <span aria-hidden className="flex flex-none pt-0.5">
        <Icono nombre="chevron-right" tamano={17} />
      </span>
    </Ir>
  );
}
