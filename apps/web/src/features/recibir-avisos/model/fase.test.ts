import { describe, expect, it } from 'vitest';

import type { EstadoDeLosAvisos, ServidorDeAvisos } from '@/shared/api';

import { faseDeLosAvisos, type EsteDispositivo } from './fase';

const CON_CLAVES: ServidorDeAvisos = { configurado: true, clavePublica: 'BCla' };
const SIN_CLAVES: ServidorDeAvisos = { configurado: false, clavePublica: null };

const SUSCRIPTO: EstadoDeLosAvisos = {
  suscripto: true,
  ultimoEnvio: null,
  dispositivos: 1,
  preferencias: null,
};
const SIN_SUSCRIBIR: EstadoDeLosAvisos = { ...SUSCRIPTO, suscripto: false, dispositivos: 0 };

const PC: EsteDispositivo = {
  soportado: true,
  iphone: false,
  comoApp: false,
  permiso: 'default',
  endpoint: null,
};

describe('faseDeLosAvisos', () => {
  it('sin claves en el servidor lo dice antes que cualquier otra cosa', () => {
    expect(faseDeLosAvisos({ ...PC, iphone: true }, SIN_CLAVES, SIN_SUSCRIBIR)).toBe('sin-claves');
  });

  it('en el iPhone abierto desde Safari pide agregarla a inicio', () => {
    expect(
      faseDeLosAvisos(
        { ...PC, iphone: true, soportado: false, permiso: null },
        CON_CLAVES,
        SIN_SUSCRIBIR,
      ),
    ).toBe('sin-instalar');
  });

  it('en el iPhone ya agregada a inicio sigue como en cualquier otro', () => {
    expect(faseDeLosAvisos({ ...PC, iphone: true, comoApp: true }, CON_CLAVES, SIN_SUSCRIBIR)).toBe(
      'sin-pedir',
    );
  });

  it('un navegador sin push no puede recibirlos', () => {
    expect(faseDeLosAvisos({ ...PC, soportado: false }, CON_CLAVES, SIN_SUSCRIBIR)).toBe(
      'sin-soporte',
    );
    expect(faseDeLosAvisos({ ...PC, permiso: null }, CON_CLAVES, SIN_SUSCRIBIR)).toBe(
      'sin-soporte',
    );
  });

  it('con el permiso negado explica cómo habilitarlo', () => {
    expect(faseDeLosAvisos({ ...PC, permiso: 'denied' }, CON_CLAVES, SUSCRIPTO)).toBe('denegado');
  });

  it('sin preguntar todavía ofrece activarlos', () => {
    expect(faseDeLosAvisos(PC, CON_CLAVES, SIN_SUSCRIBIR)).toBe('sin-pedir');
  });

  it('activos solo si hay permiso, suscripción en el navegador y fila en la base', () => {
    const suscripto = { ...PC, permiso: 'granted', endpoint: 'https://push.example/1' } as const;
    expect(faseDeLosAvisos(suscripto, CON_CLAVES, SUSCRIPTO)).toBe('activos');
    expect(faseDeLosAvisos(suscripto, CON_CLAVES, SIN_SUSCRIBIR)).toBe('sin-pedir');
    expect(faseDeLosAvisos({ ...suscripto, endpoint: null }, CON_CLAVES, SUSCRIPTO)).toBe(
      'sin-pedir',
    );
  });
});
