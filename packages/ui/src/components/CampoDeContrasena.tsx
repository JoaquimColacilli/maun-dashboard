import { useCallback, useEffect, useLayoutEffect, useRef, useState, type Ref } from 'react';

import { Campo, type CampoProps } from './Campo.tsx';
import { Icono } from './Icono.tsx';

export type CampoDeContrasenaProps = Omit<CampoProps, 'type' | 'sufijo'>;

function asignar<T>(ref: Ref<T> | undefined, valor: T | null): void {
  if (typeof ref === 'function') {
    ref(valor);
    return;
  }
  if (ref) ref.current = valor;
}

export function CampoDeContrasena({ ref, ...props }: CampoDeContrasenaProps) {
  const [visible, setVisible] = useState(false);
  const entrada = useRef<HTMLInputElement | null>(null);
  const seleccion = useRef<readonly [number | null, number | null] | null>(null);

  const conectar = useCallback(
    (nodo: HTMLInputElement | null) => {
      entrada.current = nodo;
      asignar(ref, nodo);
    },
    [ref],
  );

  useLayoutEffect(() => {
    const campo = entrada.current;
    const guardada = seleccion.current;
    seleccion.current = null;
    if (!campo || !guardada) return;
    campo.setSelectionRange(guardada[0], guardada[1]);
  }, [visible]);

  useEffect(() => {
    const formulario = entrada.current?.form ?? null;
    const ocultar = () => {
      if (entrada.current) entrada.current.type = 'password';
      setVisible(false);
    };
    const alVolver = (evento: PageTransitionEvent) => {
      if (evento.persisted) ocultar();
    };
    formulario?.addEventListener('submit', ocultar);
    globalThis.addEventListener('pageshow', alVolver);
    return () => {
      formulario?.removeEventListener('submit', ocultar);
      globalThis.removeEventListener('pageshow', alVolver);
    };
  }, []);

  function alternar(): void {
    const campo = entrada.current;
    if (campo && campo.ownerDocument.activeElement === campo) {
      seleccion.current = [campo.selectionStart, campo.selectionEnd];
    }
    setVisible((antes) => !antes);
  }

  return (
    <Campo
      {...props}
      ref={conectar}
      type={visible ? 'text' : 'password'}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      sufijo={(idDelInput) => (
        <button
          type="button"
          aria-controls={idDelInput}
          aria-pressed={visible}
          aria-label="Mostrar la contraseña"
          onPointerDown={(evento) => {
            evento.preventDefault();
          }}
          onMouseDown={(evento) => {
            evento.preventDefault();
          }}
          onClick={alternar}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-field text-text-2 hover:text-ink focus-visible:-outline-offset-4"
        >
          <Icono nombre={visible ? 'eye-off' : 'eye'} tamano={20} />
        </button>
      )}
    />
  );
}
