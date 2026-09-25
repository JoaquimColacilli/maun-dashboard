import { centavos } from '@maun/domain';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { formatearPesos } from '@/shared/lib';

import type { Despiece } from '../model/despiece';
import { DistribucionDespiece } from './DistribucionDespiece';

function pantallaDe(ancho: number) {
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: consulta.includes('1280') ? ancho >= 1280 : ancho >= 768,
    media: consulta,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

function despiece(modo: Despiece['modo'], cobrado: number, gastos: number): Despiece {
  const neta = cobrado - gastos;
  const base = neta > 0 ? neta : 0;
  const diezmo = Math.round(base * 0.1);
  const sueldo = Math.round(base * 0.48);
  const fijos = Math.round(base * 0.24);
  const remanente = base - diezmo - sueldo - fijos;
  const parte = (monto: number) => (base === 0 ? 0 : monto / base);
  return {
    modo,
    cobrado: centavos(cobrado),
    gastos: centavos(gastos),
    neta: centavos(neta),
    piezas: [
      {
        id: 'diezmo',
        etiqueta: 'Diezmo 10%',
        tesoro: 'diezmo',
        monto: centavos(diezmo),
        falta: centavos(0),
        cubierto: false,
        parte: parte(diezmo),
      },
      {
        id: 'sueldo',
        etiqueta: 'Sueldo',
        tesoro: 'hogar',
        monto: centavos(sueldo),
        falta: centavos(0),
        cubierto: false,
        parte: parte(sueldo),
      },
      {
        id: 'fijos',
        etiqueta: 'Costos fijos',
        tesoro: 'maun',
        monto: centavos(fijos),
        falta: centavos(0),
        cubierto: false,
        parte: parte(fijos),
      },
      {
        id: 'remanente',
        etiqueta: 'Remanente del taller',
        tesoro: 'maun',
        monto: centavos(remanente),
        falta: centavos(0),
        cubierto: false,
        parte: parte(remanente),
      },
    ],
  };
}

function region(): HTMLElement {
  return screen.getByRole('region', { name: 'Distribución de la ganancia' });
}

beforeEach(() => {
  pantallaDe(390);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('la distribución de la ganancia', () => {
  it('cobrado, es el tablero cortado en las cuatro piezas, cada una con su detalle', () => {
    const cobrado = despiece('real', 72_500_000, 14_500_000);
    render(<DistribucionDespiece despiece={cobrado} />);

    const dibujo = region().querySelector('[data-lamina] svg.ilustracion');
    expect(dibujo).not.toBeNull();
    expect(
      [...region().querySelectorAll('[data-pieza]')].map((pieza) =>
        pieza.getAttribute('data-pieza'),
      ),
    ).toEqual(expect.arrayContaining(['diezmo', 'sueldo', 'fijos', 'remanente']));
    expect(region().querySelectorAll('[data-pieza]')).toHaveLength(4);
    expect(region().querySelector('[data-pieza="diezmo"] > title')?.textContent).toBe(
      `Diezmo 10%: ${formatearPesos(centavos(5_800_000))}`,
    );
    expect(region().querySelector('[data-pieza="sueldo"] .hogar')).not.toBeNull();
    expect(region().querySelector('[data-pieza="diezmo"] .diezmo')).not.toBeNull();
    expect(region().querySelector('rect.trazos')).toBeNull();
    expect(region().querySelector('[data-pieza][style]')).toBeNull();
  });

  it('se corta con el corte solo cuando se pide', () => {
    render(<DistribucionDespiece despiece={despiece('real', 72_500_000, 14_500_000)} animar />);

    const piezas = [...region().querySelectorAll<SVGGElement>('[data-pieza]')];
    expect(piezas).toHaveLength(4);
    for (const pieza of piezas) expect(pieza.style.animationName).toBe('maun-corte');
  });

  it('en proyección es el plano de trazos, sin ningún tesoro pintado y sin moverse', () => {
    render(
      <DistribucionDespiece despiece={despiece('proyeccion', 72_500_000, 14_500_000)} animar />,
    );

    expect(region().querySelectorAll('[data-pieza] rect.trazos')).toHaveLength(4);
    expect(region().querySelector('.hogar, .maun, .diezmo, .cocos')).toBeNull();
    expect(region().querySelector('[data-pieza][style]')).toBeNull();
    expect(region().querySelector('[data-pieza="sueldo"] > title')?.textContent).toMatch(
      /^Sueldo: /,
    );
  });

  it('en el celular rotula solo los porcentajes y desde la tablet también el nombre', () => {
    const cobrado = despiece('real', 72_500_000, 14_500_000);
    const celular = render(<DistribucionDespiece despiece={cobrado} />);
    const rotulos = () => [...region().querySelectorAll('.rotulo')].map((r) => r.textContent);
    expect(rotulos()).toContain('48%');
    expect(rotulos()).not.toContain('Sueldo 48%');
    celular.unmount();

    pantallaDe(1440);
    render(<DistribucionDespiece despiece={cobrado} />);
    expect(rotulos()).toContain('Sueldo 48%');
    expect(region().querySelector('.cota')).toBeNull();
  });

  it('un escalón en cero porque el mes ya estaba cubierto lo dice, sin pedir lo que falta', () => {
    const base = despiece('proyeccion', 72_500_000, 14_500_000);
    const cubierto: Despiece = {
      ...base,
      piezas: base.piezas.map((pieza) =>
        pieza.id === 'sueldo' ? { ...pieza, monto: centavos(0), parte: 0, cubierto: true } : pieza,
      ),
    };
    render(<DistribucionDespiece despiece={cubierto} />);
    const sueldo = screen.getByText('Sueldo').closest('li');
    expect(sueldo).toHaveTextContent('ya lo cubrieron otros cobros del mes');
    expect(sueldo).not.toHaveTextContent('faltan');
    expect(region().querySelectorAll('[data-pieza]')).toHaveLength(3);
  });

  it('con la neta en cero o menos, la caja punteada y ningún dibujo', () => {
    const sinCobrar = render(<DistribucionDespiece despiece={despiece('proyeccion', 0, 0)} />);
    expect(region().querySelector('svg')).toBeNull();
    expect(region().querySelector('[data-lamina]')).toBeNull();
    expect(screen.getByText(/Todavía no entró plata de este trabajo/)).toHaveClass('border-dashed');
    sinCobrar.unmount();

    render(<DistribucionDespiece despiece={despiece('real', 10_000_000, 15_000_000)} />);
    expect(region().querySelector('svg')).toBeNull();
    expect(screen.getByText(/Los gastos se comieron lo cobrado/)).toHaveClass('border-dashed');
  });
});
