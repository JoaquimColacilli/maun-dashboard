import { beforeEach, describe, expect, it } from 'vitest';

import type { Archivo } from '@/entities/archivo';
import type { Enlace } from '@/entities/enlace';
import { olvidarLosTokens, recordarToken } from '@/shared/lib';

import {
  comoSeVeElEnlace,
  cuantosVeElCliente,
  enlaceDeWhatsapp,
  mensajeParaElCliente,
} from './compartir';

function enlace(id: string, token: string | null = null): Enlace {
  return {
    id,
    household_id: 'h',
    proyecto_id: 'p',
    token_hash: 'a'.repeat(64),
    token,
    revocado_at: null,
    visitas: 0,
    ultima_visita_at: null,
    created_at: '2026-09-18T12:00:00Z',
    updated_at: '2026-09-18T12:00:00Z',
    deleted_at: null,
    version: 1,
  };
}

function archivo(id: string, visible: boolean): Archivo {
  return {
    id,
    household_id: 'h',
    proyecto_id: 'p',
    nombre: `${id}.pdf`,
    tipo: 'application/pdf',
    bytes: 1_000,
    ancho: null,
    alto: null,
    visible_para_cliente: visible,
    created_at: '2026-09-18T12:00:00Z',
    updated_at: '2026-09-18T12:00:00Z',
    deleted_at: null,
    version: 1,
  };
}

describe('cómo se ve el enlace del lado del dueño', () => {
  beforeEach(() => {
    olvidarLosTokens();
  });

  it('sin ningún enlace, ofrece crearlo', () => {
    expect(comoSeVeElEnlace(undefined, false)).toEqual({ como: 'sin_enlace' });
  });

  it('con uno que se dio de baja, lo dice', () => {
    expect(comoSeVeElEnlace(undefined, true)).toEqual({ como: 'de_baja' });
  });

  it('con la dirección en la fila, la muestra en cualquier aparato sin nada guardado de este lado', () => {
    expect(comoSeVeElEnlace(enlace('e1', 'el-token'), true)).toEqual({
      como: 'activo',
      url: `${globalThis.location.origin}/v/el-token`,
      aRellenar: null,
    });
  });

  it('la fila manda por encima de lo que haya quedado guardado en este aparato', () => {
    recordarToken('e1', 'el-viejo');
    expect(comoSeVeElEnlace(enlace('e1', 'el-de-la-fila'), true)).toEqual({
      como: 'activo',
      url: `${globalThis.location.origin}/v/el-de-la-fila`,
      aRellenar: null,
    });
  });

  it('un enlace de los de antes se arma con lo guardado acá, y pide que se rellene la fila', () => {
    recordarToken('e1', 'el-token');
    expect(comoSeVeElEnlace(enlace('e1'), true)).toEqual({
      como: 'activo',
      url: `${globalThis.location.origin}/v/el-token`,
      aRellenar: 'el-token',
    });
  });

  it('un enlace de los de antes, desde otro aparato, sigue activo pero sin dirección', () => {
    expect(comoSeVeElEnlace(enlace('e1'), true)).toEqual({ como: 'activo_sin_la_direccion' });
  });
});

describe('el mensaje para el cliente', () => {
  it('lo saluda por el nombre y le manda la dirección', () => {
    expect(mensajeParaElCliente('Marcela Duarte', 'Placard 3 puertas', 'https://m/v/t')).toBe(
      'Hola Marcela, acá podés ver cómo va tu placard 3 puertas: https://m/v/t',
    );
  });

  it('sin nombre saluda igual', () => {
    expect(mensajeParaElCliente('  ', 'Mesada', 'https://m/v/t')).toContain('Hola, acá podés ver');
  });

  it('con un pago pendiente, también le dice que ahí ve cómo pagarlo', () => {
    expect(mensajeParaElCliente('Marcela', 'Placard', 'https://m/v/t', true)).toBe(
      'Hola Marcela, acá podés ver cómo va y cómo pagarlo tu placard: https://m/v/t',
    );
  });

  it('con todo pagado, el mensaje es el de siempre', () => {
    expect(mensajeParaElCliente('Marcela', 'Placard', 'https://m/v/t', false)).toBe(
      'Hola Marcela, acá podés ver cómo va tu placard: https://m/v/t',
    );
  });

  it('con teléfono abre el chat de esa persona, y sin teléfono deja elegir a quién', () => {
    expect(enlaceDeWhatsapp('+54 9 11 4088-2210', 'hola')).toBe(
      'https://wa.me/5491140882210?text=hola',
    );
    expect(enlaceDeWhatsapp('', 'hola')).toBe('https://wa.me/?text=hola');
  });
});

describe('cuántos archivos ve', () => {
  it('cuenta los marcados sobre el total', () => {
    expect(cuantosVeElCliente([archivo('a', true), archivo('b', false), archivo('c', true)])).toBe(
      '2 de 3 compartidos',
    );
    expect(cuantosVeElCliente([])).toBe('0 de 0 compartidos');
  });
});
