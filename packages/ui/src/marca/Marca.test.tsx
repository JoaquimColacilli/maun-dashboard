import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Isotipo, Logotipo } from './Marca.tsx';
import {
  CAJA_DEL_ISOTIPO,
  CAJA_DEL_LOGOTIPO,
  GROSOR_DEL_TRAVESANO,
  GROSOR_DEL_TRAZO,
  TRAZO_DEL_ISOTIPO,
  TRAZOS_DEL_LOGOTIPO,
  trazosEnSvg,
} from './trazos.ts';

function caminos(elemento: Element): { d: string | null; grosor: string | null }[] {
  return [...elemento.querySelectorAll('path')].map((camino) => ({
    d: camino.getAttribute('d'),
    grosor: camino.getAttribute('stroke-width'),
  }));
}

describe('el logotipo', () => {
  it('es la marca: una imagen que se llama NUMA', () => {
    render(<Logotipo className="h-6 w-auto" />);
    const marca = screen.getByRole('img', { name: 'NUMA' });
    expect(marca.tagName.toLowerCase()).toBe('svg');
    expect(marca).toHaveAttribute('viewBox', CAJA_DEL_LOGOTIPO);
    expect(marca).toHaveClass('h-6', 'w-auto');
  });

  it('se pinta con el color del texto que lo rodea', () => {
    render(<Logotipo />);
    const marca = screen.getByRole('img', { name: 'NUMA' });
    expect(marca).toHaveAttribute('stroke', 'currentColor');
    expect(marca).toHaveAttribute('fill', 'none');
    expect(marca.innerHTML).not.toMatch(/#[0-9a-f]{3,6}/i);
  });

  it('son los trazos de la grilla, con el travesaño de la A más fino', () => {
    render(<Logotipo />);
    const marca = screen.getByRole('img', { name: 'NUMA' });
    expect(marca).toHaveAttribute('stroke-width', String(GROSOR_DEL_TRAZO));
    expect(caminos(marca)).toEqual(
      TRAZOS_DEL_LOGOTIPO.map(({ d, grosor }) => ({
        d,
        grosor: grosor === GROSOR_DEL_TRAZO ? null : String(grosor),
      })),
    );
    expect(caminos(marca).at(-1)?.grosor).toBe(String(GROSOR_DEL_TRAVESANO));
  });

  it('adentro de algo que ya se nombra, no se anuncia', () => {
    render(
      <a href="/" aria-label="NUMA, ir a Inicio">
        <Logotipo decorativa />
      </a>,
    );
    expect(screen.getByRole('link', { name: 'NUMA, ir a Inicio' })).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
    expect(document.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('el isotipo', () => {
  it('es la N del logotipo, sola', () => {
    render(<Isotipo />);
    const marca = screen.getByRole('img', { name: 'NUMA' });
    expect(marca).toHaveAttribute('viewBox', CAJA_DEL_ISOTIPO);
    expect(caminos(marca)).toEqual([{ d: TRAZO_DEL_ISOTIPO.d, grosor: null }]);
    expect(TRAZOS_DEL_LOGOTIPO[0]).toBe(TRAZO_DEL_ISOTIPO);
  });

  it('va en currentColor y puede ir escondido', () => {
    render(<Isotipo decorativa className="size-5" />);
    const dibujo = document.querySelector('svg');
    expect(dibujo).toHaveAttribute('stroke', 'currentColor');
    expect(dibujo).toHaveAttribute('aria-hidden', 'true');
    expect(dibujo).not.toHaveAttribute('role');
    expect(dibujo).toHaveClass('size-5');
  });
});

describe('los trazos en un svg suelto', () => {
  it('llevan el color que se les pide y el mismo grosor que el componente', () => {
    const svg = trazosEnSvg([TRAZO_DEL_ISOTIPO], '#ffffff');
    expect(svg).toContain('stroke="#ffffff"');
    expect(svg).toContain(`stroke-width="${String(GROSOR_DEL_TRAZO)}"`);
    expect(svg).toContain(`<path d="${TRAZO_DEL_ISOTIPO.d}"/>`);
    expect(trazosEnSvg(TRAZOS_DEL_LOGOTIPO, 'currentColor')).toContain(
      `stroke-width="${String(GROSOR_DEL_TRAVESANO)}"`,
    );
  });
});
