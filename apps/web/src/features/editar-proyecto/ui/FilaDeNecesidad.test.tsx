import { LARGO_MAXIMO_DEL_NOMBRE } from '@maun/domain';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { LISTAS_DEL_TRABAJO, type Necesidad } from '@/entities/proyecto';

import { FilaDeNecesidad, type CambiosDeLaFila } from './FilaDeNecesidad';

const HERRAJES = LISTAS_DEL_TRABAJO.find((lista) => lista.tipo === 'herraje');

function necesidad(extra: Partial<Necesidad> = {}): Necesidad {
  return {
    id: 'n1',
    household_id: 'h',
    proyecto_id: 'p1',
    tipo: 'herraje',
    nombre: 'Bisagras Cazoleta 35 Cierre Suave',
    cantidad: 4,
    listo: false,
    created_at: '2026-09-22T12:00:00Z',
    updated_at: '2026-09-22T12:00:00Z',
    deleted_at: null,
    version: 1,
    ...extra,
  };
}

function montar(fila: Necesidad = necesidad(), bloqueado = false) {
  if (HERRAJES === undefined) throw new Error('falta la lista de herrajes');
  const alTildar = vi.fn<(listo: boolean) => void>();
  const alEditar = vi.fn<(cambios: CambiosDeLaFila) => void>();
  const alQuitar = vi.fn<() => void>();
  render(
    <ul>
      <FilaDeNecesidad
        necesidad={fila}
        lista={HERRAJES}
        bloqueado={bloqueado}
        alTildar={alTildar}
        alEditar={alEditar}
        alQuitar={alQuitar}
      />
    </ul>,
  );
  return {
    alTildar,
    alEditar,
    alQuitar,
    cantidad: screen.getByRole('textbox', {
      name: 'Cantidad de Bisagras Cazoleta 35 Cierre Suave',
    }),
    nombre: screen.getByRole('textbox', { name: 'Nombre de Bisagras Cazoleta 35 Cierre Suave' }),
  };
}

function escribir(campo: HTMLElement, texto: string): void {
  fireEvent.focus(campo);
  fireEvent.change(campo, { target: { value: texto } });
}

describe('la cantidad se edita en la fila', () => {
  it('se guarda al salir del campo', () => {
    const { cantidad, alEditar } = montar();
    escribir(cantidad, '6');
    fireEvent.blur(cantidad);
    expect(alEditar).toHaveBeenCalledExactlyOnceWith({
      nombre: 'Bisagras Cazoleta 35 Cierre Suave',
      cantidad: 6,
    });
  });

  it('se guarda con Enter', () => {
    const { cantidad, alEditar } = montar();
    cantidad.focus();
    fireEvent.change(cantidad, { target: { value: '8' } });
    fireEvent.keyDown(cantidad, { key: 'Enter' });
    expect(alEditar).toHaveBeenCalledExactlyOnceWith({
      nombre: 'Bisagras Cazoleta 35 Cierre Suave',
      cantidad: 8,
    });
    expect(cantidad).not.toHaveFocus();
  });

  it('Escape cancela y vuelve a lo que había, sin guardar nada', () => {
    const { cantidad, alEditar } = montar();
    escribir(cantidad, '12');
    fireEvent.keyDown(cantidad, { key: 'Escape' });
    expect(cantidad).toHaveValue('4');
    fireEvent.blur(cantidad);
    expect(alEditar).not.toHaveBeenCalled();
    expect(cantidad).toHaveValue('4');
  });

  it('vacía vuelve al valor anterior: para sacar un ítem está el tacho', () => {
    const { cantidad, alEditar, alQuitar } = montar();
    escribir(cantidad, '');
    fireEvent.blur(cantidad);
    expect(alEditar).not.toHaveBeenCalled();
    expect(alQuitar).not.toHaveBeenCalled();
    expect(cantidad).toHaveValue('4');
  });

  it('en cero vuelve al valor anterior', () => {
    const { cantidad, alEditar } = montar();
    escribir(cantidad, '0');
    fireEvent.blur(cantidad);
    expect(alEditar).not.toHaveBeenCalled();
    expect(cantidad).toHaveValue('4');
  });

  it('solo entran cifras, y hasta tres', () => {
    const { cantidad } = montar();
    escribir(cantidad, '1a2b34');
    expect(cantidad).toHaveValue('123');
  });

  it('a lo que no tenía cantidad se le puede poner una', () => {
    const { cantidad, alEditar } = montar(necesidad({ cantidad: null }));
    expect(cantidad).toHaveValue('');
    escribir(cantidad, '2');
    fireEvent.blur(cantidad);
    expect(alEditar).toHaveBeenCalledWith({
      nombre: 'Bisagras Cazoleta 35 Cierre Suave',
      cantidad: 2,
    });
  });

  it('en el celular abre el teclado numérico', () => {
    const { cantidad } = montar();
    expect(cantidad).toHaveAttribute('inputmode', 'numeric');
    expect(cantidad).toHaveAttribute('pattern', '[0-9]*');
  });

  it('salir sin cambiar nada no guarda', () => {
    const { cantidad, alEditar } = montar();
    fireEvent.focus(cantidad);
    fireEvent.blur(cantidad);
    expect(alEditar).not.toHaveBeenCalled();
  });
});

