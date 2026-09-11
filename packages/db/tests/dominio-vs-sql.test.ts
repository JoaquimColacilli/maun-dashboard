import { describe, expect, it } from 'vitest';

import {
  compararCascada,
  compararCobros,
  compararEstados,
  compararRangos,
  compararTransiciones,
} from '../scripts/comparacion.ts';
import { enTransaccionConRollback } from '../scripts/pgtap.ts';

describe('@maun/domain y la base calculan exactamente lo mismo', () => {
  it('la cascada de SQL da lo mismo que calcularDistribucion en miles de casos', async () => {
    expect(await enTransaccionConRollback(compararCascada)).toEqual([]);
  });

  it('las dos rechazan exactamente los mismos importes fuera de rango', async () => {
    expect(await enTransaccionConRollback(compararRangos)).toEqual([]);
  });

  it('los estados son los del enum de Postgres, en el mismo orden', async () => {
    expect(await enTransaccionConRollback(compararEstados)).toEqual([]);
  });

  it('cada transición manual vale en SQL si y solo si vale en @maun/domain', async () => {
    expect(await enTransaccionConRollback(compararTransiciones)).toEqual([]);
  });

  it('lo que cobrar_proyecto congela es lo que calculó el dominio', async () => {
    expect(await enTransaccionConRollback(compararCobros)).toEqual([]);
  });
});
