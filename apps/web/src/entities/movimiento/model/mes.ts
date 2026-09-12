import {
  asientosDelMes,
  entradasYSalidas,
  sumarTodos,
  type Asiento,
  type Money,
} from '@maun/domain';

export interface ResumenMensual {
  entroHogar: Money;
  gastoHogar: Money;
  facturoTaller: Money;
}

export function resumenMensual(asientos: readonly Asiento[], mes: string): ResumenMensual {
  const delMes = asientosDelMes(asientos, mes);
  const hogar = entradasYSalidas(delMes, 'hogar');
  return {
    entroHogar: hogar.entro,
    gastoHogar: hogar.salio,
    facturoTaller: sumarTodos(
      delMes.filter((asiento) => asiento.origen === 'pago').map((asiento) => asiento.monto),
    ),
  };
}
