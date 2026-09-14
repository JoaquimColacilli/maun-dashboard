import { act, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DURACION_DE_LA_VUELTA_MS,
  MUESTRA_DEL_DESENLACE_MS,
  TIEMPO_MINIMO_SINCRONIZANDO_MS,
  TIRON_MAXIMO,
  UMBRAL_DEL_TIRON,
  useTirarParaActualizar,
} from './tirar-para-actualizar';

type Actualizar = () => Promise<string>;

function Prueba({
  actualizar,
  deshabilitado = false,
}: {
  actualizar: Actualizar;
  deshabilitado?: boolean;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const tiron = useTirarParaActualizar(actualizar, contenedor, deshabilitado);
  return (
    <div
      ref={contenedor}
      data-testid="contenedor"
      data-fase={tiron.fase}
      data-distancia={tiron.distancia}
      data-avance={tiron.avance}
      data-sincronizando={String(tiron.sincronizando)}
      data-desenlace={tiron.desenlace ?? ''}
    />
  );
}

function contenedor(): HTMLElement {
  return screen.getByTestId('contenedor');
}

function tocar(tipo: string, ...alturas: number[]): void {
  const evento = new Event(tipo);
  Object.defineProperty(evento, 'touches', { value: alturas.map((clientY) => ({ clientY })) });
  act(() => {
    contenedor().dispatchEvent(evento);
    vi.advanceTimersByTime(16);
  });
}

function tirar(desde: number, hasta: number): void {
  tocar('touchstart', desde);
  tocar('touchmove', hasta);
}

function soltar(): void {
  act(() => {
    contenedor().dispatchEvent(Object.assign(new Event('touchend'), { touches: [] }));
  });
}

async function pasar(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

const fase = () => contenedor().dataset.fase;
const distancia = () => Number(contenedor().dataset.distancia);
const avance = () => Number(contenedor().dataset.avance);

function dedoParaLlegarA(distanciaDelTiron: number): number {
  return 100 + distanciaDelTiron * 2;
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'],
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('tirar para actualizar', () => {
  it('soltar antes del umbral vuelve sin actualizar', () => {
    const actualizar = vi.fn<Actualizar>(() => Promise.resolve('listo'));
    render(<Prueba actualizar={actualizar} />);

    tirar(100, dedoParaLlegarA(UMBRAL_DEL_TIRON - 1));
    expect(fase()).toBe('tirando');
    expect(distancia()).toBe(UMBRAL_DEL_TIRON - 1);
    expect(avance()).toBeLessThan(1);

    soltar();
    expect(fase()).toBe('volviendo');
    expect(distancia()).toBe(0);
    act(() => {
      vi.advanceTimersByTime(DURACION_DE_LA_VUELTA_MS);
    });
    expect(fase()).toBe('quieto');
    expect(actualizar).not.toHaveBeenCalled();
  });

  it('pasado el umbral sincroniza una sola vez, y se ve al menos el tiempo mínimo aunque termine al instante', async () => {
    const actualizar = vi.fn<Actualizar>(() => Promise.resolve('listo'));
    render(<Prueba actualizar={actualizar} />);

    tirar(100, dedoParaLlegarA(UMBRAL_DEL_TIRON));
    expect(avance()).toBe(1);

    soltar();
    expect(actualizar).toHaveBeenCalledTimes(1);
    expect(contenedor().dataset.sincronizando).toBe('true');
    expect(distancia()).toBe(UMBRAL_DEL_TIRON);

    await pasar(TIEMPO_MINIMO_SINCRONIZANDO_MS - 1);
    expect(fase()).toBe('sincronizando');

    await pasar(1);
    expect(fase()).toBe('desenlace');
    expect(contenedor().dataset.desenlace).toBe('listo');

    await pasar(MUESTRA_DEL_DESENLACE_MS);
    expect(fase()).toBe('volviendo');
    await pasar(DURACION_DE_LA_VUELTA_MS);
    expect(fase()).toBe('quieto');
    expect(actualizar).toHaveBeenCalledTimes(1);
  });

  it('el tirón es elástico: la mitad de lo que recorre el dedo, hasta el máximo', () => {
    render(<Prueba actualizar={() => Promise.resolve('listo')} />);

    tirar(100, 140);
    expect(distancia()).toBe(20);

    tocar('touchmove', 2000);
    expect(distancia()).toBe(TIRON_MAXIMO);
  });

  it('con el contenedor scrolleado el dedo hacia abajo es scroll, no un tirón', () => {
    const actualizar = vi.fn<Actualizar>(() => Promise.resolve('listo'));
    render(<Prueba actualizar={actualizar} />);
    Object.defineProperty(contenedor(), 'scrollTop', { value: 40, configurable: true });

    tirar(100, dedoParaLlegarA(TIRON_MAXIMO));
    soltar();

    expect(fase()).toBe('quieto');
    expect(actualizar).not.toHaveBeenCalled();
  });

  it('el dedo hacia arriba no es un tirón', () => {
    render(<Prueba actualizar={() => Promise.resolve('listo')} />);

    tirar(300, 100);

    expect(fase()).toBe('quieto');
  });

  it('si el dedo vuelve arriba del inicio, soltar no actualiza', () => {
    const actualizar = vi.fn<Actualizar>(() => Promise.resolve('listo'));
    render(<Prueba actualizar={actualizar} />);

    tirar(100, dedoParaLlegarA(TIRON_MAXIMO));
    tocar('touchmove', 60);
    expect(distancia()).toBe(0);
    soltar();

    expect(fase()).toBe('volviendo');
    expect(actualizar).not.toHaveBeenCalled();
  });

  it('deshabilitado no arranca, y deshabilitarlo en medio del tirón lo suelta sin actualizar', () => {
    const actualizar = vi.fn<Actualizar>(() => Promise.resolve('listo'));
    const { rerender } = render(<Prueba actualizar={actualizar} deshabilitado />);

    tirar(100, dedoParaLlegarA(TIRON_MAXIMO));
    expect(fase()).toBe('quieto');
    soltar();

    rerender(<Prueba actualizar={actualizar} />);
    tirar(100, dedoParaLlegarA(TIRON_MAXIMO));
    expect(fase()).toBe('tirando');

    rerender(<Prueba actualizar={actualizar} deshabilitado />);
    tocar('touchmove', dedoParaLlegarA(TIRON_MAXIMO) + 10);
    expect(fase()).toBe('volviendo');
    soltar();

    expect(actualizar).not.toHaveBeenCalled();
  });

  it('con dos dedos no es un tirón', () => {
    render(<Prueba actualizar={() => Promise.resolve('listo')} />);

    tocar('touchstart', 100, 120);
    tocar('touchmove', 300, 320);

    expect(fase()).toBe('quieto');
  });

  it('mientras sincroniza, otro tirón no dispara otra sincronización', () => {
    const actualizar = vi.fn<Actualizar>(() => new Promise<string>(() => undefined));
    render(<Prueba actualizar={actualizar} />);

    tirar(100, dedoParaLlegarA(TIRON_MAXIMO));
    soltar();
    tirar(100, dedoParaLlegarA(TIRON_MAXIMO));
    soltar();

    expect(actualizar).toHaveBeenCalledTimes(1);
    expect(fase()).toBe('sincronizando');
  });

  it('si actualizar falla, vuelve sin desenlace y sin quedar girando', async () => {
    render(<Prueba actualizar={() => Promise.reject(new Error('se cayó'))} />);

    tirar(100, dedoParaLlegarA(TIRON_MAXIMO));
    soltar();
    await pasar(TIEMPO_MINIMO_SINCRONIZANDO_MS);

    expect(fase()).toBe('volviendo');
    expect(contenedor().dataset.desenlace).toBe('');
  });
});
