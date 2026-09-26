import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import tema from '../styles/theme.css?raw';
import { Interruptor } from './Interruptor.tsx';

function Controlado({ inicial = false }: { inicial?: boolean }) {
  const [activo, setActivo] = useState(inicial);
  return <Interruptor etiqueta="Mis anotaciones" activo={activo} alCambiar={setActivo} />;
}

describe('el interruptor', () => {
  it('es un switch con su nombre y su estado', () => {
    render(<Interruptor etiqueta="Mis anotaciones" activo alCambiar={() => undefined} />);
    const interruptor = screen.getByRole('switch', { name: 'Mis anotaciones' });
    expect(interruptor).toHaveAttribute('aria-checked', 'true');
    expect(interruptor).toHaveAttribute('type', 'button');
  });

  it('al tocarlo avisa el estado contrario', () => {
    const alCambiar = vi.fn();
    render(<Interruptor etiqueta="Entregas" activo={false} alCambiar={alCambiar} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Entregas' }));
    expect(alCambiar).toHaveBeenCalledWith(true);
  });

  it('el nombre también puede salir de su texto, y el texto va al lado de la perilla', () => {
    render(
      <Interruptor activo={false} alCambiar={() => undefined} className="rounded-field border">
        <span>Que tenga que contestarla</span>
      </Interruptor>,
    );
    const interruptor = screen.getByRole('switch', { name: 'Que tenga que contestarla' });
    expect(interruptor).toHaveClass('rounded-field', 'border');
    expect(interruptor).not.toHaveClass('min-h-tap');
  });

  it('la perilla y la pista no se leen: el estado lo dice aria-checked', () => {
    render(<Interruptor etiqueta="Visitas" activo={false} alCambiar={() => undefined} />);
    const interruptor = screen.getByRole('switch', { name: 'Visitas' });
    expect(interruptor.querySelector('[aria-hidden]')).toContainElement(
      interruptor.querySelector('.perilla'),
    );
    expect(interruptor).toHaveClass('min-h-tap');
  });

  it('se mueve solo después de que el dedo lo cambió: al montarse queda en su lugar', () => {
    render(<Controlado />);
    const interruptor = screen.getByRole('switch', { name: 'Mis anotaciones' });
    expect(interruptor).not.toHaveAttribute('data-tocado');
    fireEvent.click(interruptor);
    expect(interruptor).toHaveAttribute('aria-checked', 'true');
    expect(interruptor).toHaveAttribute('data-tocado');
    fireEvent.click(interruptor);
    expect(interruptor).toHaveAttribute('aria-checked', 'false');
  });

  it('la perilla viaja por sus bordes: sale el de adelante y el de atrás lo alcanza, un poco después', () => {
    const [, prendido = ''] =
      /\.interruptor\[data-tocado\]\[aria-checked='true'\] \.perilla \{([^}]*)\}/.exec(tema) ?? [];
    expect(prendido).toMatch(/right var\(--dur-espacial-rapido\) var\(--resorte-espacial-rapido\)/);
    expect(prendido).toMatch(
      /left var\(--dur-espacial\) var\(--resorte-espacial\) var\(--retraso-del-borde-de-atras\)/,
    );
    const [, apagado = ''] = /\.interruptor\[data-tocado\] \.perilla \{([^}]*)\}/.exec(tema) ?? [];
    expect(apagado).toMatch(/left var\(--dur-espacial-rapido\) var\(--resorte-espacial-rapido\)/);
    expect(tema).toContain('--retraso-del-borde-de-atras: calc(var(--dur-espacial-rapido) / 4);');
  });
});
