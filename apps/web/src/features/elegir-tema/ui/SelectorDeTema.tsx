import { useId } from 'react';

import { elegirTema, useTema, type PreferenciaDeTema } from '@/shared/lib';
import { Icono, type NombreDeIcono } from '@/shared/ui';

const OPCIONES: readonly { id: PreferenciaDeTema; etiqueta: string; icono: NombreDeIcono }[] = [
  { id: 'light', etiqueta: 'Claro', icono: 'sun' },
  { id: 'dark', etiqueta: 'Oscuro', icono: 'moon' },
  { id: 'system', etiqueta: 'Como el sistema', icono: 'monitor-smartphone' },
];

export function SelectorDeTema() {
  const { preferencia, oscuro } = useTema();
  const nombre = useId();

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-label text-text-2">Tema</legend>
      <div className="grid max-w-[30rem] grid-cols-3 gap-0.5 rounded-pill bg-ink/6 p-1">
        {OPCIONES.map((opcion) => (
          <label
            key={opcion.id}
            className="flex min-h-tap cursor-pointer items-center justify-center gap-1.5 rounded-pill px-1 text-center text-label leading-tight font-medium text-text-2 has-checked:bg-elevado has-checked:font-semibold has-checked:text-ink has-checked:shadow-float has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink"
          >
            <input
              type="radio"
              name={nombre}
              value={opcion.id}
              checked={preferencia === opcion.id}
              onChange={() => {
                elegirTema(opcion.id);
              }}
              className="sr-only"
            />
            <Icono nombre={opcion.icono} tamano={16} className="flex-none" />
            {opcion.etiqueta}
          </label>
        ))}
      </div>
      <span className="text-meta text-text-3">
        {preferencia === 'system'
          ? `Ahora se ve ${oscuro ? 'oscuro' : 'claro'}, porque así está el sistema.`
          : 'Queda elegido en este dispositivo.'}
      </span>
    </fieldset>
  );
}
