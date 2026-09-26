import { useLayoutEffect, useRef } from 'react';

export interface FondoDelElegidoProps {
  elegido: string;
}

interface Bordes {
  izquierda: number;
  derecha: number;
  arriba: number;
  abajo: number;
}

function bordesDe(fondo: HTMLElement, elegido: string): Bordes | null {
  const pista = fondo.parentElement;
  if (pista === null) return null;
  const opcion = [...pista.querySelectorAll<HTMLElement>(':scope > [data-opcion]')].find(
    (candidata) => candidata.dataset.opcion === elegido,
  );
  if (opcion === undefined) return null;
  const dePista = pista.getBoundingClientRect();
  const deOpcion = opcion.getBoundingClientRect();
  const escala = pista.offsetWidth > 0 ? dePista.width / pista.offsetWidth : 1;
  const izquierda = (deOpcion.left - dePista.left) / escala - pista.clientLeft;
  const arriba = (deOpcion.top - dePista.top) / escala - pista.clientTop;
  return {
    izquierda,
    derecha: pista.clientWidth - izquierda - deOpcion.width / escala,
    arriba,
    abajo: pista.clientHeight - arriba - deOpcion.height / escala,
  };
}

function aplicar(fondo: HTMLElement, bordes: Bordes): void {
  fondo.style.left = `${String(bordes.izquierda)}px`;
  fondo.style.right = `${String(bordes.derecha)}px`;
  fondo.style.top = `${String(bordes.arriba)}px`;
  fondo.style.bottom = `${String(bordes.abajo)}px`;
}

function yaEsta(fondo: HTMLElement, bordes: Bordes): boolean {
  const cerca = (propiedad: string, valor: number) =>
    Math.abs(Number.parseFloat(propiedad) - valor) < 0.5;
  return (
    cerca(fondo.style.left, bordes.izquierda) &&
    cerca(fondo.style.right, bordes.derecha) &&
    cerca(fondo.style.top, bordes.arriba) &&
    cerca(fondo.style.bottom, bordes.abajo)
  );
}

function ubicarQuieto(fondo: HTMLElement, elegido: string): void {
  const bordes = bordesDe(fondo, elegido);
  fondo.style.visibility = bordes === null ? 'hidden' : '';
  if (bordes === null || yaEsta(fondo, bordes)) return;
  fondo.style.transition = 'none';
  aplicar(fondo, bordes);
  fondo.getBoundingClientRect();
  fondo.style.transition = '';
}

export function FondoDelElegido({ elegido }: FondoDelElegidoProps) {
  const fondo = useRef<HTMLSpanElement>(null);
  const tocado = useRef(false);
  const ultimo = useRef<string | null>(null);

  useLayoutEffect(() => {
    const elemento = fondo.current;
    const pista = elemento?.parentElement;
    if (!elemento || !pista) return;
    const armar = () => {
      tocado.current = true;
    };
    pista.addEventListener('pointerdown', armar, true);
    pista.addEventListener('keydown', armar, true);
    pista.addEventListener('click', armar, true);
    const reubicar = () => {
      if (ultimo.current !== null) ubicarQuieto(elemento, ultimo.current);
    };
    const observador = 'ResizeObserver' in globalThis ? new ResizeObserver(reubicar) : null;
    observador?.observe(pista);
    return () => {
      pista.removeEventListener('pointerdown', armar, true);
      pista.removeEventListener('keydown', armar, true);
      pista.removeEventListener('click', armar, true);
      observador?.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    const elemento = fondo.current;
    if (!elemento) return;
    const antes = ultimo.current;
    ultimo.current = elegido;
    const conElDedo = tocado.current && antes !== null && antes !== elegido;
    tocado.current = false;
    if (!conElDedo) {
      ubicarQuieto(elemento, elegido);
      return;
    }
    const bordes = bordesDe(elemento, elegido);
    if (bordes === null) {
      ubicarQuieto(elemento, elegido);
      return;
    }
    const izquierdaDeAntes = Number.parseFloat(elemento.style.left);
    elemento.dataset.hacia = bordes.izquierda >= izquierdaDeAntes ? 'derecha' : 'izquierda';
    elemento.style.visibility = '';
    aplicar(elemento, bordes);
  }, [elegido]);

  return (
    <span
      ref={fondo}
      aria-hidden
      data-fondo-del-elegido=""
      className="fondo-del-elegido pointer-events-none absolute rounded-pill bg-elevado shadow-float"
    />
  );
}
