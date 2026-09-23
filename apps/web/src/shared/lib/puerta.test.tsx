import { act, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode, useState } from 'react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { Ir } from './Ir';
import {
  ContextoDeLaPuerta,
  useIr,
  useSenalDeUnaVez,
  useVolver,
  type PuertoDeNavegacion,
} from './puerta';

function Ruta() {
  const { pathname, search } = useLocation();
  return <span data-testid="ruta">{`${pathname}${search}`}</span>;
}

function Largo() {
  const location = useLocation();
  const navegar = useNavigate();
  return (
    <>
      <span data-testid="clave">{location.key}</span>
      <button
        type="button"
        onClick={() => {
          void navegar(-1);
        }}
      >
        Atrás del navegador
      </button>
    </>
  );
}

function puertoFalso(): PuertoDeNavegacion & { llamadas: unknown[][] } {
  const llamadas: unknown[][] = [];
  return {
    llamadas,
    ir: (destino, opciones) => {
      llamadas.push(['ir', destino, opciones]);
    },
    volver: (padre) => {
      llamadas.push(['volver', padre]);
    },
    etiquetaDeVolver: (_padre, etiqueta) => `${etiqueta} (según el historial)`,
    hayUnaTransicion: () => false,
  };
}

describe('sin proveedor, la puerta navega derecho con el router', () => {
  it('el enlace conserva su dirección y un toque común apila', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Ir a="/finanzas?tesoro=hogar">Finanzas</Ir>
        <Ruta />
      </MemoryRouter>,
    );
    const enlace = screen.getByRole('link', { name: 'Finanzas' });
    expect(enlace).toHaveAttribute('href', '/finanzas?tesoro=hogar');
    fireEvent.click(enlace);
    expect(screen.getByTestId('ruta')).toHaveTextContent('/finanzas?tesoro=hogar');
  });

  it('con una tecla modificadora no intercepta: el navegador abre otra pestaña', () => {
    const alTocar = vi.fn();
    render(
      <MemoryRouter initialEntries={['/']}>
        <Ir a="/clientes" alTocar={alTocar}>
          Clientes
        </Ir>
        <Ruta />
      </MemoryRouter>,
    );
    const sinSalirDeJsdom = (evento: Event) => {
      evento.preventDefault();
    };
    document.addEventListener('click', sinSalirDeJsdom);
    fireEvent.click(screen.getByRole('link', { name: 'Clientes' }), { ctrlKey: true });
    document.removeEventListener('click', sinSalirDeJsdom);
    expect(alTocar).not.toHaveBeenCalled();
    expect(screen.getByTestId('ruta')).toHaveTextContent('/');
  });

  it('ir reemplaza y termina reemplazando, y volver apila el padre con la etiqueta de hoy', () => {
    function Botones() {
      const ir = useIr();
      const vuelta = useVolver('/proyectos', 'Proyectos');
      return (
        <>
          <button
            type="button"
            onClick={() => {
              ir('/consultas', { como: 'reemplazar' });
            }}
          >
            Reemplazar
          </button>
          <button type="button" onClick={vuelta.volver}>
            {vuelta.etiqueta}
          </button>
        </>
      );
    }
    render(
      <MemoryRouter initialEntries={['/', '/proyectos/1']} initialIndex={1}>
        <Botones />
        <Ruta />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Proyectos' }));
    expect(screen.getByTestId('ruta')).toHaveTextContent('/proyectos');
    fireEvent.click(screen.getByRole('button', { name: 'Reemplazar' }));
    expect(screen.getByTestId('ruta')).toHaveTextContent('/consultas');
  });
});

describe('con proveedor, la puerta le pasa todo al puerto', () => {
  it('el enlace y el hook mandan el destino con sus opciones, y la etiqueta sale del puerto', () => {
    const puerto = puertoFalso();
    function Pantalla() {
      const vuelta = useVolver('/clientes', 'Clientes');
      return (
        <>
          <Ir a="/proyectos/1" como="terminar" state={{ uno: 1 }}>
            Abrir
          </Ir>
          <button type="button" onClick={vuelta.volver}>
            {vuelta.etiqueta}
          </button>
        </>
      );
    }
    render(
      <MemoryRouter initialEntries={['/']}>
        <ContextoDeLaPuerta value={puerto}>
          <Pantalla />
        </ContextoDeLaPuerta>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('link', { name: 'Abrir' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clientes (según el historial)' }));
    expect(puerto.llamadas).toEqual([
      [
        'ir',
        '/proyectos/1',
        {
          como: 'terminar',
          state: { uno: 1 },
          senal: undefined,
          desdeLaNavegacion: undefined,
        },
      ],
      ['volver', '/clientes'],
    ]);
  });

  it('una etiqueta que nombra una acción no cambia', () => {
    const puerto = puertoFalso();
    function Pantalla() {
      const vuelta = useVolver('/proyectos/1', 'Volver sin cobrar', { fija: true });
      return <span>{vuelta.etiqueta}</span>;
    }
    render(
      <MemoryRouter>
        <ContextoDeLaPuerta value={puerto}>
          <Pantalla />
        </ContextoDeLaPuerta>
      </MemoryRouter>,
    );
    expect(screen.getByText('Volver sin cobrar')).toBeInTheDocument();
  });
});

describe('la señal de una vez', () => {
  function Ficha() {
    const recien = useSenalDeUnaVez('recienLiquidado');
    const [renders, setRenders] = useState(0);
    return (
      <>
        <span data-testid="senal">{recien ? 'con corte' : 'sin corte'}</span>
        <Ir a="/proyectos/1/editar">Editar</Ir>
        <button
          type="button"
          onClick={() => {
            setRenders(renders + 1);
          }}
        >
          Otra vez
        </button>
      </>
    );
  }

  function Cobro() {
    const ir = useIr();
    return (
      <button
        type="button"
        onClick={() => {
          ir('/proyectos/1', { senal: 'recienLiquidado' });
        }}
      >
        Cobrar
      </button>
    );
  }

  it('la lee la pantalla de destino en su primer render, la sostiene y volver a esa entrada no la repite', () => {
    render(
      <StrictMode>
        <MemoryRouter initialEntries={['/proyectos/1/cobrar']}>
          <Routes>
            <Route path="/proyectos/1/cobrar" element={<Cobro />} />
            <Route
              path="/proyectos/1"
              element={
                <>
                  <Ficha />
                  <Largo />
                </>
              }
            />
            <Route path="/proyectos/1/editar" element={<Largo />} />
          </Routes>
        </MemoryRouter>
      </StrictMode>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cobrar' }));
    expect(screen.getByTestId('senal')).toHaveTextContent('con corte');
    fireEvent.click(screen.getByRole('button', { name: 'Otra vez' }));
    expect(screen.getByTestId('senal')).toHaveTextContent('con corte');

    const clave = screen.getByTestId('clave').textContent;
    act(() => {
      fireEvent.click(screen.getByRole('link', { name: 'Editar' }));
    });
    expect(screen.queryByTestId('senal')).not.toBeInTheDocument();
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Atrás del navegador' }));
    });
    expect(screen.getByTestId('clave')).toHaveTextContent(clave);
    expect(screen.getByTestId('senal')).toHaveTextContent('sin corte');
  });

  it('una pantalla a la que no se llegó con la señal no la ve', () => {
    render(
      <MemoryRouter initialEntries={['/proyectos/1']}>
        <Routes>
          <Route path="/proyectos/1" element={<Ficha />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('senal')).toHaveTextContent('sin corte');
  });
});
