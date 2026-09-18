import type { NombreDelCatalogo } from '@maun/domain';
import { useCombobox } from 'downshift';
import { useMemo } from 'react';

import { sugerenciasParaEscribir, type Necesidad } from '@/entities/proyecto';
import { Icono } from '@/shared/ui';

export interface CampoDeNecesidadProps {
  etiqueta: string;
  placeholder: string;
  catalogo: readonly NombreDelCatalogo[];
  yaCargados: readonly Necesidad[];
  valor: string;
  alEscribir: (nombre: string) => void;
  alElegir: (nombre: string) => void;
}

export function CampoDeNecesidad({
  etiqueta,
  placeholder,
  catalogo,
  yaCargados,
  valor,
  alEscribir,
  alElegir,
}: CampoDeNecesidadProps) {
  const sugerencias = useMemo(
    () => sugerenciasParaEscribir(catalogo, valor, yaCargados),
    [catalogo, valor, yaCargados],
  );

  const combobox = useCombobox<NombreDelCatalogo>({
    items: sugerencias,
    inputValue: valor,
    selectedItem: null,
    itemToString: (entrada) => entrada?.nombre ?? '',
    onInputValueChange: ({ inputValue }) => {
      alEscribir(inputValue);
    },
    onSelectedItemChange: ({ selectedItem }) => {
      if (selectedItem !== null) alElegir(selectedItem.nombre);
    },
  });

  const seVe = combobox.isOpen && sugerencias.length > 0;

  return (
    <div className="relative flex min-w-0 flex-1 flex-col gap-1.5">
      <label {...combobox.getLabelProps()} className="sr-only">
        {etiqueta}
      </label>
      <input
        {...combobox.getInputProps({ placeholder, autoComplete: 'off' })}
        className="h-11 w-full min-w-0 rounded-field border border-border bg-paper px-3 text-body-lg text-ink"
      />
      <ul
        {...combobox.getMenuProps()}
        className={`absolute top-full right-0 left-0 z-20 mt-1 max-h-56 overflow-auto rounded-field border border-border bg-paper shadow-float ${
          seVe ? '' : 'hidden'
        }`}
      >
        {combobox.isOpen && (
          <>
            <li
              aria-hidden
              className="px-3 pt-2 pb-1 text-meta text-text-3"
              key="titulo-de-las-sugerencias"
            >
              {valor.trim() === '' ? 'Lo que más usás' : 'Ya lo usaste antes'}
            </li>
            {sugerencias.map((entrada, indice) => (
              <li
                key={entrada.nombre}
                {...combobox.getItemProps({ item: entrada, index: indice })}
                className={`flex min-h-tap cursor-pointer items-center justify-between gap-3 px-3 py-2 ${
                  combobox.highlightedIndex === indice ? 'bg-surface' : ''
                }`}
              >
                <span className="min-w-0 truncate text-body">{entrada.nombre}</span>
                <span className="flex flex-none items-center gap-1 text-meta text-text-3 tabular-nums">
                  <Icono nombre="hammer" tamano={12} />
                  {entrada.veces === 1 ? '1 trabajo' : `${String(entrada.veces)} trabajos`}
                </span>
              </li>
            ))}
          </>
        )}
      </ul>
    </div>
  );
}
