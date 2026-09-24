import {
  CANTIDAD_MAXIMA,
  cantidadEditada,
  LARGO_MAXIMO_DEL_NOMBRE,
  nombreEditado,
} from '@maun/domain';
import { useState, type ChangeEvent, type KeyboardEvent } from 'react';

import { nombreConCantidad, type Necesidad, type TipoDeLaLista } from '@/entities/proyecto';
import { Icono } from '@/shared/ui';

const CIFRAS_DE_LA_CANTIDAD = String(CANTIDAD_MAXIMA).length;

type Campo = HTMLInputElement | HTMLTextAreaElement;

function useEdicionEnLaFila(
  guardado: string,
  limpiar: (escrito: string) => string,
  alGuardar: (escrito: string) => void,
) {
  const [borrador, setBorrador] = useState<string | null>(null);

  return {
    value: borrador ?? guardado,
    onFocus: () => {
      setBorrador(guardado);
    },
    onChange: (evento: ChangeEvent<Campo>) => {
      setBorrador(limpiar(evento.target.value));
    },
    onBlur: () => {
      const escrito = borrador;
      setBorrador(null);
      if (escrito !== null && escrito !== guardado) alGuardar(escrito);
    },
    onKeyDown: (evento: KeyboardEvent<Campo>) => {
      if (evento.key === 'Enter') {
        evento.preventDefault();
        evento.currentTarget.blur();
      }
      if (evento.key === 'Escape') {
        evento.preventDefault();
        setBorrador(guardado);
      }
    },
  };
}

export interface CambiosDeLaFila {
  nombre: string;
  cantidad: number | null;
}

export interface FilaDeNecesidadProps {
  necesidad: Necesidad;
  lista: TipoDeLaLista;
  bloqueado: boolean;
  alTildar: (listo: boolean) => void;
  alEditar: (cambios: CambiosDeLaFila) => void;
  alQuitar: () => void;
}

export function FilaDeNecesidad({
  necesidad,
  lista,
  bloqueado,
  alTildar,
  alEditar,
  alQuitar,
}: FilaDeNecesidadProps) {
  const cantidad = useEdicionEnLaFila(
    necesidad.cantidad === null ? '' : String(necesidad.cantidad),
    (escrito) => escrito.replace(/\D/g, '').slice(0, CIFRAS_DE_LA_CANTIDAD),
    (escrito) => {
      const nueva = cantidadEditada(escrito, necesidad.cantidad);
      if (nueva !== necesidad.cantidad) alEditar({ nombre: necesidad.nombre, cantidad: nueva });
    },
  );
  const nombre = useEdicionEnLaFila(
    necesidad.nombre,
    (escrito) => escrito.replace(/[\r\n]+/g, ' '),
    (escrito) => {
      const nuevo = nombreEditado(escrito, necesidad.nombre);
      if (nuevo !== necesidad.nombre) alEditar({ nombre: nuevo, cantidad: necesidad.cantidad });
    },
  );

  const tono = necesidad.listo ? 'text-text-3 line-through' : 'text-ink';
  const campo =
    'rounded-field border border-transparent bg-transparent hover:border-border focus:border-border focus:bg-paper read-only:hover:border-transparent read-only:focus:bg-transparent';

  return (
    <li
      data-necesidad={necesidad.id}
      data-listo={String(necesidad.listo)}
      className="flex items-start gap-1 border-t border-hairline-soft"
    >
      <label className="flex size-11 flex-none cursor-pointer items-center justify-center">
        <input
          type="checkbox"
          checked={necesidad.listo}
          disabled={bloqueado}
          aria-label={`${lista.listo}: ${nombreConCantidad(necesidad)}`}
          onChange={(evento) => {
            alTildar(evento.target.checked);
          }}
          className="size-5 accent-ink"
        />
      </label>

      <input
        {...cantidad}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        enterKeyHint="done"
        autoComplete="off"
        maxLength={CIFRAS_DE_LA_CANTIDAD}
        readOnly={bloqueado}
        placeholder="–"
        aria-label={`Cantidad de ${necesidad.nombre}`}
        className={`h-11 w-10 flex-none px-1 text-center text-body font-semibold tabular-nums placeholder:font-normal placeholder:text-text-3 ${campo} ${
          necesidad.cantidad === null && necesidad.listo ? 'text-text-3' : tono
        }`}
      />

      <div className="grid min-w-0 flex-1">
        <span
          aria-hidden
          className="invisible col-start-1 row-start-1 min-h-11 border border-transparent px-1.5 py-2.5 text-body leading-normal break-words whitespace-pre-wrap"
        >
          {`${nombre.value} `}
        </span>
        <textarea
          {...nombre}
          rows={1}
          enterKeyHint="done"
          autoComplete="off"
          spellCheck={false}
          maxLength={LARGO_MAXIMO_DEL_NOMBRE}
          readOnly={bloqueado}
          aria-label={`Nombre de ${necesidad.nombre}`}
          className={`col-start-1 row-start-1 min-h-11 resize-none overflow-hidden px-1.5 py-2.5 text-body leading-normal break-words ${campo} ${tono}`}
        />
      </div>

      <button
        type="button"
        disabled={bloqueado}
        aria-label={`Sacar ${nombreConCantidad(necesidad)} de la lista`}
        onClick={alQuitar}
        className="mt-0.5 flex size-10 flex-none items-center justify-center rounded-pill text-text-3 hover:bg-surface hover:text-alerta"
      >
        <Icono nombre="trash-2" tamano={16} />
      </button>
    </li>
  );
}
