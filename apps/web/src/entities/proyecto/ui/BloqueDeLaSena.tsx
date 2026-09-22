import type { SenaDelTrabajo } from '@maun/domain';

import { formatearPesos, formatearPorcentaje } from '@/shared/lib';

export interface BloqueDeLaSenaProps {
  sena: SenaDelTrabajo;
  propia: boolean;
}

function Numero({ clave, valor, tono = '' }: { clave: string; valor: string; tono?: string }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3 @min-[28rem]:block">
      <dt className="text-meta text-text-2">{clave}</dt>
      <dd
        className={`text-body-lg font-semibold tabular-nums whitespace-nowrap @min-[28rem]:mt-0.5 ${tono}`}
      >
        {valor}
      </dd>
    </div>
  );
}

export function BloqueDeLaSena({ sena, propia }: BloqueDeLaSenaProps) {
  if (sena.situacion === 'sin-presupuesto') {
    return (
      <section aria-label="Seña para confirmar" className="rounded-panel bg-surface-3 px-4 py-3.5">
        <h2 className="text-section font-semibold">Seña para confirmar</h2>
        <p className="mt-1 text-label leading-relaxed text-text-2">
          Todavía no hay presupuesto, así que no hay seña que calcular. Cargalo, o tildá la opción
          que te aprobaron.
        </p>
      </section>
    );
  }

  const deQuien = propia ? 'de este trabajo' : 'del taller';

  return (
    <section
      aria-label="Seña para confirmar"
      className="@container rounded-panel bg-surface-3 px-4 py-3.5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-section font-semibold">Seña para confirmar</h2>
        <span className="text-meta text-text-3">
          {formatearPorcentaje(sena.porcentaje)}% del presupuesto, {deQuien}
        </span>
      </div>

      <dl className="mt-2.5 grid grid-cols-1 gap-1.5 @min-[28rem]:grid-cols-3 @min-[28rem]:gap-x-3">
        <Numero clave="Seña" valor={formatearPesos(sena.esperada)} />
        <Numero clave="Cobrado" valor={formatearPesos(sena.cobrado)} tono="text-hogar" />
        {sena.situacion === 'falta' ? (
          <Numero clave="Falta" valor={formatearPesos(sena.falta)} />
        ) : (
          <Numero clave="Falta" valor="Nada" tono="text-hogar" />
        )}
      </dl>

      {sena.situacion === 'cubierta' && (
        <p className="mt-2 text-label leading-relaxed text-hogar">
          {sena.deMas > 0
            ? `La seña ya está cubierta, y cobraste ${formatearPesos(sena.deMas)} de más.`
            : 'La seña ya está cubierta.'}
        </p>
      )}
    </section>
  );
}
