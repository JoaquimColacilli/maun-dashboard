import { describe, expect, it } from 'vitest';

import { PREFIJO_DE_LA_VISTA_PUBLICA } from '@/shared/lib';

import HTML from '../../index.html?raw';
import WORKER from '../../sw/sw.ts?raw';

describe('el prefijo de la vista pública no puede divergir', () => {
  it('el arranque del documento la reconoce con el mismo prefijo', () => {
    expect(HTML).toContain(`location.pathname.indexOf('${PREFIJO_DE_LA_VISTA_PUBLICA}') === 0`);
  });

  it('el service worker la saca del respaldo de navegación con el mismo prefijo', () => {
    const escapado = PREFIJO_DE_LA_VISTA_PUBLICA.replaceAll('/', String.raw`\/`);
    expect(WORKER).toContain(`const VISTA_PUBLICA = /^${escapado}/;`);
    expect(WORKER).toContain('denylist: [VISTA_PUBLICA]');
  });
});

describe('el arranque del documento marca la vista pública antes de que monte React', () => {
  it('pone la marca en el html, que es de lo que cuelga el desanclaje de la raíz', () => {
    expect(HTML).toContain(`document.documentElement.dataset.vista = 'publica'`);
  });

  it('le saca el manifiesto: el cliente no tiene por qué bajarse la app del taller', () => {
    expect(HTML).toContain(`link[rel="manifest"]`);
  });
});
