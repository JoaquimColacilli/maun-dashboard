import { describe, expect, it } from 'vitest';

import {
  compararCascada,
  compararEstados,
  compararFormasDeCobro,
  compararGuardadoDeProyecto,
  compararLibroDelSeed,
  compararLibroMayor,
  compararLiquidaciones,
  compararPagoQueToca,
  compararRangos,
  compararSeed,
  compararTopes,
  compararTransiciones,
} from '../scripts/comparacion.ts';
import { enTransaccionConRollback } from '../scripts/pgtap.ts';

describe('@maun/domain y la base calculan exactamente lo mismo', () => {
  it('la cascada de SQL da lo mismo que calcularDistribucion en miles de casos', async () => {
    expect(await enTransaccionConRollback(compararCascada)).toEqual([]);
  });

  it('los topes de SQL dan lo mismo que topesDeLaLiquidacion en miles de casos', async () => {
    expect(await enTransaccionConRollback(compararTopes)).toEqual([]);
  });

  it('qué pago le toca al cliente y cuánto falta lo contestan igual las dos', async () => {
    expect(await enTransaccionConRollback(compararPagoQueToca)).toEqual([]);
  });

  it('el valor por defecto de las formas de cobro es el mismo en las dos', async () => {
    expect(await enTransaccionConRollback(compararFormasDeCobro)).toEqual([]);
  });

  it('las dos rechazan exactamente los mismos importes fuera de rango', async () => {
    expect(await enTransaccionConRollback(compararRangos)).toEqual([]);
  });

  it('los estados son los del enum de Postgres, en el mismo orden', async () => {
    expect(await enTransaccionConRollback(compararEstados)).toEqual([]);
  });

  it('cada transición, liquidación y reversión vale en SQL si y solo si vale en @maun/domain', async () => {
    expect(await enTransaccionConRollback(compararTransiciones)).toEqual([]);
  });

  it('lo que congelan cobrar, cerrar, reabrir y reactivar, paso a paso, es lo que calcula el dominio', async () => {
    expect(await enTransaccionConRollback(compararLiquidaciones)).toEqual([]);
  });

  it('cada liquidación del seed es la que calcula el dominio con las anteriores de su mes', async () => {
    expect(await enTransaccionConRollback(compararSeed)).toEqual([]);
  });

  it('el libro mayor de SQL da los mismos asientos y los mismos saldos que asientosDelLibro', async () => {
    expect(await enTransaccionConRollback(compararLibroMayor)).toEqual([]);
  });

  it('el libro mayor del seed sale igual de la vista y de la réplica', async () => {
    expect(await enTransaccionConRollback(compararLibroDelSeed)).toEqual([]);
  });

  it('lo que escribe guardar_proyecto es lo que la app lee de su réplica', async () => {
    expect(await enTransaccionConRollback(compararGuardadoDeProyecto)).toEqual([]);
  });
});
