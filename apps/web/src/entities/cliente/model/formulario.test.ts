import { describe, expect, it } from 'vitest';

import {
  advertenciaDeCuit,
  cambiosDeCliente,
  CLIENTE_EN_BLANCO,
  datosDelFormulario,
  esquemaDeCliente,
  valoresDelFormulario,
} from './formulario';

function conNombre(extra: Record<string, unknown> = {}) {
  return { ...CLIENTE_EN_BLANCO, nombre: 'Ana Gómez', ...extra };
}

describe('esquemaDeCliente', () => {
  it('con el nombre solo alcanza para guardar', () => {
    expect(esquemaDeCliente.safeParse(conNombre()).success).toBe(true);
  });

  it('el nombre es lo único obligatorio', () => {
    const resultado = esquemaDeCliente.safeParse({ ...CLIENTE_EN_BLANCO, nombre: '   ' });
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.message).toBe('El nombre es lo único que no puede faltar.');
  });

  it('frena un CUIT a medias, porque la base lo rechazaría y taparía la cola', () => {
    expect(esquemaDeCliente.safeParse(conNombre({ cuit: '20-1234' })).success).toBe(false);
  });

  it('deja guardar un CUIT completo aunque el verificador no cierre', () => {
    expect(esquemaDeCliente.safeParse(conNombre({ cuit: '20-12345678-0' })).success).toBe(true);
  });

  it('frena un mail mal escrito, que también es un check de la base', () => {
    expect(esquemaDeCliente.safeParse(conNombre({ email: 'ana@taller' })).success).toBe(false);
    expect(esquemaDeCliente.safeParse(conNombre({ email: '' })).success).toBe(true);
  });

  it('corta lo que pasa del largo que aguanta la columna', () => {
    expect(esquemaDeCliente.safeParse(conNombre({ zona: 'z'.repeat(201) })).success).toBe(false);
    expect(esquemaDeCliente.safeParse(conNombre({ direccion: 'd'.repeat(501) })).success).toBe(
      false,
    );
  });

  it('recorta los espacios de los bordes', () => {
    const resultado = esquemaDeCliente.safeParse(conNombre({ nombre: '  Ana Gómez  ' }));
    expect(resultado.data?.nombre).toBe('Ana Gómez');
  });
});

describe('advertenciaDeCuit', () => {
  it('no dice nada si está bien o si está vacío', () => {
    expect(advertenciaDeCuit('')).toBeUndefined();
    expect(advertenciaDeCuit('20-12345678-6')).toBeUndefined();
  });

  it('avisa del prefijo, del verificador y del caso ambiguo, sin bloquear', () => {
    expect(advertenciaDeCuit('21-12345678-4')).toContain('20, 23, 24, 27, 30, 33 o 34');
    expect(advertenciaDeCuit('20-12345678-0')).toContain('verificador no cierra');
    expect(advertenciaDeCuit('20-00000001-9')).toContain('no tiene convención única');
  });
});

describe('datosDelFormulario', () => {
  it('deja el CUIT con el formato que exige la base', () => {
    expect(datosDelFormulario(conNombre({ cuit: '20123456786' })).cuit).toBe('20-12345678-6');
    expect(datosDelFormulario(conNombre()).cuit).toBe('');
  });
});

describe('cambiosDeCliente', () => {
  it('manda solo lo que cambió, no la fila entera', () => {
    const antes = conNombre({ zona: 'Olivos', telefono: '11 5555-5555' });
    const ahora = { ...antes, zona: 'Martínez' };
    expect(cambiosDeCliente(antes, ahora)).toEqual({ zona: 'Martínez' });
  });

  it('sin cambios no manda nada', () => {
    expect(cambiosDeCliente(conNombre(), conNombre())).toEqual({});
  });

  it('los enums cambian como los demás campos', () => {
    const antes = conNombre();
    const ahora = conNombre({ condicion_fiscal: 'monotributo', origen_contacto: 'referido' });
    expect(cambiosDeCliente(antes, ahora)).toEqual({
      condicion_fiscal: 'monotributo',
      origen_contacto: 'referido',
    });
  });
});

describe('valoresDelFormulario', () => {
  it('sin cliente arranca en blanco', () => {
    expect(valoresDelFormulario(undefined)).toEqual(CLIENTE_EN_BLANCO);
  });

  it('con cliente trae solo las columnas que el formulario escribe', () => {
    const valores = valoresDelFormulario({
      ...conNombre({ zona: 'Olivos' }),
      id: 'x',
      household_id: 'h',
      created_at: '',
      updated_at: '',
      deleted_at: null,
      version: 3,
    });
    expect(valores).toEqual({ ...CLIENTE_EN_BLANCO, nombre: 'Ana Gómez', zona: 'Olivos' });
  });
});
