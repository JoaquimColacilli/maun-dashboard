import { describe, expect, it } from 'vitest';

import {
  compararCascada,
  compararEstados,
  compararFormasDeCobro,
  compararGuardadoDeProyecto,
  compararLibroDelSeed,
  compararLibroMayor,
  compararLinkDeResena,
  compararLiquidaciones,
  compararNombreDeNecesidad,
  compararPagosPorDelante,
  compararRangos,
  compararSeed,
  compararSenaEsperada,
  compararTopes,
  compararTransiciones,
  compararValidacionDeRespuestas,
} from '../scripts/comparacion.ts';
import { enTransaccionConRollback } from '../scripts/pgtap.ts';

describe('@maun/domain y la base calculan exactamente lo mismo', () => {
  it('la cascada de SQL da lo mismo que calcularDistribucion en miles de casos', async () => {
    expect(await enTransaccionConRollback(compararCascada)).toEqual([]);
  });

  it('los topes de SQL dan lo mismo que topesDeLaLiquidacion en miles de casos', async () => {
    expect(await enTransaccionConRollback(compararTopes)).toEqual([]);
  });

  it('qué pagos le faltan al cliente y cuánto es cada uno lo contestan igual las dos', async () => {
    expect(await enTransaccionConRollback(compararPagosPorDelante)).toEqual([]);
  });

  it('la seña que calcula la base es la de calcularSena, en los casos de la seña y en quinientos al azar', async () => {
    expect(await enTransaccionConRollback(compararSenaEsperada)).toEqual([]);
  });

  it('el valor por defecto de las formas de cobro es el mismo en las dos', async () => {
    expect(await enTransaccionConRollback(compararFormasDeCobro)).toEqual([]);
  });

  it('el enlace de reseña lo aceptan y lo rechazan igual el check de la base y el dominio', async () => {
    expect(await enTransaccionConRollback(compararLinkDeResena)).toEqual([]);
  });

  it('el nombre de lo que hace falta lo aceptan y lo rechazan igual el check de la base y el dominio', async () => {
    expect(await enTransaccionConRollback(compararNombreDeNecesidad)).toEqual([]);
  });

  it('una respuesta a la encuesta la aceptan o la rechazan igual las dos, y por el mismo motivo', async () => {
    expect(await enTransaccionConRollback(compararValidacionDeRespuestas)).toEqual([]);
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
