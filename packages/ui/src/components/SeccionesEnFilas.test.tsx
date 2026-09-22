import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SeccionEnFila, SeccionesEnFilas } from './SeccionesEnFilas.tsx';

function Ajustes() {
  return (
    <SeccionesEnFilas>
      <SeccionEnFila id="titulo-perfil" titulo="Tu perfil" bajada={<p>Tu nombre y tu foto.</p>}>
        <label>
          Nombre
          <input />
        </label>
      </SeccionEnFila>
      <SeccionEnFila id="titulo-cuenta" titulo="Cuenta" cuerpo="items-start">
        <button type="button">Cerrar sesión</button>
      </SeccionEnFila>
    </SeccionesEnFilas>
  );
}

function listaDe(seccion: HTMLElement) {
  const lista = seccion.parentElement;
  return { lista, contenedor: lista?.parentElement };
}

describe('SeccionesEnFilas', () => {
  it('es una sola lista que decide por su propio ancho, y solo desde la tablet', () => {
    render(<Ajustes />);

    const { lista, contenedor } = listaDe(screen.getByRole('region', { name: 'Tu perfil' }));
    expect(contenedor).toHaveAttribute('data-reparto', 'filas');
    expect(contenedor).toHaveClass('md:@container/secciones');
    expect(lista).toHaveClass('flex', 'flex-col', 'gap-8');
  });

  it('cada sección es una fila con su título nombrándola, y los controles después', () => {
    render(<Ajustes />);

    const perfil = screen.getByRole('region', { name: 'Tu perfil' });
    expect(perfil).toHaveAttribute('data-reparto', 'fila');
    expect(perfil).toHaveClass(
      '@min-[44rem]/secciones:grid',
      '@min-[44rem]/secciones:grid-cols-[15rem_minmax(0,1fr)]',
    );

    const [encabezado, cuerpo] = Array.from(perfil.children);
    expect(encabezado).toContainElement(screen.getByRole('heading', { name: 'Tu perfil' }));
    expect(encabezado).toContainElement(screen.getByText('Tu nombre y tu foto.'));
    expect(cuerpo).toContainElement(screen.getByRole('textbox', { name: 'Nombre' }));
  });

  it('en angosto es la misma sección de siempre: una columna de 560 con su línea arriba', () => {
    render(<Ajustes />);

    const perfil = screen.getByRole('region', { name: 'Tu perfil' });
    expect(perfil).toHaveClass(
      'relative',
      'flex',
      'flex-col',
      'gap-3.5',
      'max-w-[560px]',
      'border-t',
      'border-hairline',
      'pt-5',
    );
  });

  it('los campos se achican a lo que llevan solo cuando entran las dos columnas', () => {
    render(<Ajustes />);

    const { lista } = listaDe(screen.getByRole('region', { name: 'Tu perfil' }));
    expect(lista).toHaveClass(
      '@min-[44rem]/secciones:[--campo-corto:8rem]',
      '@min-[44rem]/secciones:[--campo-medio:16rem]',
      '@min-[44rem]/secciones:[--campo-largo:24rem]',
    );
  });

  it('la separación entre secciones la pone el formulario, como la tenía', () => {
    render(
      <SeccionesEnFilas separacion="gap-6">
        <p>Datos del trabajo</p>
      </SeccionesEnFilas>,
    );

    const lista = screen.getByText('Datos del trabajo').parentElement;
    expect(lista).toHaveClass('gap-6');
    expect(lista).not.toHaveClass('gap-8');
  });

  it('el cuerpo acepta lo que la sección necesita sin tocar la fila', () => {
    render(<Ajustes />);

    const cuerpo = screen.getByRole('button', { name: 'Cerrar sesión' }).parentElement;
    expect(cuerpo).toHaveClass('items-start', 'flex-col');
  });
});
