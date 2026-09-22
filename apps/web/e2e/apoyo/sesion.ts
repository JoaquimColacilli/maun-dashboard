import type { BrowserContext } from '@playwright/test';

import type { SesionDePrueba } from './taller';

const VISTA_ANTES_DE_LA_A = '2099-12-30';

export async function entrarConLaSesion(
  context: BrowserContext,
  sesion: SesionDePrueba,
): Promise<void> {
  await context.addInitScript(
    ({ guardada, vista }) => {
      if (localStorage.getItem('maun.sesion') === null) {
        localStorage.setItem('maun.sesion', guardada);
      }
      if (localStorage.getItem('maun:novedades-vistas') === null) {
        localStorage.setItem('maun:novedades-vistas', vista);
      }
    },
    { guardada: sesion.guardada, vista: VISTA_ANTES_DE_LA_A },
  );
}
