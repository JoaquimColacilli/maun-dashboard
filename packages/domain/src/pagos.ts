import { restar, type Money } from './money.ts';
import { calcularSena, type EntradaDeLaSena } from './sena.ts';

export const FORMAS_DE_COBRO = ['transferencia', 'efectivo'] as const;

export type FormaDeCobro = (typeof FORMAS_DE_COBRO)[number];

export const INSTANCIAS_DE_PAGO = ['sena', 'saldo'] as const;

export type InstanciaDePago = (typeof INSTANCIAS_DE_PAGO)[number];

export interface PagoPorDelante {
  instancia: InstanciaDePago;
  monto: Money | null;
}

export function formasDeCobro(
  guardado: readonly FormaDeCobro[] | null,
  hayComoTransferir: boolean,
): readonly FormaDeCobro[] {
  if (guardado !== null) return guardado;
  return hayComoTransferir ? ['transferencia', 'efectivo'] : ['efectivo'];
}

export function ofrece(formas: readonly FormaDeCobro[], forma: FormaDeCobro): boolean {
  return formas.includes(forma);
}

export function conLaForma(
  formas: readonly FormaDeCobro[],
  forma: FormaDeCobro,
  ofrecida: boolean,
): readonly FormaDeCobro[] | null {
  const siguiente = FORMAS_DE_COBRO.filter((una) =>
    una === forma ? ofrecida : formas.includes(una),
  );
  return siguiente.length === 0 ? null : siguiente;
}

export function unaSolaForma(formas: readonly FormaDeCobro[]): FormaDeCobro | null {
  const [primera, ...otras] = formas;
  return primera !== undefined && otras.length === 0 ? primera : null;
}

export function pagosPorDelante(entrada: EntradaDeLaSena): readonly PagoPorDelante[] {
  if (entrada.presupuesto === null) {
    return [
      { instancia: 'sena', monto: null },
      { instancia: 'saldo', monto: null },
    ];
  }

  const falta = restar(entrada.presupuesto, entrada.cobrado);
  if (falta <= 0) return [];

  const sena = calcularSena(entrada);
  if (sena.situacion !== 'falta') return [{ instancia: 'saldo', monto: falta }];

  const despues = restar(entrada.presupuesto, sena.esperada);
  if (despues <= 0) return [{ instancia: 'sena', monto: sena.falta }];
  return [
    { instancia: 'sena', monto: sena.falta },
    { instancia: 'saldo', monto: despues },
  ];
}

export function pagoQueToca(entrada: EntradaDeLaSena): PagoPorDelante | null {
  return pagosPorDelante(entrada)[0] ?? null;
}

export function instanciasPendientes(entrada: EntradaDeLaSena): readonly InstanciaDePago[] {
  return pagosPorDelante(entrada).map((pago) => pago.instancia);
}

export function montoParaPegar(monto: Money): string {
  const pesos = Math.trunc(monto / 100);
  const resto = Math.abs(monto % 100);
  return resto === 0 ? String(pesos) : `${String(pesos)},${String(resto).padStart(2, '0')}`;
}
