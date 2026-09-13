import {
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type ComponentPropsWithRef,
  type Ref,
  type SyntheticEvent,
} from 'react';

import { Campo } from './Campo.tsx';

export interface ImporteEscrito {
  enteros: string;
  decimales: string | null;
}

const VACIO: ImporteEscrito = { enteros: '', decimales: null };

const DIGITOS_MAXIMOS = 13;

function sinCerosAdelante(enteros: string): string {
  return enteros.replace(/^0+(?=\d)/, '');
}

export function importeDeCentavos(centavos: number | null): ImporteEscrito {
  if (centavos === null) return VACIO;
  const pesos = Math.trunc(centavos / 100);
  const resto = centavos % 100;
  return {
    enteros: String(pesos),
    decimales: resto === 0 ? null : String(resto).padStart(2, '0'),
  };
}

export function centavosDelImporte(importe: ImporteEscrito): number | null {
  if (importe.enteros === '' && importe.decimales === null) return null;
  const pesos = importe.enteros === '' ? 0 : Number(importe.enteros);
  const resto = importe.decimales === null ? 0 : Number(importe.decimales.padEnd(2, '0'));
  return pesos * 100 + resto;
}

export function textoDelImporte(importe: ImporteEscrito): string {
  const enteros =
    importe.enteros === '' && importe.decimales !== null
      ? '0'
      : importe.enteros.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return importe.decimales === null ? enteros : `${enteros},${importe.decimales}`;
}

export function tipear(importe: ImporteEscrito, texto: string): ImporteEscrito {
  let { enteros, decimales } = importe;
  for (const caracter of texto) {
    if (caracter >= '0' && caracter <= '9') {
      if (decimales === null) {
        if (enteros.length < DIGITOS_MAXIMOS) enteros = sinCerosAdelante(enteros + caracter);
      } else if (decimales.length < 2) {
        decimales += caracter;
      }
    } else if ((caracter === ',' || caracter === '.') && decimales === null) {
      decimales = '';
      if (enteros === '') enteros = '0';
    }
  }
  return { enteros, decimales };
}

export function borrarUno(importe: ImporteEscrito): ImporteEscrito {
  if (importe.decimales === null) {
    return { enteros: importe.enteros.slice(0, -1), decimales: null };
  }
  return {
    enteros: importe.enteros,
    decimales: importe.decimales === '' ? null : importe.decimales.slice(0, -1),
  };
}

export function leerImporte(texto: string): ImporteEscrito | null {
  const limpio = texto.replace(/[$\s]/g, '');
  if (limpio === '') return VACIO;

  let enteros: string;
  let decimales: string | null;
  if (/^\d{1,3}(\.\d{3})+(,\d{0,2})?$/.test(limpio)) {
    const [parte, fraccion] = limpio.split(',');
    enteros = (parte ?? '').replace(/\./g, '');
    decimales = fraccion ?? null;
  } else if (/^\d+(,\d{0,2})?$/.test(limpio)) {
    const [parte, fraccion] = limpio.split(',');
    enteros = parte ?? '';
    decimales = fraccion ?? null;
  } else if (/^\d+\.\d{1,2}$/.test(limpio)) {
    const [parte, fraccion] = limpio.split('.');
    enteros = parte ?? '';
    decimales = fraccion ?? null;
  } else {
    return null;
  }

  enteros = sinCerosAdelante(enteros);
  if (enteros.length > DIGITOS_MAXIMOS) return null;
  return { enteros, decimales };
}

function datosDelEvento(evento: Event): { tipo: string; dato: string | null } {
  if (!(evento instanceof InputEvent)) return { tipo: '', dato: null };
  return { tipo: evento.inputType, dato: evento.data };
}

function siguienteImporte(
  importe: ImporteEscrito,
  texto: string,
  evento: Event,
): ImporteEscrito | null {
  const { tipo, dato } = datosDelEvento(evento);
  if (tipo.startsWith('delete')) return texto === '' ? VACIO : borrarUno(importe);
  const unCaracter = tipo === 'insertText' && dato !== null && dato.length === 1;
  if (unCaracter && texto !== dato) return tipear(importe, dato);
  return leerImporte(texto) ?? (unCaracter ? tipear(VACIO, dato) : null);
}

export interface MoneyInputProps extends Omit<
  ComponentPropsWithRef<'input'>,
  'value' | 'defaultValue' | 'onChange' | 'type' | 'inputMode'
> {
  value: number | null;
  onChange: (centavos: number | null) => void;
  etiqueta?: string;
  error?: string;
  ayuda?: string;
}

function asignar<T>(ref: Ref<T> | undefined, nodo: T | null): void {
  if (typeof ref === 'function') ref(nodo);
  else if (ref) ref.current = nodo;
}

export function MoneyInput({
  value,
  onChange,
  etiqueta,
  error,
  ayuda,
  ref,
  id,
  className = '',
  ...props
}: MoneyInputProps) {
  const [importe, setImporte] = useState(() => importeDeCentavos(value));
  const campo = useRef<HTMLInputElement | null>(null);

  if (centavosDelImporte(importe) !== value) setImporte(importeDeCentavos(value));

  const texto = textoDelImporte(importe);

  useLayoutEffect(() => {
    const elemento = campo.current;
    if (elemento && elemento === elemento.ownerDocument.activeElement) {
      elemento.setSelectionRange(texto.length, texto.length);
    }
  }, [texto]);

  function aplicar(siguiente: ImporteEscrito | null): void {
    if (siguiente === null) return;
    setImporte(siguiente);
    const centavos = centavosDelImporte(siguiente);
    if (centavos !== value) onChange(centavos);
  }

  const comun = {
    ...props,
    ref: (nodo: HTMLInputElement | null) => {
      campo.current = nodo;
      asignar(ref, nodo);
    },
    type: 'text',
    inputMode: 'decimal' as const,
    autoComplete: 'off',
    value: texto,
    onChange: (evento: ChangeEvent<HTMLInputElement>) => {
      aplicar(siguienteImporte(importe, evento.target.value, evento.nativeEvent));
    },
    onPaste: (evento: ClipboardEvent<HTMLInputElement>) => {
      evento.preventDefault();
      aplicar(leerImporte(evento.clipboardData.getData('text')));
    },
    onSelect: (evento: SyntheticEvent<HTMLInputElement>) => {
      const elemento = evento.currentTarget;
      const fin = elemento.value.length;
      if (elemento.selectionStart === elemento.selectionEnd && elemento.selectionEnd !== fin) {
        elemento.setSelectionRange(fin, fin);
      }
    },
  };

  if (etiqueta !== undefined) {
    return (
      <Campo
        {...comun}
        etiqueta={etiqueta}
        error={error}
        ayuda={ayuda}
        className={`tabular-nums ${className}`}
      />
    );
  }

  return (
    <input
      {...comun}
      id={id}
      aria-invalid={error === undefined ? props['aria-invalid'] : true}
      className={`tabular-nums ${className}`}
    />
  );
}
