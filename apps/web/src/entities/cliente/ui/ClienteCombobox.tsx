import { useMutation } from '@tanstack/react-query';
import { useCombobox } from 'downshift';
import { useId, useMemo, useState } from 'react';

import { uuidv7 } from '@/shared/lib';
import { Icono } from '@/shared/ui';

import { CLAVE_DE_CLIENTE_NUEVO, MUTACION_DE_CLIENTE_NUEVO } from '../api/mutacion';
import type { Cliente } from '../model/catalogos';
import { iniciales } from '../model/contacto';
import { CLIENTE_EN_BLANCO } from '../model/formulario';

const CREAR = Symbol('crear');

type Opcion = Cliente | { [CREAR]: true; nombre: string };

function esCrear(opcion: Opcion): opcion is { [CREAR]: true; nombre: string } {
  return CREAR in opcion;
}

function detalleDe(cliente: Cliente): string {
  return [cliente.zona, cliente.telefono].filter(Boolean).join(' · ');
}

export interface ClienteComboboxProps {
  clientes: readonly Cliente[];
  elegidoId: string | null;
  alElegir: (cliente: Cliente | null) => void;
  etiqueta?: string;
  error?: string;
}

export function ClienteCombobox({
  clientes,
  elegidoId,
  alElegir,
  etiqueta = 'Cliente',
  error,
}: ClienteComboboxProps) {
  const [consulta, setConsulta] = useState('');
  const idError = useId();
  const elegido = clientes.find((cliente) => cliente.id === elegidoId) ?? null;

  const crear = useMutation({
    ...MUTACION_DE_CLIENTE_NUEVO,
    mutationKey: CLAVE_DE_CLIENTE_NUEVO,
  });

  const opciones = useMemo<Opcion[]>(() => {
    const texto = consulta.trim().toLowerCase();
    const encontrados = clientes.filter(
      (cliente) => texto === '' || cliente.nombre.toLowerCase().includes(texto),
    );
    const yaEstaExacto = clientes.some((cliente) => cliente.nombre.toLowerCase() === texto);
    return texto === '' || yaEstaExacto
      ? encontrados
      : [...encontrados, { [CREAR]: true, nombre: consulta.trim() }];
  }, [clientes, consulta]);

  function crearYElegir(nombre: string): void {
    const nuevo = { ...CLIENTE_EN_BLANCO, id: uuidv7(), nombre };
    crear.mutate(nuevo);
    alElegir({
      ...nuevo,
      household_id: '',
      created_at: '',
      updated_at: '',
      deleted_at: null,
      version: 1,
    });
    setConsulta('');
  }

  const combobox = useCombobox<Opcion>({
    items: opciones,
    inputValue: consulta,
    selectedItem: null,
    itemToString: (opcion) => (opcion === null ? '' : opcion.nombre),
    onInputValueChange: ({ inputValue }) => {
      setConsulta(inputValue);
    },
    onSelectedItemChange: ({ selectedItem }) => {
      if (selectedItem === null) return;
      if (esCrear(selectedItem)) crearYElegir(selectedItem.nombre);
      else {
        alElegir(selectedItem);
        setConsulta('');
      }
    },
  });

  if (elegido) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-label text-text-2">{etiqueta}</span>
        <div className="flex min-h-tap items-center gap-3 rounded-field border border-border bg-paper px-3 py-2 @min-[33rem]/campos:h-field @min-[33rem]/campos:py-0">
          <span className="flex size-9 flex-none items-center justify-center rounded-pill bg-surface text-meta font-semibold">
            {iniciales(elegido.nombre)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-body font-medium">{elegido.nombre}</span>
            <span className="block truncate text-meta text-text-2">
              {detalleDe(elegido) === '' ? 'Sin datos de contacto todavía' : detalleDe(elegido)}
            </span>
          </span>
          <button
            type="button"
            onClick={() => {
              alElegir(null);
            }}
            className="flex size-11 flex-none items-center justify-center rounded-pill text-text-2 hover:bg-surface"
            aria-label={`Cambiar el cliente, ahora ${elegido.nombre}`}
          >
            <Icono nombre="arrow-left-right" tamano={18} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label {...combobox.getLabelProps()} className="text-label text-text-2">
        {etiqueta}
      </label>
      <div className="relative">
        <input
          {...combobox.getInputProps({
            placeholder: 'Buscá por nombre, o escribí uno nuevo',
            autoComplete: 'off',
            'aria-invalid': error === undefined ? undefined : true,
            'aria-describedby': error === undefined ? undefined : idError,
          })}
          className={`h-field w-full rounded-field border bg-paper px-3.5 text-body-lg text-ink ${
            error === undefined ? 'border-border' : 'border-alerta'
          }`}
        />
        <ul
          {...combobox.getMenuProps()}
          className={`absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-field border border-border bg-paper shadow-float ${
            combobox.isOpen && opciones.length > 0 ? '' : 'hidden'
          }`}
        >
          {combobox.isOpen &&
            opciones.map((opcion, indice) => (
              <li
                key={esCrear(opcion) ? 'crear' : opcion.id}
                {...combobox.getItemProps({ item: opcion, index: indice })}
                className={`flex min-h-tap cursor-pointer items-center gap-3 px-3 py-2 ${
                  combobox.highlightedIndex === indice ? 'bg-surface' : ''
                }`}
              >
                {esCrear(opcion) ? (
                  <>
                    <span className="flex size-9 flex-none items-center justify-center rounded-pill bg-ink text-paper">
                      <Icono nombre="user-plus" tamano={16} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-body font-medium">
                        Crear «{opcion.nombre}»
                      </span>
                      <span className="block text-meta text-text-2">
                        Queda cargado con el nombre; el resto lo completás después
                      </span>
                    </span>
                  </>
                ) : (
                  <>
                    <span className="flex size-9 flex-none items-center justify-center rounded-pill bg-surface text-meta font-semibold">
                      {iniciales(opcion.nombre)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-body font-medium">{opcion.nombre}</span>
                      {detalleDe(opcion) !== '' && (
                        <span className="block truncate text-meta text-text-2">
                          {detalleDe(opcion)}
                        </span>
                      )}
                    </span>
                  </>
                )}
              </li>
            ))}
        </ul>
      </div>
      {error !== undefined && (
        <span id={idError} role="alert" className="text-label font-medium text-alerta">
          {error}
        </span>
      )}
    </div>
  );
}
