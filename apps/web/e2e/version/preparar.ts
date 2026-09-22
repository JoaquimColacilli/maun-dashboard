import path from 'node:path';

import { build, type Plugin } from 'vite';

import { RAIZ_DE_LA_APP } from '../apoyo/entorno';
import { BUILD_A, BUILD_B, NOVEDAD_DE_LA_B, VERSION_DE_LA_B } from './arnes';

const ARCHIVO_DE_NOVEDADES = '/src/features/ver-novedades/model/novedades.ts';

const COMIENZO_DE_LAS_NOVEDADES = 'export const NOVEDADES: readonly Novedad[] = [';

function unaNovedadMas(): Plugin {
  return {
    name: 'arnes:una-novedad-mas',
    enforce: 'pre',
    transform(codigo, id) {
      if (!id.replaceAll('\\', '/').endsWith(ARCHIVO_DE_NOVEDADES)) return null;
      if (!codigo.includes(COMIENZO_DE_LAS_NOVEDADES)) {
        throw new Error(`El arnés no encontró «${COMIENZO_DE_LAS_NOVEDADES}» en novedades.ts.`);
      }
      return codigo.replace(
        COMIENZO_DE_LAS_NOVEDADES,
        `${COMIENZO_DE_LAS_NOVEDADES}\n  { version: '${VERSION_DE_LA_B}', lineas: ['${NOVEDAD_DE_LA_B}'] },`,
      );
    },
  };
}

async function construir(destino: string, plugins: Plugin[] = []): Promise<void> {
  await build({
    root: RAIZ_DE_LA_APP,
    configFile: path.join(RAIZ_DE_LA_APP, 'vite.config.ts'),
    logLevel: 'warn',
    plugins,
    build: { outDir: destino, emptyOutDir: true },
  });
}

export default async function preparar(): Promise<void> {
  await construir(BUILD_A);
  await construir(BUILD_B, [unaNovedadMas()]);
}
