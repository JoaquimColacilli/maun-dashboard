import { describe, expect, it } from 'vitest';

import { esVueltaPorUnAviso, rutaDelAviso, VUELTA_POR_UN_AVISO } from './vuelta-por-un-aviso';

const ORIGEN = 'https://numa-dashboard.netlify.app';

describe('esVueltaPorUnAviso', () => {
  it('reconoce el mensaje que manda el service worker al tocar un aviso', () => {
    expect(esVueltaPorUnAviso({ type: VUELTA_POR_UN_AVISO, url: `${ORIGEN}/agenda` })).toBe(true);
  });

  it.each([
    null,
    'MAUN_VUELTA_POR_UN_AVISO',
    { type: 'SKIP_WAITING' },
    { type: VUELTA_POR_UN_AVISO },
    { type: VUELTA_POR_UN_AVISO, url: 3 },
  ])('ignora cualquier otro mensaje: %j', (datos) => {
    expect(esVueltaPorUnAviso(datos)).toBe(false);
  });
});

describe('rutaDelAviso', () => {
  it('lleva a la ruta de la app, con su búsqueda', () => {
    expect(rutaDelAviso(`${ORIGEN}/agenda?dia=2026-09-15`, ORIGEN)).toBe('/agenda?dia=2026-09-15');
    expect(rutaDelAviso('/ajustes/avisos', ORIGEN)).toBe('/ajustes/avisos');
  });

  it('nunca navega fuera de la app', () => {
    expect(rutaDelAviso('https://otro.example/agenda', ORIGEN)).toBeNull();
    expect(rutaDelAviso('http://[', ORIGEN)).toBeNull();
  });
});
