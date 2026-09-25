import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Ilustracion, NOMBRES_DE_ILUSTRACION } from './Ilustracion.tsx';
import { MuebleEnEtapa } from './MuebleEnEtapa.tsx';

const GRAMATICA = new Set([
  'ilustracion',
  'fina',
  'trazos',
  'eje',
  'mano',
  'trazar',
  'sin-linea',
  'cara',
  'costado',
  'tinta',
  'hogar',
  'maun',
  'diezmo',
  'cocos',
  'renglon',
  'rotulo',
  'cota',
]);

function clasesUsadas(raiz: Element): string[] {
  return [raiz, ...raiz.querySelectorAll('*')].flatMap((elemento) =>
    (elemento.getAttribute('class') ?? '').split(' ').filter((clase) => clase !== ''),
  );
}

describe('Ilustracion', () => {
  it.each(NOMBRES_DE_ILUSTRACION)('«%s» es una escena de 160 × 120 que no se lee', (nombre) => {
    const { container } = render(<Ilustracion nombre={nombre} />);
    const dibujos = container.querySelectorAll('svg');

    expect(dibujos).toHaveLength(1);
    const [dibujo] = dibujos;
    expect(dibujo).toHaveAttribute('aria-hidden', 'true');
    expect(dibujo).toHaveAttribute('focusable', 'false');
    expect(dibujo).toHaveAttribute('width', '160');
    expect(dibujo).toHaveAttribute('height', '120');
    expect(dibujo).toHaveClass('ilustracion');
  });

  it.each(NOMBRES_DE_ILUSTRACION)(
    '«%s» se dibuja solo con la gramática: ni un color escrito ni una clase de afuera',
    (nombre) => {
      const { container } = render(<Ilustracion nombre={nombre} />);

      expect(container.innerHTML).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
      expect(container.innerHTML).not.toMatch(/\b(fill|stroke)="/);
      for (const clase of clasesUsadas(container)) expect(GRAMATICA).toContain(clase);
    },
  );

  it('solo la tilde de «gracias» se traza, y solo si se pide', () => {
    const quieta = render(<Ilustracion nombre="gracias" />);
    expect(quieta.container.querySelector('.trazar')).toBeNull();
    quieta.unmount();

    const { container } = render(<Ilustracion nombre="gracias" animar />);
    const trazadas = container.querySelectorAll('.trazar');
    expect(trazadas).toHaveLength(1);
    expect(trazadas[0]).toHaveAttribute('pathLength', '1');
    expect(trazadas[0]).toHaveClass('mano');
  });

  it('dos escenas iguales en la misma pantalla no comparten recortes', () => {
    const { container } = render(
      <>
        <Ilustracion nombre="se-corto" />
        <Ilustracion nombre="se-corto" />
      </>,
    );
    const ids = [...container.querySelectorAll('clipPath')].map((recorte) => recorte.id);

    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
  });
});

describe('MuebleEnEtapa', () => {
  it('en plano el mueble es de trazos; en el taller, la carcasa sin puertas; terminado, entero', () => {
    const plano = render(<MuebleEnEtapa etapa="plano" />);
    expect(plano.container.querySelectorAll('.trazos').length).toBeGreaterThan(0);
    expect(plano.container.querySelector('.tinta')).toBeNull();
    plano.unmount();

    const taller = render(<MuebleEnEtapa etapa="taller" />);
    expect(taller.container.querySelector('.trazos')).toBeNull();
    expect(taller.container.querySelectorAll('.tinta').length).toBeGreaterThan(2);
    taller.unmount();

    const terminado = render(<MuebleEnEtapa etapa="terminado" />);
    expect(terminado.container.querySelector('.trazos')).toBeNull();
    expect(terminado.container.querySelector('.mano')).toBeNull();
    terminado.unmount();

    const pagado = render(<MuebleEnEtapa etapa="pagado" />);
    expect(pagado.container.querySelectorAll('.mano')).toHaveLength(1);
  });
});
