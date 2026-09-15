import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConSalida, Hoja } from './Hoja';

function Prueba({ alCerrar = () => undefined }: { alCerrar?: () => void }) {
  const [abierta, setAbierta] = useState(true);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setAbierta(!abierta);
        }}
      >
        Alternar
      </button>
      <ConSalida valor={abierta}>
        {() => (
          <Hoja
            titulo="Cargar un movimiento"
            alCerrar={() => {
              alCerrar();
              setAbierta(false);
            }}
          >
            <p>Contenido</p>
          </Hoja>
        )}
      </ConSalida>
    </>
  );
}

function FormularioEnHoja({ alCerrar = () => undefined }: { alCerrar?: () => void }) {
  const [abierta, setAbierta] = useState(true);
  const [texto, setTexto] = useState('');
  return (
    <ConSalida valor={abierta}>
      {() => (
        <Hoja
          titulo="Anotar algo"
          conCambios={texto !== ''}
          alCerrar={() => {
            alCerrar();
            setAbierta(false);
          }}
        >
          {(pedirCierre) => (
            <>
              <label>
                Qué hay que hacer
                <input
                  value={texto}
                  onChange={(evento) => {
                    setTexto(evento.target.value);
                  }}
                />
              </label>
              <button type="button" onClick={pedirCierre}>
                Cancelar
              </button>
            </>
          )}
        </Hoja>
      )}
    </ConSalida>
  );
}

