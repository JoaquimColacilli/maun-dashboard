import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Ilustracion, NOMBRES_DE_ILUSTRACION } from './Ilustracion.tsx';
import { TILDE } from './mano.ts';
import { ETAPAS_DEL_TRABAJO, TrabajoEnEtapa } from './TrabajoEnEtapa.tsx';

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

  it('solo la firma de «gracias» se traza, y solo si se pide', () => {
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

describe('TrabajoEnEtapa', () => {
  it.each(ETAPAS_DEL_TRABAJO)(
    '«%s» es una escena de 160 × 120 hecha solo con la gramática',
    (etapa) => {
      const { container } = render(<TrabajoEnEtapa etapa={etapa} />);
      const [dibujo] = container.querySelectorAll('svg');

      expect(dibujo).toHaveAttribute('aria-hidden', 'true');
      expect(dibujo).toHaveAttribute('width', '160');
      expect(dibujo).toHaveAttribute('height', '120');
      expect(container.innerHTML).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
      expect(container.innerHTML).not.toMatch(/\b(fill|stroke)="/);
      expect(container.querySelector('text')).toBeNull();
      for (const clase of clasesUsadas(container)) expect(GRAMATICA).toContain(clase);
    },
  );

  it('cada etapa tiene su dibujo', () => {
    const dibujos = ETAPAS_DEL_TRABAJO.map((etapa) => {
      const { container, unmount } = render(<TrabajoEnEtapa etapa={etapa} />);
      const dibujo = container.innerHTML;
      unmount();
      return dibujo;
    });

    expect(new Set(dibujos).size).toBe(ETAPAS_DEL_TRABAJO.length);
  });

  it('la tilde es solo de «pagado», y no se traza', () => {
    for (const etapa of ETAPAS_DEL_TRABAJO) {
      const { container, unmount } = render(<TrabajoEnEtapa etapa={etapa} />);
      const tildes = container.querySelectorAll(`path[d="${TILDE}"]`);

      expect(tildes).toHaveLength(etapa === 'pagado' ? 1 : 0);
      expect(container.querySelector('.trazar')).toBeNull();
      unmount();
    }
  });

  it('mientras se prepara el presupuesto, lo que falta escribir va de trazos', () => {
    const preparando = render(<TrabajoEnEtapa etapa="preparando" />);
    expect(preparando.container.querySelectorAll('.trazos').length).toBeGreaterThan(0);
    preparando.unmount();

    const presupuesto = render(<TrabajoEnEtapa etapa="presupuesto" />);
    expect(presupuesto.container.querySelector('.trazos')).toBeNull();
  });
});
