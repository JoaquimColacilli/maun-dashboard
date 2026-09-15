import { useMutation } from '@tanstack/react-query';
import { useId } from 'react';

import {
  marcaDeLaTarea,
  MUTACION_DE_TAREAS,
  TAREAS_DEL_PRESUPUESTO,
  tareaHecha,
  tareasHechas,
  type Proyecto,
} from '@/entities/proyecto';
import { mensajeDeSincronizacion } from '@/shared/api';
import { metaDeAvisos } from '@/shared/lib';

export interface TareasDelPresupuestoProps {
  proyecto: Proyecto;
}

export function TareasDelPresupuesto({ proyecto }: TareasDelPresupuestoProps) {
  const id = useId();
  const marcar = useMutation({
    ...MUTACION_DE_TAREAS,
    meta: metaDeAvisos('tareaDelPresupuesto', { silencioso: true, sujeto: proyecto.titulo }),
  });
  const hechas = tareasHechas(proyecto);

  return (
    <div
      role="group"
      aria-labelledby={`${id}-titulo`}
      className="mt-4 border-t border-hairline pt-3"
    >
      <p id={`${id}-titulo`} className="flex items-baseline justify-between gap-3 text-meta">
        <span className="font-medium text-text-2">Para el presupuesto</span>
        <span className="text-text-3 tabular-nums">
          {String(hechas)} de {String(TAREAS_DEL_PRESUPUESTO.length)}
        </span>
      </p>
      <ul className="mt-1">
        {TAREAS_DEL_PRESUPUESTO.map((tarea) => {
          const hecha = tareaHecha(proyecto, tarea.columna);
          return (
            <li key={tarea.columna}>
              <label className="flex min-h-tap cursor-pointer items-center gap-3 py-1">
                <input
                  type="checkbox"
                  checked={hecha}
                  onChange={(evento) => {
                    marcar.mutate({
                      id: proyecto.id,
                      cambios: marcaDeLaTarea(tarea.columna, evento.target.checked),
                      previos: marcaDeLaTarea(tarea.columna, hecha),
                      version: proyecto.version,
                    });
                  }}
                  className="size-5 flex-none accent-ink"
                />
                <span className="flex min-w-0 flex-col">
                  <span
                    className={
                      hecha
                        ? 'text-body text-text-3 line-through'
                        : 'text-body font-medium text-ink'
                    }
                  >
                    {tarea.etiqueta}
                  </span>
                  {tarea.detalle !== null && (
                    <span className="text-meta text-text-3">{tarea.detalle}</span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {marcar.isError && (
        <p role="alert" className="mt-1.5 text-label font-medium text-alerta">
          {mensajeDeSincronizacion(marcar.error)}
        </p>
      )}
    </div>
  );
}
