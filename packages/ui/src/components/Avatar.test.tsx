import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Avatar, colorDelNombre, inicialesDelNombre } from './Avatar.tsx';

describe('Avatar', () => {
  it('muestra la inicial del nombre y la del apellido', () => {
    const { container } = render(<Avatar nombre="Joaquim Colacilli" />);
    expect(container.textContent).toBe('JC');
  });

  it('con una sola palabra muestra una inicial, y con acentos y ñ también', () => {
    expect(inicialesDelNombre('taller@maun.com.ar')).toBe('T');
    expect(inicialesDelNombre('  Ñandú   Álvarez ')).toBe('ÑÁ');
    expect(inicialesDelNombre('')).toBe('');
  });

  it('el mismo nombre da siempre el mismo color, sin importar mayúsculas ni espacios', () => {
    expect(colorDelNombre('Joaquim Colacilli')).toBe(colorDelNombre('  joaquim colacilli '));
    expect(colorDelNombre('Joaquim Colacilli')).toBeGreaterThanOrEqual(0);
    expect(colorDelNombre('Joaquim Colacilli')).toBeLessThan(6);
  });

  it('sin foto muestra las iniciales, y con foto las deja de respaldo mientras carga', () => {
    const { container, rerender } = render(<Avatar nombre="Joaquim Colacilli" />);
    const circulo = container.firstElementChild;
    expect(circulo).toHaveAttribute('data-foto', 'sin-foto');
    expect(container.querySelector('img')).toBeNull();

    rerender(<Avatar nombre="Joaquim Colacilli" foto="https://fotos.test/a.webp?cacheNonce=1" />);
    expect(circulo).toHaveAttribute('data-foto', 'cargando');
    expect(circulo?.textContent).toBe('JC');
    expect(container.querySelector('img')).toHaveClass('opacity-0');
  });

  it('cuando la foto carga la muestra, y si falla vuelve a las iniciales', () => {
    const { container, rerender } = render(
      <Avatar nombre="Joaquim Colacilli" foto="https://fotos.test/a.webp?cacheNonce=1" />,
    );
    const imagen = container.querySelector('img');
    if (!imagen) throw new Error('falta la imagen');
    fireEvent.load(imagen);
    expect(container.firstElementChild).toHaveAttribute('data-foto', 'lista');
    expect(imagen).toHaveClass('opacity-100');

    rerender(<Avatar nombre="Joaquim Colacilli" foto="https://fotos.test/a.webp?cacheNonce=2" />);
    expect(container.firstElementChild).toHaveAttribute('data-foto', 'cargando');
    const nueva = container.querySelector('img');
    if (!nueva) throw new Error('falta la imagen nueva');
    fireEvent.error(nueva);
    expect(container.firstElementChild).toHaveAttribute('data-foto', 'fallo');
    expect(container.querySelector('img')).toBeNull();
  });

  it('queda fuera del árbol de accesibilidad: el nombre ya está escrito al lado', () => {
    const { container } = render(<Avatar nombre="Joaquim" />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });
});
