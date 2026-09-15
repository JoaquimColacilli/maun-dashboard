import { describe, expect, it } from 'vitest';

import { NOVEDADES } from './novedades';
import { compararVersiones, partesDeLaVersion } from './version';

const LINEAS_POR_VERSION = 4;
const LARGO_DE_UNA_LINEA = 200;

const PALABRAS_QUE_NO_VAN = [
  'ia',
  'inteligencia artificial',
  'claude',
  'anthropic',
  'openai',
  'chatgpt',
  'gpt',
  'copilot',
  'supabase',
  'postgres',
  'bucket',
  'migración',
  'base de datos',
  'réplica',
  'react',
  'vite',
  'pnpm',
  'npm',
  'commit',
  'pull request',
  'deploy',
  'netlify',
  'refactor',
  'gracias',
];

function contiene(texto: string, palabra: string): boolean {
  const escapada = palabra.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}])${escapada}($|[^\\p{L}])`, 'iu').test(texto);
}

describe('el archivo de novedades', () => {
  it('tiene al menos una versión', () => {
    expect(NOVEDADES.length).toBeGreaterThan(0);
  });

  it('cada versión es una fecha real, con un número si hay otra el mismo día, y van de la más nueva a la más vieja', () => {
    for (const novedad of NOVEDADES) {
      expect(partesDeLaVersion(novedad.version), novedad.version).not.toBeNull();
    }
    for (let indice = 1; indice < NOVEDADES.length; indice += 1) {
      const anterior = NOVEDADES[indice - 1]?.version ?? '';
      const esta = NOVEDADES[indice]?.version ?? '';
      expect(compararVersiones(anterior, esta), `${anterior} antes que ${esta}`).toBeGreaterThan(0);
    }
  });

  it('cada versión dice de una a cuatro cosas, cortas y terminadas en punto', () => {
    for (const novedad of NOVEDADES) {
      expect(novedad.lineas.length, novedad.version).toBeGreaterThan(0);
      expect(novedad.lineas.length, novedad.version).toBeLessThanOrEqual(LINEAS_POR_VERSION);
      for (const linea of novedad.lineas) {
        expect(linea.length, linea).toBeLessThanOrEqual(LARGO_DE_UNA_LINEA);
        expect(linea, linea).toMatch(/\.$/);
        expect(linea, linea).toBe(linea.trim());
      }
    }
  });

  it('está escrito para quien usa la app: sin emojis, sin nombres técnicos y sin mencionar a una IA', () => {
    for (const linea of NOVEDADES.flatMap((novedad) => novedad.lineas)) {
      expect(linea, linea).not.toMatch(/\p{Extended_Pictographic}/u);
      for (const palabra of PALABRAS_QUE_NO_VAN) {
        expect(contiene(linea, palabra), `«${palabra}» en: ${linea}`).toBe(false);
      }
    }
  });

  it('el control de palabras encuentra la palabra suelta y no adentro de otra', () => {
    expect(contiene('Lo hizo una IA.', 'ia')).toBe(true);
    expect(contiene('La familia y el día.', 'ia')).toBe(false);
    expect(contiene('Se agregó una migración.', 'migración')).toBe(true);
  });
});
