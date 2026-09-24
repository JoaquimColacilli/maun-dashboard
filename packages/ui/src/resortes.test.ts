import { describe, expect, it } from 'vitest';

import {
  curvaDelResorte,
  duracionesSinMovimiento,
  MARCAS_DE_LOS_RESORTES,
  milisegundosDeAsiento,
  posicionDelResorte,
  reboteDelResorte,
  RESORTES,
  sinEspacios,
  textoEntreMarcas,
  tokensDeLosResortes,
} from './resortes.ts';
import tema from './styles/theme.css?raw';

describe('los resortes de Material 3', () => {
  it('asientan a un milésimo en los tiempos del esquema estándar', () => {
    expect(milisegundosDeAsiento(RESORTES.espacial)).toBe(317);
    expect(milisegundosDeAsiento(RESORTES['espacial-lento'])).toBe(484);
    expect(milisegundosDeAsiento(RESORTES.efectos)).toBe(231);
    expect(milisegundosDeAsiento(RESORTES['efectos-rapidos'])).toBe(150);
    expect(milisegundosDeAsiento(RESORTES['expresivo-rapido'])).toBe(359);
  });

  it('el espacial pasa menos de un píxel y el expresivo rebota un 9,5 %', () => {
    expect(reboteDelResorte(RESORTES.espacial)).toBeLessThan(0.002);
    expect(reboteDelResorte(RESORTES.efectos)).toBe(0);
    expect(reboteDelResorte(RESORTES['expresivo-rapido'])).toBeCloseTo(0.0948, 3);
  });

  it('arrancan en cero y terminan exactamente en uno', () => {
    for (const resorte of Object.values(RESORTES)) {
      expect(posicionDelResorte(resorte, 0)).toBe(0);
      const curva = curvaDelResorte(resorte);
      expect(curva.startsWith('linear(0, ')).toBe(true);
      expect(curva.endsWith(', 1)')).toBe(true);
    }
  });

  it('no aceptan un resorte sobreamortiguado', () => {
    expect(() => posicionDelResorte({ amortiguacion: 1.2, rigidez: 700 }, 0.1)).toThrow(RangeError);
  });

  it('theme.css dice exactamente lo que da la función: nadie copia números a mano', () => {
    expect(sinEspacios(textoEntreMarcas(tema, MARCAS_DE_LOS_RESORTES.tokens))).toBe(
      sinEspacios(tokensDeLosResortes().join('')),
    );
  });

  it('con menos movimiento, sus duraciones van a cero como las demás', () => {
    expect(sinEspacios(textoEntreMarcas(tema, MARCAS_DE_LOS_RESORTES.sinMovimiento))).toBe(
      sinEspacios(duracionesSinMovimiento().join('')),
    );
  });
});