describe('la hoja', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('se abre como diálogo modal con el título como nombre', () => {
    render(<Prueba />);

    const hoja = screen.getByRole('dialog', { name: 'Cargar un movimiento' });
    expect(hoja).toHaveAttribute('open');
  });

  it('Escape pide cerrarla, y se queda montada mientras sale', () => {
    const alCerrar = vi.fn();
    render(<Prueba alCerrar={alCerrar} />);
    const hoja = screen.getByRole('dialog', { name: 'Cargar un movimiento' });

    fireEvent(hoja, new Event('cancel', { cancelable: true }));

    expect(alCerrar).toHaveBeenCalledOnce();
    expect(hoja).not.toHaveAttribute('open');
    expect(screen.getByText('Contenido')).toBeInTheDocument();

    fireEvent.transitionEnd(hoja);
    expect(screen.queryByText('Contenido')).not.toBeInTheDocument();
  });

  it('si la transición no avisa, se desmonta igual al rato', () => {
    render(<Prueba />);

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.getByText('Contenido')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.queryByText('Contenido')).not.toBeInTheDocument();
  });

  it('un formulario intacto se cierra sin preguntar, con Escape, con el fondo, con la X y con Cancelar', () => {
    for (const cerrar of [
      (hoja: HTMLElement) => fireEvent(hoja, new Event('cancel', { cancelable: true })),
      (hoja: HTMLElement) => {
        fireEvent.pointerDown(hoja);
        fireEvent.click(hoja);
      },
      () => fireEvent.click(screen.getByRole('button', { name: 'Cerrar' })),
      () => fireEvent.click(screen.getByRole('button', { name: 'Cancelar' })),
    ]) {
      const alCerrar = vi.fn();
      const { unmount } = render(<FormularioEnHoja alCerrar={alCerrar} />);
      cerrar(screen.getByRole('dialog', { name: 'Anotar algo' }));
      expect(alCerrar).toHaveBeenCalledOnce();
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      unmount();
    }
  });

  it('con algo escrito, cualquier forma de cerrar pregunta antes, y seguir editando conserva lo escrito', () => {
    for (const cerrar of [
      (hoja: HTMLElement) => fireEvent(hoja, new Event('cancel', { cancelable: true })),
      (hoja: HTMLElement) => {
        fireEvent.pointerDown(hoja);
        fireEvent.click(hoja);
      },
      () => fireEvent.click(screen.getByRole('button', { name: 'Cerrar' })),
      () => fireEvent.click(screen.getByRole('button', { name: 'Cancelar' })),
    ]) {
      const alCerrar = vi.fn();
      const { unmount } = render(<FormularioEnHoja alCerrar={alCerrar} />);
      const hoja = screen.getByRole('dialog', { name: 'Anotar algo' });
      fireEvent.change(screen.getByLabelText('Qué hay que hacer'), {
        target: { value: 'Comprar tornillos' },
      });

      cerrar(hoja);
      const pregunta = screen.getByRole('alertdialog', { name: '¿Cerrar sin guardar?' });
      expect(alCerrar).not.toHaveBeenCalled();
      expect(hoja).toHaveAttribute('open');
      expect(screen.getByRole('button', { name: 'Seguir editando' })).toHaveFocus();

      fireEvent.click(screen.getByRole('button', { name: 'Seguir editando' }));
      expect(pregunta).not.toBeInTheDocument();
      expect(screen.getByLabelText('Qué hay que hacer')).toHaveValue('Comprar tornillos');
      unmount();
    }
  });

  it('descartar cierra, y un segundo Escape con la pregunta a la vista vuelve a editar', () => {
    const alCerrar = vi.fn();
    render(<FormularioEnHoja alCerrar={alCerrar} />);
    const hoja = screen.getByRole('dialog', { name: 'Anotar algo' });
    fireEvent.change(screen.getByLabelText('Qué hay que hacer'), { target: { value: 'Algo' } });

    fireEvent(hoja, new Event('cancel', { cancelable: true }));
    fireEvent(hoja, new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(alCerrar).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(alCerrar).toHaveBeenCalledOnce();
    expect(hoja).not.toHaveAttribute('open');
  });

  it('si el navegador la cierra solo con algo escrito, la vuelve a abrir y pregunta', () => {
    const alCerrar = vi.fn();
    render(<FormularioEnHoja alCerrar={alCerrar} />);
    const hoja = screen.getByRole<HTMLDialogElement>('dialog', { name: 'Anotar algo' });
    fireEvent.change(screen.getByLabelText('Qué hay que hacer'), { target: { value: 'Algo' } });

    act(() => {
      hoja.close();
    });
    expect(hoja).toHaveAttribute('open');
    expect(screen.getByRole('alertdialog', { name: '¿Cerrar sin guardar?' })).toBeInTheDocument();
    expect(alCerrar).not.toHaveBeenCalled();
  });

  it('un Escape sin un gesto en el medio llega como cancel que no se frena y después close: con la pregunta a la vista, vuelve a editar', () => {
    const alCerrar = vi.fn();
    render(<FormularioEnHoja alCerrar={alCerrar} />);
    const hoja = screen.getByRole<HTMLDialogElement>('dialog', { name: 'Anotar algo' });
    fireEvent.change(screen.getByLabelText('Qué hay que hacer'), { target: { value: 'Algo' } });

    fireEvent(hoja, new Event('cancel', { cancelable: true }));
    expect(screen.getByRole('alertdialog', { name: '¿Cerrar sin guardar?' })).toBeInTheDocument();

    fireEvent(hoja, new Event('cancel', { cancelable: false }));
    act(() => {
      hoja.close();
    });
    expect(hoja).toHaveAttribute('open');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Qué hay que hacer')).toHaveValue('Algo');
    expect(alCerrar).not.toHaveBeenCalled();
  });

  it('un formulario intacto que recibe un cancel que no se frena se cierra una sola vez', () => {
    const alCerrar = vi.fn();
    render(<FormularioEnHoja alCerrar={alCerrar} />);
    const hoja = screen.getByRole<HTMLDialogElement>('dialog', { name: 'Anotar algo' });

    fireEvent(hoja, new Event('cancel', { cancelable: false }));
    act(() => {
      hoja.close();
    });
    expect(alCerrar).toHaveBeenCalledOnce();
  });

  function Contador() {
    const [veces, setVeces] = useState(0);
    return (
      <button
        type="button"
        onClick={() => {
          setVeces(veces + 1);
        }}
      >
        {`Tocado ${String(veces)}`}
      </button>
    );
  }

  function HojaConEstado() {
    const [abierta, setAbierta] = useState(true);
    return (
      <>
        <button
          type="button"
          onClick={() => {
            setAbierta(!abierta);
          }}
        >
          Alternar
        </button>
        <ConSalida valor={abierta}>
          {() => (
            <Hoja
              titulo="Editar el contacto"
              alCerrar={() => {
                setAbierta(false);
              }}
            >
              <Contador />
            </Hoja>
          )}
        </ConSalida>
      </>
    );
  }

  it('volver a abrirla mientras sale la monta de nuevo, sin el estado de la apertura anterior', () => {
    render(<HojaConEstado />);
    fireEvent.click(screen.getByRole('button', { name: 'Tocado 0' }));
    expect(screen.getByRole('button', { name: 'Tocado 1' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Alternar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Alternar' }));

    expect(screen.getByRole('dialog', { name: 'Editar el contacto' })).toHaveAttribute('open');
    expect(screen.getByRole('button', { name: 'Tocado 0' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tocado 1' })).not.toBeInTheDocument();
  });

  it('se puede volver a abrir mientras sale', () => {
    render(<Prueba />);

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Alternar' }));

    expect(screen.getByRole('dialog', { name: 'Cargar un movimiento' })).toHaveAttribute('open');
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByText('Contenido')).toBeInTheDocument();
  });
});
