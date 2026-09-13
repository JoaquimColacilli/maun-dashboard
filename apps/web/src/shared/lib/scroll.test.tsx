import { act, fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import {
  createMemoryRouter,
  Outlet,
  RouterProvider,
  useLocation,
  useNavigate,
  type Location,
} from 'react-router';
import { describe, expect, it } from 'vitest';

import { useScrollPorPantalla } from './scroll';

function ubicacionVisible(location: Location): Location {
  const estado: unknown = location.state;
  if (typeof estado !== 'object' || estado === null || !('fondo' in estado)) return location;
  const fondo: unknown = estado.fondo;
  return typeof fondo === 'object' && fondo !== null ? (fondo as Location) : location;
}

function Marco() {
  const principal = useRef<HTMLElement>(null);
  const location = useLocation();
  const navegar = useNavigate();
  useScrollPorPantalla(principal, ubicacionVisible(location));

  return (
    <>
      <nav>
        <button
          type="button"
          onClick={() => {
            void navegar('/finanzas');
          }}
        >
          Ir a finanzas
        </button>
        <button
          type="button"
          onClick={() => {
            void navegar('/finanzas?tesoro=hogar', { replace: true });
          }}
        >
          Solo hogar
        </button>
        <button
          type="button"
          onClick={() => {
            void navegar('/finanzas/nuevo', { state: { fondo: location } });
          }}
        >
          Cargar
        </button>
        <button
          type="button"
          onClick={() => {
            void navegar(-1);
          }}
        >
          Atrás
        </button>
      </nav>
      <main ref={principal} data-testid="principal">
        <Outlet />
      </main>
    </>
  );
}

function montar() {
  const router = createMemoryRouter(
    [
      {
        element: <Marco />,
        children: [
          { path: '/', element: <p>Pantalla de inicio</p> },
          { path: '/finanzas', element: <p>Pantalla de finanzas</p> },
          { path: '/finanzas/nuevo', element: <p>Hoja de carga</p> },
        ],
      },
    ],
    { initialEntries: ['/'] },
  );
  render(<RouterProvider router={router} />);
  const principal = screen.getByTestId('principal');
  Object.defineProperty(principal, 'scrollTop', { value: 0, writable: true, configurable: true });
  Object.defineProperty(principal, 'scrollTo', {
    configurable: true,
    value: (opciones: ScrollToOptions) => {
      principal.scrollTop = opciones.top ?? 0;
    },
  });
  return principal;
}

function scrollear(principal: HTMLElement, posicion: number) {
  principal.scrollTop = posicion;
  fireEvent.scroll(principal);
}

function tocar(nombre: string) {
  act(() => {
    fireEvent.click(screen.getByRole('button', { name: nombre }));
  });
}

describe('el scroll de las pantallas', () => {
  it('ir a otra pantalla arranca arriba, y volver con atrás recupera donde estaba', async () => {
    const principal = montar();
    scrollear(principal, 640);

    tocar('Ir a finanzas');
    expect(await screen.findByText('Pantalla de finanzas')).toBeInTheDocument();
    expect(principal.scrollTop).toBe(0);

    scrollear(principal, 120);
    tocar('Atrás');
    expect(await screen.findByText('Pantalla de inicio')).toBeInTheDocument();
    expect(principal.scrollTop).toBe(640);
  });

  it('cambiar un filtro de la misma pantalla no mueve el scroll, y atrás lo sigue recordando', async () => {
    const principal = montar();
    tocar('Ir a finanzas');
    expect(await screen.findByText('Pantalla de finanzas')).toBeInTheDocument();
    scrollear(principal, 300);

    tocar('Solo hogar');
    expect(principal.scrollTop).toBe(300);

    tocar('Atrás');
    expect(await screen.findByText('Pantalla de inicio')).toBeInTheDocument();
    expect(principal.scrollTop).toBe(0);
  });

  it('abrir una hoja encima de la pantalla no toca el scroll del fondo', async () => {
    const principal = montar();
    tocar('Ir a finanzas');
    expect(await screen.findByText('Pantalla de finanzas')).toBeInTheDocument();
    scrollear(principal, 450);

    tocar('Cargar');
    expect(await screen.findByText('Hoja de carga')).toBeInTheDocument();
    expect(principal.scrollTop).toBe(450);

    tocar('Atrás');
    expect(await screen.findByText('Pantalla de finanzas')).toBeInTheDocument();
    expect(principal.scrollTop).toBe(450);
  });
});
