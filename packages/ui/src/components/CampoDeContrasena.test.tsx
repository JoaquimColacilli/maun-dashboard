import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CampoDeContrasena } from './CampoDeContrasena.tsx';

function campo(): HTMLInputElement {
  return screen.getByLabelText('Contraseña', { selector: 'input' });
}

function boton(): HTMLButtonElement {
  return screen.getByRole('button', { name: 'Mostrar la contraseña' });
}

describe('CampoDeContrasena', () => {
  it('arranca oculta, con el botón presente y sin apretar', () => {
    render(<CampoDeContrasena etiqueta="Contraseña" autoComplete="current-password" />);

    expect(campo()).toHaveAttribute('type', 'password');
    expect(campo()).toHaveAttribute('autocomplete', 'current-password');
    expect(boton()).toHaveAttribute('aria-pressed', 'false');
    expect(boton()).toHaveAttribute('aria-controls', campo().id);
  });

  it('muestra y oculta la contraseña con el mismo botón, que dice si está apretado', () => {
    render(<CampoDeContrasena etiqueta="Contraseña" defaultValue="secreto" />);

    fireEvent.click(boton());
    expect(campo()).toHaveAttribute('type', 'text');
    expect(boton()).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(boton());
    expect(campo()).toHaveAttribute('type', 'password');
    expect(boton()).toHaveAttribute('aria-pressed', 'false');
  });

  it('el botón sigue ahí con un valor puesto desde afuera, como lo deja el autocompletado', () => {
    const { rerender } = render(<CampoDeContrasena etiqueta="Contraseña" value="" readOnly />);
    rerender(<CampoDeContrasena etiqueta="Contraseña" value="autocompletada" readOnly />);

    campo().blur();
    expect(boton()).toBeVisible();
  });

  it('no le saca el foco al campo: el teclado del celular no se cierra', () => {
    render(<CampoDeContrasena etiqueta="Contraseña" defaultValue="secreto" />);
    campo().focus();

    const toque = createEvent.pointerDown(boton());
    fireEvent(boton(), toque);

    expect(toque.defaultPrevented).toBe(true);
    expect(campo()).toHaveFocus();
  });

  it('conserva la posición del cursor al mostrarla', () => {
    render(<CampoDeContrasena etiqueta="Contraseña" defaultValue="secreto" />);
    campo().focus();
    campo().setSelectionRange(3, 3);

    fireEvent.click(boton());

    expect(campo().selectionStart).toBe(3);
    expect(campo().selectionEnd).toBe(3);
  });

  it('vuelve a ocultarla al enviar el formulario, para que el navegador la guarde como contraseña', () => {
    render(
      <form
        onSubmit={(evento) => {
          evento.preventDefault();
        }}
      >
        <CampoDeContrasena etiqueta="Contraseña" defaultValue="secreto" />
        <button type="submit">Entrar</button>
      </form>,
    );

    fireEvent.click(boton());
    expect(campo()).toHaveAttribute('type', 'text');

    fireEvent.submit(screen.getByRole('button', { name: 'Entrar' }));
    expect(campo()).toHaveAttribute('type', 'password');
  });

  it('anuncia el error como cualquier campo', () => {
    render(<CampoDeContrasena etiqueta="Contraseña" error="Escribí tu contraseña." />);

    expect(screen.getByRole('alert')).toHaveTextContent('Escribí tu contraseña.');
    expect(campo()).toHaveAttribute('aria-invalid', 'true');
  });
});
