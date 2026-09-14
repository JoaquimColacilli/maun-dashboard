import { describe, expect, it } from 'vitest';

import { seActualizaTirando } from './pantallas-que-se-actualizan';

const ID = '5eed0000-0000-7000-8000-000000000001';

describe('seActualizaTirando', () => {
  it('las pantallas que leen de la réplica tienen el gesto', () => {
    for (const ruta of ['/', '/seguimiento', '/proyectos', '/clientes', '/finanzas', '/diezmo']) {
      expect(seActualizaTirando(ruta), ruta).toBe(true);
    }
  });

  it('las fichas de proyecto, de contacto y de cliente también', () => {
    expect(seActualizaTirando(`/proyectos/${ID}`)).toBe(true);
    expect(seActualizaTirando(`/clientes/${ID}`)).toBe(true);
  });

  it('los formularios de pantalla completa, el cobro, el pasaje y Ajustes no', () => {
    for (const ruta of [
      '/proyectos/nuevo',
      `/proyectos/${ID}/editar`,
      `/proyectos/${ID}/aprobar`,
      `/proyectos/${ID}/cobrar`,
      `/proyectos/${ID}/cerrar`,
      '/ajustes',
    ]) {
      expect(seActualizaTirando(ruta), ruta).toBe(false);
    }
  });

  it('una ruta de hoja no es una pantalla con el gesto', () => {
    expect(seActualizaTirando('/finanzas/nuevo')).toBe(false);
    expect(seActualizaTirando(`/finanzas/${ID}`)).toBe(false);
    expect(seActualizaTirando('/seguimiento/nuevo')).toBe(false);
  });
});
