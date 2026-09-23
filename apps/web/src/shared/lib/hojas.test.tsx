import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation, type Location } from 'react-router';
import { describe, expect, it } from 'vitest';

import {
  conFondo,
  esRutaDeHoja,
  fondoDelEstado,
  fondoPorDefecto,
  useCerrarHoja,
  useUbicacionVisible,
} from './hojas';

const DIEZMO: Location = { pathname: '/diezmo', search: '', hash: '', state: null, key: 'diezmo' };

function Prueba() {
  const cerrar = useCerrarHoja();
  const { pathname } = useLocation();
  const visible = useUbicacionVisible();
  return (
    <>
      <span data-testid="ruta">{pathname}</span>
      <span data-testid="fondo">{visible.pathname}</span>
      <button type="button" onClick={cerrar}>
        Cerrar
      </button>
    </>
  );
}

describe('las hojas que se abren por ruta', () => {
  it('reconocen sus rutas y la pantalla que va detrás por defecto', () => {
    expect(fondoPorDefecto('/finanzas/nuevo?clase=pago_diezmo')).toBe('/finanzas');
    expect(fondoPorDefecto('/finanzas/0190aaaa-bbbb')).toBe('/finanzas');
    expect(fondoPorDefecto('/consultas/nueva')).toBe('/consultas');
    expect(esRutaDeHoja('/proyectos/nuevo')).toBe(false);
    expect(esRutaDeHoja('/finanzas')).toBe(false);
  });

  it('leen el fondo del estado de la navegación y descartan lo que no tiene forma de ubicación', () => {
    expect(fondoDelEstado(conFondo(DIEZMO))).toEqual(DIEZMO);
    expect(fondoDelEstado({ recienLiquidado: true })).toBeUndefined();
    expect(fondoDelEstado({ fondo: 'diezmo' })).toBeUndefined();
    expect(fondoDelEstado(null)).toBeUndefined();
  });

  it('abierta desde adentro de la app, deja ver la pantalla de origen y al cerrar vuelve a ella', () => {
    render(
      <MemoryRouter
        initialEntries={[DIEZMO, { pathname: '/finanzas/nuevo', state: conFondo(DIEZMO) }]}
        initialIndex={1}
      >
        <Prueba />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('fondo')).toHaveTextContent('/diezmo');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.getByTestId('ruta')).toHaveTextContent('/diezmo');
  });

  it('abierta directo por URL, va detrás la pantalla por defecto y al cerrar queda en ella', () => {
    render(
      <MemoryRouter initialEntries={['/consultas/nueva']}>
        <Prueba />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('fondo')).toHaveTextContent('/consultas');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.getByTestId('ruta')).toHaveTextContent('/consultas');
  });
});
