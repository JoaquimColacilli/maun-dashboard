import { elMueble } from '@maun/domain';

import type { AvisoDeEntrega } from '@/entities/entrega';
import { Ir, rutaDelProyecto } from '@/shared/lib';
import { Icono } from '@/shared/ui';

import { tituloDelAviso } from '../model/entregas';

export function RespuestasDeEntrega({
  avisos,
  hoy,
}: {
  avisos: readonly AvisoDeEntrega[];
  hoy: string;
}) {
  if (avisos.length === 0) return null;
  return (
    <section aria-label="Lo que contestaron de la entrega" className="flex flex-col gap-2">
      {avisos.map((aviso) => (
        <Ir
          key={aviso.proyectoId}
          a={rutaDelProyecto(aviso.proyectoId)}
          className="flex items-start gap-2.75 rounded-panel border border-hogar bg-paper px-3.25 py-3 text-left text-ink no-underline hover:bg-surface"
        >
          <span aria-hidden className="flex-none pt-px text-hogar">
            <Icono
              nombre={aviso.respuesta === 'mis_dias' ? 'calendar-days' : 'calendar-check'}
              tamano={20}
            />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-body-sm leading-normal font-medium">
              {tituloDelAviso(aviso, hoy)}
            </span>
            <span className="mt-0.5 block text-label text-text-2">
              La entrega de su {elMueble(aviso.trabajo)}
            </span>
          </span>
          <span aria-hidden className="flex flex-none pt-0.5">
            <Icono nombre="chevron-right" tamano={17} />
          </span>
        </Ir>
      ))}
    </section>
  );
}
