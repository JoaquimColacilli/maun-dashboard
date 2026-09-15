import { describe, expect, it } from 'vitest';

import {
  anticipacionesDe,
  avisoDeLaPrueba,
  cuandoSalio,
  esHora,
  otrosDispositivos,
  pasosParaDesbloquear,
} from './textos';

const AHORA = new Date(2026, 8, 14, 9, 0);

describe('cuandoSalio', () => {
  it('sin envíos todavía lo dice', () => {
    expect(cuandoSalio(null, AHORA)).toBe('Todavía no salió ninguno.');
    expect(cuandoSalio('no es una fecha', AHORA)).toBe('Todavía no salió ninguno.');
  });

  it('dice hoy, ayer o el día con la hora local', () => {
    expect(cuandoSalio(new Date(2026, 8, 14, 7, 31).toISOString(), AHORA)).toBe(
      'El último salió hoy a las 07:31.',
    );
    expect(cuandoSalio(new Date(2026, 8, 13, 7, 30).toISOString(), AHORA)).toBe(
      'El último salió ayer a las 07:30.',
    );
    expect(cuandoSalio(new Date(2026, 8, 10, 20, 5).toISOString(), AHORA)).toBe(
      'El último salió el jue 10 sep a las 20:05.',
    );
  });
});

describe('otrosDispositivos', () => {
  it('cuenta los demás dispositivos de la persona', () => {
    expect(otrosDispositivos(0)).toBe('');
    expect(otrosDispositivos(1)).toBe('');
    expect(otrosDispositivos(2)).toBe(' También llegan a otro dispositivo tuyo.');
    expect(otrosDispositivos(4)).toBe(' También llegan a otros 3 dispositivos tuyos.');
  });
});

describe('anticipacionesDe', () => {
  it('las anotaciones se avisan el día o el anterior', () => {
    expect(anticipacionesDe('anotaciones', 0)).toEqual([0, 1]);
    expect(anticipacionesDe('entregas', 2)).toEqual([0, 1, 2, 3]);
  });

  it('una anticipación guardada fuera de las opciones se sigue viendo', () => {
    expect(anticipacionesDe('anotaciones', 3)).toEqual([0, 1, 3]);
  });
});

describe('esHora', () => {
  it('acepta horas de reloj de 24 horas', () => {
    expect(esHora('07:30')).toBe(true);
    expect(esHora('23:59')).toBe(true);
    expect(esHora('24:00')).toBe(false);
    expect(esHora('7:30')).toBe(false);
    expect(esHora('')).toBe(false);
  });
});

describe('avisoDeLaPrueba', () => {
  const BASE = { configurado: true, mandados: 0, podados: 0, fallidos: 0 };

  it('dice qué pasó con la prueba', () => {
    expect(avisoDeLaPrueba({ ...BASE, mandados: 1 }).tono).toBe('hecho');
    expect(avisoDeLaPrueba({ ...BASE, podados: 1 }).texto).toMatch(/Activalos de nuevo/);
    expect(avisoDeLaPrueba({ ...BASE, fallidos: 1 }).texto).toMatch(/no respondió/);
    expect(avisoDeLaPrueba({ ...BASE, configurado: false }).texto).toMatch(/todavía no puede/);
  });
});

describe('pasosParaDesbloquear', () => {
  it('instalada, se habilita desde los ajustes del teléfono; en el navegador, desde la página', () => {
    expect(pasosParaDesbloquear(true)[0]).toBe('Abrí los ajustes del teléfono.');
    expect(pasosParaDesbloquear(false)[1]).toBe('Buscá «Notificaciones» y ponelo en permitir.');
  });
});
