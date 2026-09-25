import { centavos } from '@maun/domain';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CorteDelMes } from '@/entities/proyecto';

const HOY = '2026-09-24';

const CORTE: CorteDelMes = {
  trabajos: 1,
  tablero: centavos(320_000_000),
  hogar: centavos(180_000_000),
  maun: centavos(81_000_000),
  diezmo: centavos(29_000_000),
  gastos: centavos(30_000_000),
};

const SIN_NADA_COBRADO: CorteDelMes = {
  trabajos: 1,
  tablero: centavos(0),
  hogar: centavos(0),
  maun: centavos(0),
  diezmo: centavos(0),
  gastos: centavos(0),
};

function pantallaDe(ancho: number) {
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: consulta.includes('1280') ? ancho >= 1280 : ancho >= 768,
    media: consulta,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

async function portadaNueva() {
  vi.resetModules();
  const { PortadaDeInicio } = await import('./PortadaDeInicio');
  return function montar(corte: CorteDelMes | null, arranque = false) {
    const { container, unmount } = render(
      <MemoryRouter>
        <PortadaDeInicio hoy={HOY} corte={corte} arranque={arranque} />
      </MemoryRouter>,
    );
    return { container, unmount };
  };
}

function dibujoDe(container: HTMLElement): SVGSVGElement {
  const dibujos = container.querySelectorAll<SVGSVGElement>('svg.ilustracion');
  expect(dibujos).toHaveLength(1);
  const [dibujo] = dibujos;
  if (dibujo === undefined) throw new Error('sin dibujo');
  expect(dibujo.closest('[data-lamina]')).not.toBeNull();
  return dibujo;
}

function seCorta(container: HTMLElement): boolean {
  const piezas = [...container.querySelectorAll<SVGGElement>('[data-pieza]')];
  expect(piezas.length).toBeGreaterThan(0);
  return piezas.every((pieza) => pieza.style.animationName === 'maun-corte');
}

beforeEach(() => {
  pantallaDe(390);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('la portada de Inicio', () => {
  it('con trabajos cerrados en el mes cuenta el corte y lo dibuja cortado', async () => {
    const montar = await portadaNueva();
    const { container } = montar(CORTE);

    const portada = screen.getByRole('region', { name: 'El corte de septiembre' });
    expect(
      within(portada).getByText(
        'Un trabajo cerrado en septiembre: 56% al hogar, 25% al taller y 9% al diezmo. Lo demás fueron gastos.',
      ),
    ).toBeInTheDocument();
    const dibujo = dibujoDe(container);
    expect(
      [...dibujo.querySelectorAll('[data-pieza]')].map((pieza) => pieza.getAttribute('data-pieza')),
    ).toEqual(expect.arrayContaining(['hogar', 'maun', 'diezmo', 'gastos']));
    expect(dibujo.querySelector('.mano')).toBeNull();
  });

  it('la medida de lo cobrado va desde la tablet, no en el celular', async () => {
    const montar = await portadaNueva();
    const celular = montar(CORTE);
    expect(celular.container.querySelector('.cota')).toBeNull();
    celular.unmount();

    pantallaDe(1440);
    const { container } = montar(CORTE);
    expect(container.querySelector('.cota')?.textContent).toMatch(/3\.200\.000/);
  });

  it('sin trabajos cerrados, o sin nada cobrado, el tablero sigue entero', async () => {
    const montar = await portadaNueva();
    const sinCorte = montar(null);

    expect(screen.getByRole('region', { name: 'El corte de septiembre' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Septiembre todavía no se cortó. Cuando cierres un trabajo, acá vas a ver a dónde va cada peso.',
      ),
    ).toBeInTheDocument();
    const dibujo = dibujoDe(sinCorte.container);
    expect(dibujo.querySelector('[data-pieza], .mano')).toBeNull();
    expect(dibujo.querySelector('.eje')).not.toBeNull();
    sinCorte.unmount();

    const { container } = montar(SIN_NADA_COBRADO);
    expect(
      screen.getByText(
        'Un trabajo cerrado en septiembre, sin nada cobrado: no hubo nada para repartir.',
      ),
    ).toBeInTheDocument();
    expect(dibujoDe(container).querySelector('[data-pieza]')).toBeNull();
  });

  it('si falta configurar, gana el arranque aunque haya corte', async () => {
    const montar = await portadaNueva();
    const { container } = montar(CORTE, true);

    const portada = screen.getByRole('region', { name: 'El taller arranca acá' });
    expect(within(portada).getByRole('heading', { level: 2 })).toHaveTextContent(
      'El taller arranca acá',
    );
    expect(
      within(portada).getByRole('button', { name: 'Configurar sueldo y metas' }),
    ).toBeInTheDocument();
    expect(
      within(portada).getByRole('button', { name: 'Cargar el primer proyecto' }),
    ).toBeInTheDocument();
    const dibujo = dibujoDe(container);
    expect(dibujo.querySelector('.mano')).not.toBeNull();
    expect(dibujo.querySelector('[data-pieza]')).toBeNull();
    expect(screen.queryByText(/El corte de/)).toBeNull();
  });

  it('el corte se anima la primera vez que se muestra y la segunda ya no', async () => {
    const montar = await portadaNueva();
    const primera = montar(CORTE);
    expect(seCorta(primera.container)).toBe(true);
    primera.unmount();

    const { container } = montar(CORTE);
    expect(container.querySelector('[data-pieza][style]')).toBeNull();
  });

  it('la marca del arranque se traza la primera vez, y eso ya gasta el corte de la sesión', async () => {
    const montar = await portadaNueva();
    const arranque = montar(null, true);
    expect(arranque.container.querySelector('.mano.trazar')).not.toBeNull();
    arranque.unmount();

    const otraVez = montar(null, true);
    expect(otraVez.container.querySelector('.mano')).not.toBeNull();
    expect(otraVez.container.querySelector('.trazar')).toBeNull();
    otraVez.unmount();

    const { container } = montar(CORTE);
    expect(container.querySelector('[data-pieza][style]')).toBeNull();
  });

  it('el tablero sin cortar no se mueve ni gasta el corte de la sesión', async () => {
    const montar = await portadaNueva();
    const sinCorte = montar(null);
    expect(sinCorte.container.querySelector('[style], .trazar')).toBeNull();
    sinCorte.unmount();

    const { container } = montar(CORTE);
    expect(seCorta(container)).toBe(true);
  });
});
