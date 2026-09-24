import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TableroCortado, TableroEntero, type PiezaDelTablero } from './TableroCortado.tsx';

const MES: readonly PiezaDelTablero[] = [
  { id: 'hogar', tono: 'hogar', parte: 0.4, nombre: 'Hogar', porcentaje: '40%' },
  { id: 'maun', tono: 'maun', parte: 0.32, nombre: 'Maun', porcentaje: '32%' },
  { id: 'diezmo', tono: 'diezmo', parte: 0.1, nombre: 'Diezmo', porcentaje: '10%' },
  { id: 'cocos', tono: 'cocos', parte: 0, nombre: 'Cocos', porcentaje: '0%' },
  { id: 'gastos', tono: 'sobrante', parte: 0.18, nombre: 'Gastos', porcentaje: '18%' },
];

function piezas(contenedor: HTMLElement): string[] {
  return [...contenedor.querySelectorAll('[data-pieza]')].map(
    (pieza) => pieza.getAttribute('data-pieza') ?? '',
  );
}

describe('TableroCortado', () => {
  it('corta una pieza por cada parte que no es cero, cada una con el canto de su tesoro', () => {
    const { container } = render(<TableroCortado piezas={MES} />);

    expect(piezas(container).sort()).toEqual(['diezmo', 'gastos', 'hogar', 'maun']);
    for (const tono of ['hogar', 'maun', 'diezmo']) {
      expect(container.querySelector(`[data-pieza="${tono}"] .${tono}`)).not.toBeNull();
    }
    expect(container.querySelector('.cocos')).toBeNull();
  });

  it('una parte de menos del 1% no llega a ser pieza: no se vería', () => {
    const conUnaAstilla: readonly PiezaDelTablero[] = [
      ...MES.filter((pieza) => pieza.id !== 'cocos'),
      { id: 'cocos', tono: 'cocos', parte: 0.004, nombre: 'Cocos', porcentaje: '0%' },
    ];
    const { container } = render(<TableroCortado piezas={conUnaAstilla} formato="mini" />);

    expect(piezas(container).sort()).toEqual(['diezmo', 'gastos', 'hogar', 'maun']);
  });

  it('lo que sobra no lleva color: canto crudo y rayado', () => {
    const { container } = render(<TableroCortado piezas={MES} />);
    const sobrante = container.querySelector('[data-pieza="gastos"]');

    expect(sobrante?.querySelector('.costado')).not.toBeNull();
    expect(sobrante?.querySelector('path.fina')).not.toBeNull();
    expect(sobrante?.querySelector('.hogar, .maun, .diezmo, .cocos')).toBeNull();
  });

  it('en grande rotula nombre y porcentaje y lleva la medida; en chico, ni rótulos ni medida', () => {
    const grande = render(<TableroCortado piezas={MES} medida="$ 1.240.000" />);
    expect(screen.getByText('Hogar 40%')).toBeInTheDocument();
    expect(screen.getByText('$ 1.240.000')).toBeInTheDocument();
    grande.unmount();

    const { container } = render(
      <TableroCortado piezas={MES} formato="mini" medida="$ 1.240.000" />,
    );
    expect(container.querySelector('text')).toBeNull();
  });

  it('se corta con la animación del corte solo cuando se pide, pieza por pieza', () => {
    const quieto = render(<TableroCortado piezas={MES} />);
    expect(quieto.container.querySelector('[data-pieza][style]')).toBeNull();
    quieto.unmount();

    const { container } = render(<TableroCortado piezas={MES} animar />);
    const cortadas = [...container.querySelectorAll<SVGGElement>('[data-pieza]')];
    expect(cortadas.map((pieza) => pieza.style.animationName)).toEqual(
      cortadas.map(() => 'maun-corte'),
    );
    expect(new Set(cortadas.map((pieza) => pieza.style.animationDelay)).size).toBe(cortadas.length);
  });
  it('proyectado es el plano del corte: el tablero entero, las piezas de trazos y ningún canto de color', () => {
    const { container } = render(<TableroCortado piezas={MES} formato="medio" proyectado animar />);

    expect(piezas(container).sort()).toEqual(['diezmo', 'gastos', 'hogar', 'maun']);
    expect(container.querySelectorAll('[data-pieza] rect.trazos')).toHaveLength(4);
    expect(container.querySelector('.hogar, .maun, .diezmo, .cocos')).toBeNull();
    expect(container.querySelector('[data-pieza][style]')).toBeNull();
    expect(screen.getByText('40%')).toBeInTheDocument();
  });

  it('cada pieza lleva su detalle como título, si lo tiene', () => {
    const conDetalle = MES.map((pieza) => ({ ...pieza, detalle: `${pieza.nombre}: algo` }));
    const { container } = render(<TableroCortado piezas={conDetalle} />);

    expect(container.querySelector('[data-pieza="hogar"] > title')?.textContent).toBe(
      'Hogar: algo',
    );
    const sinDetalle = render(<TableroCortado piezas={MES} />);
    expect(sinDetalle.container.querySelector('title')).toBeNull();
  });
});

describe('TableroEntero', () => {
  it('sin cortar muestra por dónde se va a cortar, sin color', () => {
    const { container } = render(<TableroEntero />);

    expect(container.querySelector('.eje')).not.toBeNull();
    expect(container.querySelector('.hogar, .maun, .diezmo, .cocos, .mano')).toBeNull();
  });

  it('para arrancar suma la escuadra, el lápiz y la primera marca, que se traza si se pide', () => {
    const quieto = render(<TableroEntero herramientas />);
    expect(quieto.container.querySelector('.mano')).not.toBeNull();
    expect(quieto.container.querySelector('.trazar')).toBeNull();
    quieto.unmount();

    const { container } = render(<TableroEntero herramientas animar />);
    expect(container.querySelector('.mano.trazar')).toHaveAttribute('pathLength', '1');
  });
});
