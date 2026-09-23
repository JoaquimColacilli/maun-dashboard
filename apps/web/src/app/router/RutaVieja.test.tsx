import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { RutaVieja } from './RutaVieja';

function DondeQuedo() {
  const { pathname, search } = useLocation();
  return <p data-testid="donde">{`${pathname}${search}`}</p>;
}

function montar(inicial: string) {
  render(
    <MemoryRouter initialEntries={[inicial]}>
      <Routes>
        <Route path="/seguimiento" element={<RutaVieja a="/consultas" />} />
        <Route path="/seguimiento/nuevo" element={<RutaVieja a="/consultas/nueva" />} />
        <Route path="*" element={<DondeQuedo />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('las rutas de antes de llamarse Consultas', () => {
  it('la lista vieja lleva a Consultas', () => {
    montar('/seguimiento');
    expect(screen.getByTestId('donde')).toHaveTextContent('/consultas');
  });

  it('cargar un contacto lleva a la consulta nueva y conserva el día de la visita', () => {
    montar('/seguimiento/nuevo?visita=2026-09-15');
    expect(screen.getByTestId('donde')).toHaveTextContent('/consultas/nueva?visita=2026-09-15');
  });
});
