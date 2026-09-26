import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Navegacion } from './Navegacion';

function pantallaDe(ancho: number) {
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: consulta.includes('prefers-reduced-motion')
      ? false
      : consulta.includes('1280')
        ? ancho >= 1280
        : ancho >= 768,
    media: consulta,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

function montar(ruta: string, nombre = '') {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Navegacion
        email="taller@maun.com.ar"
        nombre={nombre}
        foto=""
        sincronizacion="Todo sincronizado."
      />
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('en el celular', () => {
  it('muestra los cuatro destinos y marca el actual', () => {
    pantallaDe(390);
    montar('/proyectos');

    expect(screen.getByRole('navigation', { name: 'Principal' })).toBeInTheDocument();
    for (const etiqueta of ['Inicio', 'Proyectos', 'Clientes', 'Finanzas']) {
      expect(screen.getByRole('button', { name: etiqueta })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Proyectos' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('estando en Consultas marca Proyectos, que es donde vive', () => {
    pantallaDe(390);
    montar('/consultas');

    expect(screen.getByRole('button', { name: 'Proyectos' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('no muestra Consultas, Diezmo ni Ajustes como destinos', () => {
    pantallaDe(390);
    montar('/');

    expect(screen.queryByRole('button', { name: 'Consultas' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Diezmo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ajustes' })).not.toBeInTheDocument();
  });

  it('el botón de cargar algo nuevo abre el menú y se cierra con Escape', () => {
    pantallaDe(390);
    montar('/');

    const fab = screen.getByRole('button', { name: 'Cargar algo nuevo' });
    expect(fab).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(fab);
    expect(fab).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menuitem', { name: 'Movimiento' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Cobro de proyecto' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(fab).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menuitem', { name: 'Movimiento' })).not.toBeInTheDocument();
  });

  it('mientras se escribe en un campo, la barra no queda flotando sobre el teclado', async () => {
    pantallaDe(390);
    const campo = document.createElement('input');
    document.body.append(campo);
    montar('/');

    expect(screen.getByRole('navigation', { name: 'Principal' })).toBeInTheDocument();

    fireEvent.focusIn(campo);
    expect(screen.queryByRole('navigation', { name: 'Principal' })).not.toBeInTheDocument();

    fireEvent.focusOut(campo);
    expect(await screen.findByRole('navigation', { name: 'Principal' })).toBeInTheDocument();

    campo.remove();
  });

  it('el toque que saca el foco de un campo llega a su botón antes de que vuelva la barra', () => {
    vi.useFakeTimers();
    pantallaDe(390);
    const campo = document.createElement('input');
    const boton = document.createElement('button');
    document.body.append(campo, boton);
    montar('/');
    const barra = () => screen.queryByRole('navigation', { name: 'Principal' });

    fireEvent.focusIn(campo);
    expect(barra()).not.toBeInTheDocument();

    fireEvent.pointerDown(boton);
    fireEvent.focusOut(campo);
    act(() => {
      vi.runAllTimers();
    });
    expect(barra()).not.toBeInTheDocument();

    fireEvent.pointerUp(boton);
    expect(barra()).not.toBeInTheDocument();
    act(() => {
      vi.runAllTimers();
    });
    expect(barra()).toBeInTheDocument();

    fireEvent.focusIn(campo);
    fireEvent.focusOut(campo);
    fireEvent.focusIn(campo);
    act(() => {
      vi.runAllTimers();
    });
    expect(barra()).not.toBeInTheDocument();

    campo.remove();
    boton.remove();
    vi.useRealTimers();
  });
});

describe('en la tablet', () => {
  it('la N del riel también lleva a Inicio', () => {
    pantallaDe(900);
    montar('/proyectos');

    const logo = screen.getByRole('link', { name: 'NUMA, ir a Inicio' });
    expect(logo).toHaveAttribute('href', '/');
    expect(logo).toHaveClass('size-tap');
    expect(logo.querySelector('svg')).toHaveAttribute('viewBox', '0 0 158 200');
    expect(logo.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('en el escritorio', () => {
  it('Consultas, Diezmo y Ajustes son destinos propios', () => {
    pantallaDe(1440);
    montar('/consultas');

    for (const etiqueta of [
      'Inicio',
      'Consultas',
      'Proyectos',
      'Clientes',
      'Finanzas',
      'Diezmo',
      'Ajustes',
    ]) {
      expect(screen.getByRole('button', { name: etiqueta })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Consultas' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('el logo es un link a Inicio con un nombre que lo dice', () => {
    pantallaDe(1440);
    montar('/clientes');

    const logo = screen.getByRole('link', { name: 'NUMA, ir a Inicio' });
    expect(logo).toHaveAttribute('href', '/');
    expect(logo).toHaveClass('min-h-tap');
    expect(logo.querySelector('svg')).toHaveAttribute('viewBox', '0 0 738 200');
    expect(logo.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByText('MAUN')).toBeNull();
    expect(screen.getByText('Taller')).toBeInTheDocument();
  });

  it('muestra el mail y el estado de sincronización', () => {
    pantallaDe(1440);
    montar('/');

    expect(screen.getByText('taller@maun.com.ar')).toBeInTheDocument();
    expect(screen.getByText('Todo sincronizado.')).toBeInTheDocument();
  });

  it('con nombre cargado lo muestra arriba del mail, con sus iniciales', () => {
    pantallaDe(1440);
    montar('/', 'Joaquim Colacilli');

    expect(screen.getByText('Joaquim Colacilli')).toBeInTheDocument();
    expect(screen.getByText('taller@maun.com.ar')).toBeInTheDocument();
    expect(screen.getByText('JC')).toHaveAttribute('aria-hidden', 'true');
  });
});
