import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { chromium, expect, test, type BrowserContext, type Page } from '@playwright/test';

import {
  abrirLaVersionA,
  aviso,
  conElArnes,
  entrarConLaSesion,
  HASTA_EL_AVISO,
  momentoDelAviso,
  tallerVacio,
} from './apoyo';

test.skip(({ isMobile }) => isMobile, 'la ventana de app se abre en la compu');

const elArnes = conElArnes();

function abrirComoApp(perfil: string, origen: string): Promise<BrowserContext> {
  return chromium.launchPersistentContext(perfil, {
    channel: 'chromium',
    headless: true,
    args: [`--app=${origen}/`],
    viewport: { width: 1280, height: 800 },
  });
}

async function laVentana(app: BrowserContext): Promise<Page> {
  return app.pages()[0] ?? (await app.waitForEvent('page'));
}

test('en la app instalada, abrirla con una versión nueva publicada muestra el aviso', async ({
  browserName,
}, testInfo) => {
  test.skip(browserName !== 'chromium', 'la ventana de app es de Chromium');
  test.setTimeout(90_000);
  const arnes = elArnes();
  const perfil = mkdtempSync(path.join(tmpdir(), 'maun-app-instalada-'));
  try {
    const primera = await abrirComoApp(perfil, arnes.origen);
    try {
      await entrarConLaSesion(primera, await tallerVacio());
      const ventana = await laVentana(primera);
      expect(await ventana.evaluate(() => matchMedia('(display-mode: standalone)').matches)).toBe(
        true,
      );
      await abrirLaVersionA(ventana, arnes);
    } finally {
      await primera.close();
    }

    arnes.publicar('b');
    const segunda = await abrirComoApp(perfil, arnes.origen);
    try {
      const ventana = await laVentana(segunda);
      const tardo = await momentoDelAviso(ventana);
      await expect(aviso(ventana)).toBeVisible(HASTA_EL_AVISO);
      console.log(
        `${testInfo.project.name}: en la app instalada, el aviso apareció a los ${String(tardo)} ms de empezar a abrirla`,
      );
    } finally {
      await segunda.close();
    }
  } finally {
    rmSync(perfil, { recursive: true, force: true });
  }
});
