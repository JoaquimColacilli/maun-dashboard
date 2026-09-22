import { describe, expect, it } from 'vitest';

import { PREFIJO_DE_LA_ENCUESTA_PUBLICA, PREFIJO_DE_LA_VISTA_PUBLICA } from '@/shared/lib';

import HTML from '../../index.html?raw';
import WORKER from '../../sw/sw.ts?raw';

function comoRegex(prefijo: string): string {
  return prefijo.replaceAll('/', String.raw`\/`);
}

describe('los prefijos de las páginas públicas no pueden divergir', () => {
  it('el arranque del documento reconoce la vista y la encuesta con los mismos prefijos', () => {
    expect(HTML).toContain(`location.pathname.indexOf('${PREFIJO_DE_LA_VISTA_PUBLICA}') === 0`);
    expect(HTML).toContain(`location.pathname.indexOf('${PREFIJO_DE_LA_ENCUESTA_PUBLICA}') === 0`);
  });

  it('el service worker las saca del respaldo de navegación con los mismos prefijos', () => {
    expect(WORKER).toContain(`const VISTA_PUBLICA = /^${comoRegex(PREFIJO_DE_LA_VISTA_PUBLICA)}/;`);
    expect(WORKER).toContain(
      `const ENCUESTA_PUBLICA = /^${comoRegex(PREFIJO_DE_LA_ENCUESTA_PUBLICA)}/;`,
    );
    expect(WORKER).toContain('denylist: [VISTA_PUBLICA, ENCUESTA_PUBLICA]');
  });
});

describe('el arranque del documento marca la página pública antes de que monte React', () => {
  it('pone la marca en el html, que es de lo que cuelga el desanclaje de la raíz', () => {
    expect(HTML).toContain(`document.documentElement.dataset.vista = 'publica'`);
  });

  it('le saca el manifiesto: el cliente no tiene por qué bajarse la app del taller', () => {
    expect(HTML).toContain(`link[rel="manifest"]`);
  });
});
