import type { EventoPropio } from '@maun/domain';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { FilaDeEvento } from './FilaDeEvento';
import { useAccionesConFoco } from './useAccionesConFoco';

function anotacion(id: string, texto: string, hecha: boolean): EventoPropio {
  return {
    clase: 'propia',
    id,
    categoria: 'taller',
    fecha: '2026-09-25',
    hora: null,
    texto,
    proyectoId: null,
    proyecto: null,
    hecha,
    importante: false,
  };
}

function terminarLaAnimacion(elemento: Element): void {
  fireEvent.animationEnd(elemento);
  fireEvent(elemento, new Event('webkitAnimationEnd', { bubbles: true }));
}

function ElDia({ inicial }: { inicial: EventoPropio[] }) {
  const [eventos, setEventos] = useState(inicial);
  const { raiz, acciones } = useAccionesConFoco<HTMLDivElement>({
    alAbrirTrabajo: vi.fn(),
    alMarcar: vi.fn(),
    alBorrar: vi.fn(),
    alTildar: (tildado) => {
      setEventos((previos) =>
        previos.map((evento) =>
          evento.id === tildado.id ? { ...evento, hecha: !evento.hecha } : evento,
        ),
      );
    },
  });
  const fila = (evento: EventoPropio) => (
    <FilaDeEvento key={evento.id} evento={evento} hoy="2026-09-25" acciones={acciones} enElDia />
  );
  return (
    <div ref={raiz}>
      <ul aria-label="Pendiente">{eventos.filter((evento) => !evento.hecha).map(fila)}</ul>
      <ul aria-label="Hecho">{eventos.filter((evento) => evento.hecha).map(fila)}</ul>
    </div>
  );
}

function renglon(lista: string, texto: string): HTMLElement {
  const fila = within(screen.getByRole('list', { name: lista }))
    .getByRole('checkbox', { name: texto })
    .closest('li');
  if (fila === null) throw new Error(`no está el renglón de ${texto}`);
  return fila;
}

describe('tildar en la agenda', () => {
  it('lo que ya estaba hecho al abrir el día se ve hecho, sin dibujarse', () => {
    render(<ElDia inicial={[anotacion('a', 'Pasar por el corralón', true)]} />);
    const fila = renglon('Hecho', 'Pasar por el corralón');
    expect(fila.querySelector('svg.tilde')).not.toHaveAttribute('data-dibujar');
    expect(fila.querySelector('.tachado-que-corre')).toBeNull();
  });

  it('lo recién tildado dibuja la tilde y la línea, aunque el renglón cambie de lista', () => {
    render(
      <ElDia
        inicial={[
          anotacion('a', 'Lijar la puerta', false),
          anotacion('b', 'Pasar por el corralón', true),
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'Lijar la puerta' }));

    const fila = renglon('Hecho', 'Lijar la puerta');
    expect(within(fila).getByRole('checkbox')).toHaveFocus();
    expect(fila.querySelector('svg.tilde')).toHaveAttribute('data-dibujar');
    const linea = fila.querySelector('.tachado-que-corre');
    expect(linea).toHaveAttribute('aria-hidden', 'true');
    expect(linea?.parentElement).toHaveClass('line-through', 'decoration-transparent');

    const otra = renglon('Hecho', 'Pasar por el corralón');
    expect(otra.querySelector('svg.tilde')).not.toHaveAttribute('data-dibujar');
    expect(otra.querySelector('.tachado-que-corre')).toBeNull();

    if (linea) terminarLaAnimacion(linea);
    expect(fila.querySelector('.tachado-que-corre')).toBeNull();
    expect(fila.querySelector('svg.tilde')).not.toHaveAttribute('data-dibujar');
    expect(within(fila).getByText('Lijar la puerta')).toHaveClass('line-through');
    expect(within(fila).getByText('Lijar la puerta')).not.toHaveClass('decoration-transparent');
  });

  it('al destildar, todo vuelve en el acto', () => {
    render(<ElDia inicial={[anotacion('a', 'Lijar la puerta', false)]} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Lijar la puerta' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Lijar la puerta' }));
    const fila = renglon('Pendiente', 'Lijar la puerta');
    expect(fila.querySelector('svg.tilde')).toBeNull();
    expect(fila.querySelector('.tachado-que-corre')).toBeNull();
    expect(within(fila).getByRole('checkbox')).toHaveAttribute('aria-checked', 'false');
  });
});
