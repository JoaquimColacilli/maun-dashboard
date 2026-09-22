import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { FilaDe } from '@/shared/api';

import type { EdicionDeAjustes } from '../api/mutacion';
import { FormularioDeResena } from './FormularioDeResena';

const AJUSTES = {
  id: 'aj',
  household_id: 'h',
  resena_link: '',
} as FilaDe<'ajustes'>;

function montar(ajustes: FilaDe<'ajustes'> = AJUSTES) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <FormularioDeResena ajustes={ajustes} />
    </QueryClientProvider>,
  );
  return {
    guardados: () =>
      queryClient
        .getMutationCache()
        .getAll()
        .map((mutacion) => mutacion.state.variables as EdicionDeAjustes),
  };
}

function escribir(texto: string): void {
  fireEvent.change(screen.getByRole('textbox', { name: /Enlace para dejar una reseña/ }), {
    target: { value: texto },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar el enlace' }));
}

beforeEach(() => {
  onlineManager.setOnline(false);
});

afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
});

describe('el enlace de las reseñas', () => {
  it('solo acepta un enlace de Google, con https', () => {
    const { guardados } = montar();

    escribir('http://g.page/r/maun/review');
    expect(screen.getByText(/Tiene que empezar con https:\/\//)).toBeInTheDocument();

    escribir('https://reseñas-truchas.com/maun');
    expect(screen.getByText(/Tiene que ser un enlace de Google/)).toBeInTheDocument();

    expect(guardados()).toEqual([]);
  });

  it('guarda el enlace limpio y vacío lo saca', () => {
    const { guardados } = montar();

    escribir('  https://g.page  ');
    expect(guardados()[0]).toMatchObject({
      cambios: { resena_link: 'https://g.page/' },
      previos: { resena_link: '' },
    });
  });

  it('borrarlo manda el vacío, que apaga el pedido de reseña', () => {
    const { guardados } = montar({ ...AJUSTES, resena_link: 'https://g.page/r/maun/review' });

    escribir('   ');
    expect(guardados()[0]).toMatchObject({ cambios: { resena_link: '' } });
  });
});
