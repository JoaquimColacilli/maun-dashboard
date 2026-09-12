import { centavos, type Money } from '@maun/domain';

export function dinero(valor: number): Money {
  return centavos(valor);
}
