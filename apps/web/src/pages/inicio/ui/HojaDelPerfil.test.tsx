import { pasoDe } from '@maun/domain';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { NovedadesDeOpiniones } from '@/entities/opinion';
import { TABLAS_REPLICADAS, type Replica, type TablaReplicada } from '@/shared/api';

import { HojaDelPerfil } from './HojaDelPerfil';
import { UltimaOpinion } from './UltimaOpinion';

function replicaVacia(): Replica {
  const tablas = {} as Record<TablaReplicada, Record<string, unknown>>;
  for (const tabla of TABLAS_REPLICADAS) tablas[tabla] = {};
  return { usuarioId: 'u', cursor: '', reconciliadoEn: '', tablas } as unknown as Replica;
}

const SIN_NOVEDADES: NovedadesDeOpiniones = { sinLeer: 0, nombres: [], ultima: null };

function montar(novedades: NovedadesDeOpiniones) {
  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient()}>
        <HojaDelPerfil
          replica={replicaVacia()}
          hoy="2026-09-21"
          nombre="Fabián Maun"
          email="taller@maun.com.ar"
          foto=""
          novedades={novedades}
          alCerrar={() => undefined}
        />
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return screen.getByRole('dialog', { name: 'Fabián Maun' });
}

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('la hoja del perfil', () => {
  it('lleva a Opiniones, Diezmo, Agenda y Ajustes, y deja cerrar la sesión', () => {
    const hoja = montar(SIN_NOVEDADES);

    expect(within(hoja).getByText('taller@maun.com.ar')).toBeInTheDocument();
    expect(within(hoja).getByRole('link', { name: /^Opiniones/ })).toHaveAttribute(
      'href',
      '/opiniones',
    );
    expect(within(hoja).getByRole('link', { name: /^Diezmo/ })).toHaveAttribute('href', '/diezmo');
    expect(within(hoja).getByRole('link', { name: /^Agenda/ })).toHaveAttribute('href', '/agenda');
    expect(within(hoja).getByRole('link', { name: /^Ajustes/ })).toHaveAttribute(
      'href',
      '/ajustes',
    );
    expect(within(hoja).getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
    expect(within(hoja).getByText('Lo que contestaron tus clientes')).toBeInTheDocument();
    expect(within(hoja).getByText('Nada agendado por ahora')).toBeInTheDocument();
    expect(within(hoja).getByText('Estás al día')).toBeInTheDocument();
  });

  it('con opiniones sin leer muestra cuántas y quiénes', () => {
    const hoja = montar({ sinLeer: 2, nombres: ['Nadia Roldán', 'Hernán Cabrera'], ultima: null });

    const opiniones = within(hoja).getByRole('link', { name: /^Opiniones/ });
    expect(within(opiniones).getByText('2 nuevas')).toBeInTheDocument();
    expect(within(opiniones).getByText('Nadia y Hernán opinaron')).toBeInTheDocument();
  });
});

describe('la línea de Inicio', () => {
  it('dice quién opinó de qué, con su frase, y lleva a esa respuesta', () => {
    render(
      <MemoryRouter>
        <UltimaOpinion
          ultima={{
            respuestaId: 'r1',
            cliente: 'Nadia Roldán',
            trabajo: 'Escritorio en L con pasacables',
            titular: pasoDe({ tipo: 'escala5', escala: 'conformidad', opciones: null }, 5),
            comentario: 'Quedó impecable.',
          }}
        />
      </MemoryRouter>,
    );

    const linea = screen.getByRole('link', { name: /Nadia Roldán opinó de su escritorio/ });
    expect(linea).toHaveAttribute('href', '/opiniones?respuesta=r1');
    expect(within(linea).getByText('«Quedó impecable.»')).toBeInTheDocument();
  });

  it('sin comentario muestra lo que contestó en la pregunta de arriba', () => {
    render(
      <MemoryRouter>
        <UltimaOpinion
          ultima={{
            respuestaId: 'r2',
            cliente: '',
            trabajo: 'MESA',
            titular: pasoDe({ tipo: 'escala5', escala: 'conformidad', opciones: null }, 4),
            comentario: null,
          }}
        />
      </MemoryRouter>,
    );

    const linea = screen.getByRole('link', { name: /Un cliente opinó de su mueble/ });
    expect(within(linea).getByText('Conforme')).toBeInTheDocument();
  });
});
