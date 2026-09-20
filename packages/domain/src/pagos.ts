import { restar, type Money } from './money.ts';
import { calcularSena, type EntradaDeLaSena } from './sena.ts';

export const FORMAS_DE_COBRO = ['transferencia', 'efectivo'] as const;

export type FormaDeCobro = (typeof FORMAS_DE_COBRO)[number];

export const INSTANCIAS_DE_PAGO = ['sena', 'saldo'] as const;

export type InstanciaDePago = (typeof INSTANCIAS_DE_PAGO)[number];

export interface PagoQueToca {
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

export function pagoQueToca(entrada: EntradaDeLaSena): PagoQueToca | null {
  if (entrada.presupuesto === null) return { instancia: 'sena', monto: null };

  const saldo = restar(entrada.presupuesto, entrada.cobrado);
  if (saldo <= 0) return null;

  const sena = calcularSena(entrada);
  if (sena.situacion === 'falta') return { instancia: 'sena', monto: sena.falta };
  return { instancia: 'saldo', monto: saldo };
}

export function instanciasPendientes(entrada: EntradaDeLaSena): readonly InstanciaDePago[] {
  if (entrada.presupuesto !== null && entrada.cobrado >= entrada.presupuesto) return [];
  return calcularSena(entrada).situacion === 'cubierta' ? ['saldo'] : ['sena', 'saldo'];
}

export function montoParaPegar(monto: Money): string {
  const pesos = Math.trunc(monto / 100);
  const resto = Math.abs(monto % 100);
  return resto === 0 ? String(pesos) : `${String(pesos)},${String(resto).padStart(2, '0')}`;
}
