import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { chromium, type Page } from '@playwright/test';

import { ICONOS, icoConUnPng, LADO_DEL_FAVICON, svgDelIcono, svgDeNuma } from './iconos/dibujo.ts';

const PUBLICO = fileURLToPath(new URL('../public/', import.meta.url));

async function aPng(pagina: Page, svg: string, lado: number): Promise<Buffer> {
  await pagina.setViewportSize({ width: lado, height: lado });
  await pagina.setContent(
    `<!doctype html><html><head><style>html,body{margin:0;background:transparent}svg{display:block;width:${String(lado)}px;height:${String(lado)}px}</style></head><body>${svg}</body></html>`,
  );
  return pagina.screenshot({
    omitBackground: true,
    clip: { x: 0, y: 0, width: lado, height: lado },
  });
}

function escribir(archivo: string, contenido: string | Uint8Array): void {
  writeFileSync(`${PUBLICO}${archivo}`, contenido);
  console.log(`public/${archivo}`);
}

const navegador = await chromium.launch();
try {
  const contexto = await navegador.newContext({ deviceScaleFactor: 1, colorScheme: 'light' });
  const pagina = await contexto.newPage();

  const numa = svgDeNuma();
  escribir('numa.svg', numa);

  const favicon = await aPng(pagina, numa, LADO_DEL_FAVICON);
  escribir('favicon.ico', icoConUnPng(favicon, LADO_DEL_FAVICON));

  for (const icono of ICONOS) {
    escribir(icono.archivo, await aPng(pagina, svgDelIcono(icono), icono.lado));
  }
} finally {
  await navegador.close();
}