describe('el nombre se edita con el mismo gesto', () => {
  it('se guarda recortado al salir del campo', () => {
    const { nombre, alEditar } = montar();
    escribir(nombre, '  Bisagras Cazoleta 35 Cierre Suave Blum ');
    fireEvent.blur(nombre);
    expect(alEditar).toHaveBeenCalledExactlyOnceWith({
      nombre: 'Bisagras Cazoleta 35 Cierre Suave Blum',
      cantidad: 4,
    });
  });

  it('Enter guarda y no agrega un salto de línea', () => {
    const { nombre, alEditar } = montar();
    nombre.focus();
    fireEvent.change(nombre, { target: { value: 'Bisagras rectas' } });
    const enter = fireEvent.keyDown(nombre, { key: 'Enter' });
    expect(enter).toBe(false);
    expect(alEditar).toHaveBeenCalledWith({ nombre: 'Bisagras rectas', cantidad: 4 });
  });

  it('no puede quedar vacío: en blanco vuelve al de antes', () => {
    const { nombre, alEditar } = montar();
    escribir(nombre, '   ');
    fireEvent.blur(nombre);
    expect(alEditar).not.toHaveBeenCalled();
    expect(nombre).toHaveValue('Bisagras Cazoleta 35 Cierre Suave');
  });

  it('lo que pasa del largo máximo se recorta', () => {
    const { nombre, alEditar } = montar();
    expect(nombre).toHaveAttribute('maxlength', String(LARGO_MAXIMO_DEL_NOMBRE));
    escribir(nombre, 'b'.repeat(LARGO_MAXIMO_DEL_NOMBRE + 30));
    fireEvent.blur(nombre);
    expect(alEditar).toHaveBeenCalledWith({
      nombre: 'b'.repeat(LARGO_MAXIMO_DEL_NOMBRE),
      cantidad: 4,
    });
  });

  it('un salto de línea pegado queda como espacio', () => {
    const { nombre } = montar();
    escribir(nombre, 'Bisagras\nrectas');
    expect(nombre).toHaveValue('Bisagras rectas');
  });

  it('Escape cancela también acá', () => {
    const { nombre, alEditar } = montar();
    escribir(nombre, 'Otra cosa');
    fireEvent.keyDown(nombre, { key: 'Escape' });
    fireEvent.blur(nombre);
    expect(alEditar).not.toHaveBeenCalled();
    expect(nombre).toHaveValue('Bisagras Cazoleta 35 Cierre Suave');
  });
});

describe('editar no toca lo demás de la fila', () => {
  it('ni tilda ni destilda', () => {
    const { cantidad, nombre, alTildar } = montar(necesidad({ listo: true }));
    escribir(cantidad, '6');
    fireEvent.blur(cantidad);
    escribir(nombre, 'Bisagras');
    fireEvent.blur(nombre);
    expect(alTildar).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('el casillero sigue tildando y el tacho sigue sacando', () => {
    const { alTildar, alQuitar } = montar();
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Listo: 4 Bisagras Cazoleta 35 Cierre Suave' }),
    );
    expect(alTildar).toHaveBeenCalledWith(true);
    fireEvent.click(
      screen.getByRole('button', { name: 'Sacar 4 Bisagras Cazoleta 35 Cierre Suave de la lista' }),
    );
    expect(alQuitar).toHaveBeenCalledOnce();
  });

  it('lo tildado se ve tachado también en los campos', () => {
    const { cantidad, nombre } = montar(necesidad({ listo: true }));
    expect(cantidad).toHaveClass('line-through');
    expect(nombre).toHaveClass('line-through');
  });
});

describe('la fila con teclado y lector de pantalla', () => {
  it('se recorre entera y en orden: casillero, cantidad, nombre y tacho', () => {
    montar();
    const fila = screen.getByRole('listitem');
    const enfocables = [...fila.querySelectorAll<HTMLElement>('input, textarea, button')];
    expect(enfocables.map((elemento) => elemento.getAttribute('aria-label'))).toEqual([
      'Listo: 4 Bisagras Cazoleta 35 Cierre Suave',
      'Cantidad de Bisagras Cazoleta 35 Cierre Suave',
      'Nombre de Bisagras Cazoleta 35 Cierre Suave',
      'Sacar 4 Bisagras Cazoleta 35 Cierre Suave de la lista',
    ]);
    expect(enfocables.every((elemento) => elemento.tabIndex === 0)).toBe(true);
  });

  it('la copia que da el alto al nombre no la lee el lector', () => {
    montar();
    const copia = within(screen.getByRole('listitem'))
      .getAllByText('Bisagras Cazoleta 35 Cierre Suave')
      .filter((elemento) => elemento.tagName === 'SPAN');
    expect(copia).toHaveLength(1);
    expect(copia[0]).toHaveAttribute('aria-hidden', 'true');
  });

  it('en un trabajo cerrado los campos se leen pero no se editan', () => {
    const { cantidad, nombre } = montar(necesidad(), true);
    expect(cantidad).toHaveAttribute('readonly');
    expect(nombre).toHaveAttribute('readonly');
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });
});
