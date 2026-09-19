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

function enlace(id: string): Enlace {
  return {
    id,
    household_id: 'h',
    proyecto_id: 'p',
    token_hash: 'a'.repeat(64),
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

  it('con el token guardado en este dispositivo, arma la dirección', () => {
    recordarToken('e1', 'el-token');
    expect(comoSeVeElEnlace(enlace('e1'), true)).toEqual({
      como: 'activo',
      url: `${globalThis.location.origin}/v/el-token`,
    });
  });

  it('desde otro dispositivo el enlace sigue activo, pero la dirección no está: solo se guardó su huella', () => {
    expect(comoSeVeElEnlace(enlace('e1'), true)).toEqual({ como: 'activo_en_otro_dispositivo' });
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
