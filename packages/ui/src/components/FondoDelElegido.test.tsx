import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import tema from '../styles/theme.css?raw';
import { FondoDelElegido } from './FondoDelElegido.tsx';

const OPCIONES = ['uno', 'dos', 'tres'] as const;

function medida(elemento: HTMLElement, clave: 'x' | 'y' | 'w' | 'h'): number {
  return Number(elemento.dataset[clave] ?? 0);
}

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const x = medida(this, 'x');
    const y = medida(this, 'y');
    return {
      left: x,
      top: y,
      width: medida(this, 'w'),
      height: medida(this, 'h'),
      right: x + medida(this, 'w'),
      bottom: y + medida(this, 'h'),
    } as DOMRect;
  });
  for (const [propiedad, clave] of [
    ['offsetWidth', 'w'],
    ['clientWidth', 'w'],
    ['clientHeight', 'h'],
  ] as const) {
    Object.defineProperty(HTMLElement.prototype, propiedad, {
      configurable: true,
      get(this: HTMLElement) {
        return medida(this, clave);
      },
    });
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const propiedad of ['offsetWidth', 'clientWidth', 'clientHeight']) {
    Reflect.deleteProperty(HTMLElement.prototype, propiedad);
  }
});

function Segmentado({ inicial = 'uno' }: { inicial?: string }) {
  const [elegido, setElegido] = useState(inicial);
  return (
    <>
      <div
        role="radiogroup"
        aria-label="Orden"
        data-x="0"
        data-y="0"
        data-w="300"
        data-h="52"
        className="relative"
      >
        <FondoDelElegido elegido={elegido} />
        {OPCIONES.map((opcion, indice) => (
          <button
            key={opcion}
            type="button"
            role="radio"
            aria-checked={elegido === opcion}
            data-opcion={opcion}
            data-x={String(4 + indice * 98)}
            data-y="4"
            data-w="96"
            data-h="44"
            onClick={() => {
              setElegido(opcion);
            }}
          >
            {opcion}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => {
          setElegido('tres');
        }}
      >
        Desde otro lado
      </button>
    </>
  );
}

function fondo(): HTMLElement {
  const elemento = document.querySelector<HTMLElement>('[data-fondo-del-elegido]');
  if (elemento === null) throw new Error('no está el fondo');
  return elemento;
}

describe('el fondo del elegido', () => {
  it('va detrás de las opciones, no se lee y no toma toques', () => {
    render(<Segmentado />);
    const grupo = screen.getByRole('radiogroup', { name: 'Orden' });
    expect(grupo.firstElementChild).toBe(fondo());
    expect(fondo()).toHaveAttribute('aria-hidden', 'true');
    expect(fondo()).toHaveClass('pointer-events-none', 'absolute', 'bg-elevado', 'shadow-float');
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });

  it('al montarse se ubica debajo del elegido, sin transición', () => {
    render(<Segmentado inicial="dos" />);
    expect(fondo().style.left).toBe('102px');
    expect(fondo().style.right).toBe('102px');
    expect(fondo().style.top).toBe('4px');
    expect(fondo().style.bottom).toBe('4px');
    expect(fondo().dataset.hacia).toBeUndefined();
    expect(fondo().style.transition).toBe('');
  });

  it('cuando el dedo elige otra, viaja hacia ese lado', () => {
    render(<Segmentado />);
    fireEvent.click(screen.getByRole('radio', { name: 'tres' }));
    expect(screen.getByRole('radio', { name: 'tres' })).toHaveAttribute('aria-checked', 'true');
    expect(fondo().dataset.hacia).toBe('derecha');
    expect(fondo().style.left).toBe('200px');
    fireEvent.click(screen.getByRole('radio', { name: 'uno' }));
    expect(fondo().dataset.hacia).toBe('izquierda');
    expect(fondo().style.left).toBe('4px');
  });

  it('si la opción cambia desde otro lado, se ubica sin viajar', () => {
    render(<Segmentado />);
    fireEvent.click(screen.getByRole('button', { name: 'Desde otro lado' }));
    expect(fondo().style.left).toBe('200px');
    expect(fondo().dataset.hacia).toBeUndefined();
  });

  it('el borde que va adelante sale con el resorte rápido y el de atrás lo alcanza después', () => {
    const [, derecha = ''] =
      /\.fondo-del-elegido\[data-hacia='derecha'\] \{([^}]*)\}/.exec(tema) ?? [];
    expect(derecha).toMatch(/right var\(--dur-espacial-rapido\) var\(--resorte-espacial-rapido\)/);
    expect(derecha).toMatch(/left var\(--dur-espacial\) var\(--resorte-espacial\) var\(--retraso/);
    const [, izquierda = ''] =
      /\.fondo-del-elegido\[data-hacia='izquierda'\] \{([^}]*)\}/.exec(tema) ?? [];
    expect(izquierda).toMatch(/left var\(--dur-espacial-rapido\) var\(--resorte-espacial-rapido\)/);
  });
});
