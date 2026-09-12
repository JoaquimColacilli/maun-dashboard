import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { leerImporte, MoneyInput, textoDelImporte } from './MoneyInput.tsx';

function Prueba({
  inicial = null,
  alCambiar,
}: {
  inicial?: number | null;
  alCambiar?: (centavos: number | null) => void;
}) {
  const [valor, setValor] = useState<number | null>(inicial);
  return (
    <>
      <MoneyInput
        etiqueta="Cuánta plata"
        value={valor}
        onChange={(centavos) => {
          alCambiar?.(centavos);
          setValor(centavos);
        }}
      />
      <output data-testid="centavos">{valor === null ? 'vacío' : String(valor)}</output>
      <button
        type="button"
        onClick={() => {
          setValor(123_400);
        }}
      >
        Cambiar desde afuera
      </button>
    </>
  );
}

function tipear(campo: HTMLElement, caracter: string) {
  const actual = (campo as HTMLInputElement).value;
  fireEvent.input(campo, {
    target: { value: `${actual}${caracter}` },
    inputType: 'insertText',
    data: caracter,
  });
}

describe('MoneyInput', () => {
  it('los dígitos entran de derecha a izquierda con el punto de miles, y sale en centavos', () => {
    const alCambiar = vi.fn();
    render(<Prueba alCambiar={alCambiar} />);
    const campo = screen.getByLabelText('Cuánta plata');

    for (const digito of '5000') tipear(campo, digito);

    expect(campo).toHaveValue('5.000');
    expect(alCambiar.mock.calls.map(([centavos]) => centavos as number)).toEqual([
      500, 5_000, 50_000, 500_000,
    ]);
    expect(screen.getByTestId('centavos')).toHaveTextContent('500000');
  });

  it('sin decimales por defecto: la coma los habilita, hasta dos', () => {
    render(<Prueba />);
    const campo = screen.getByLabelText('Cuánta plata');

    for (const caracter of '1250,505') tipear(campo, caracter);

    expect(campo).toHaveValue('1.250,50');
    expect(screen.getByTestId('centavos')).toHaveTextContent('125050');
  });

  it('un punto tipeado en un teclado que no tiene coma también abre los decimales', () => {
    render(<Prueba />);
    const campo = screen.getByLabelText('Cuánta plata');

    for (const caracter of '.5') tipear(campo, caracter);

    expect(campo).toHaveValue('0,5');
    expect(screen.getByTestId('centavos')).toHaveTextContent('50');
  });

  it('borrar saca desde el final, aunque el cursor esté en otro lado', () => {
    render(<Prueba inicial={500_000} />);
    const campo = screen.getByLabelText('Cuánta plata');

    fireEvent.input(campo, { target: { value: '5.00' }, inputType: 'deleteContentBackward' });
    expect(campo).toHaveValue('500');

    fireEvent.input(campo, { target: { value: '' }, inputType: 'deleteContentBackward' });
    expect(screen.getByTestId('centavos')).toHaveTextContent('vacío');
  });

  it('pegar un valor con formato lo reemplaza entero', () => {
    render(<Prueba inicial={500} />);
    const campo = screen.getByLabelText('Cuánta plata');

    fireEvent.paste(campo, { clipboardData: { getData: () => '$ 1.234,56' } });

    expect(campo).toHaveValue('1.234,56');
    expect(screen.getByTestId('centavos')).toHaveTextContent('123456');
  });

  it('escribir un texto entero de una vez, como lo hace el autocompletar, lo lee con formato', () => {
    render(<Prueba />);
    const campo = screen.getByLabelText('Cuánta plata');

    fireEvent.input(campo, {
      target: { value: '700.000' },
      inputType: 'insertText',
      data: '700.000',
    });
    expect(screen.getByTestId('centavos')).toHaveTextContent('70000000');

    fireEvent.input(campo, { target: { value: 'hola' }, inputType: 'insertText', data: 'hola' });
    expect(screen.getByTestId('centavos')).toHaveTextContent('70000000');
  });

  it('un valor que cambia desde afuera se vuelve a escribir con formato', () => {
    render(<Prueba inicial={500} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cambiar desde afuera' }));

    expect(screen.getByLabelText('Cuánta plata')).toHaveValue('1.234');
  });

  it('pide el teclado con coma y no deja que el navegador autocomplete', () => {
    render(<Prueba />);
    const campo = screen.getByLabelText('Cuánta plata');

    expect(campo).toHaveAttribute('inputmode', 'decimal');
    expect(campo).toHaveAttribute('autocomplete', 'off');
  });
});

describe('leerImporte', () => {
  it('entiende las formas en que se escribe plata en Argentina', () => {
    const comoSeVe = (texto: string) => {
      const importe = leerImporte(texto);
      return importe === null ? null : textoDelImporte(importe);
    };
    expect(comoSeVe('1.500')).toBe('1.500');
    expect(comoSeVe('1500')).toBe('1.500');
    expect(comoSeVe('12,5')).toBe('12,5');
    expect(comoSeVe('1234.56')).toBe('1.234,56');
    expect(comoSeVe('007')).toBe('7');
    expect(comoSeVe('')).toBe('');
    expect(comoSeVe('1,234.56')).toBeNull();
    expect(comoSeVe('-100')).toBeNull();
    expect(comoSeVe('12345678901234')).toBeNull();
  });
});
