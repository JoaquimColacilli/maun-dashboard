import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Recorte } from '../model/encuadre';
import type { ImagenDecodificada } from '../model/imagen';
import { RecortadorDeFoto } from './RecortadorDeFoto';

const IMAGEN: ImagenDecodificada = {
  fuente: {} as CanvasImageSource,
  tamano: { ancho: 4000, alto: 3000 },
  url: 'blob:foto',
  liberar: () => undefined,
};

function montar(alGuardar: (recorte: Recorte) => void = () => undefined) {
  return render(
    <RecortadorDeFoto
      imagen={IMAGEN}
      guardando={false}
      error={undefined}
      alGuardar={alGuardar}
      alCancelar={() => undefined}
    />,
  );
}

describe('el recortador de la foto', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {
          return undefined;
        }
        disconnect() {
          return undefined;
        }
      },
    );
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 300,
      height: 300,
      left: 0,
      top: 0,
      right: 300,
      bottom: 300,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('con el teclado se mueve la foto con las flechas y se acerca con +', () => {
    montar();
    const encuadre = screen.getByRole('group', { name: 'Encuadre de la foto' });
    const imagen = encuadre.querySelector('img');
    expect(imagen?.style.transform).toBe('translate(-50px, 0px)');

    fireEvent.keyDown(encuadre, { key: 'ArrowRight' });
    expect(imagen?.style.transform).toBe('translate(-40px, 0px)');

    fireEvent.keyDown(encuadre, { key: '+' });
    expect(encuadre).toHaveAttribute('data-zoom', '1.25');
    expect(screen.getByRole('slider', { name: 'Zoom' })).toHaveValue('1.25');

    fireEvent.keyDown(encuadre, { key: '0' });
    expect(encuadre).toHaveAttribute('data-zoom', '1.00');
  });

  it('arrastrar con el dedo o el mouse mueve la foto, sin dejar borde vacío', () => {
    montar();
    const encuadre = screen.getByRole('group', { name: 'Encuadre de la foto' });
    Object.assign(encuadre, { setPointerCapture: () => undefined });

    fireEvent.pointerDown(encuadre, { pointerId: 1, clientX: 150, clientY: 150 });
    fireEvent.pointerMove(encuadre, { pointerId: 1, clientX: 400, clientY: 150 });
    fireEvent.pointerUp(encuadre, { pointerId: 1, clientX: 400, clientY: 150 });

    expect(encuadre.querySelector('img')?.style.transform).toBe('translate(0px, 0px)');
  });

  it('guardar entrega el recorte en la fuente del encuadre que se ve', () => {
    const alGuardar = vi.fn();
    montar(alGuardar);

    fireEvent.click(screen.getByRole('button', { name: 'Acercar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar la foto' }));

    expect(alGuardar).toHaveBeenCalledWith({ sx: 800, sy: 300, lado: 2400 });
  });
});
