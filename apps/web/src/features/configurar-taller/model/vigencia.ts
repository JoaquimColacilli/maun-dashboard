export const DIAS_MAXIMOS_DE_UN_PRESUPUESTO = 365;

export function parsearDias(texto: string): number | undefined {
  const limpio = texto.trim();
  if (!/^\d{1,3}$/.test(limpio)) return undefined;
  const dias = Number(limpio);
  return dias >= 1 && dias <= DIAS_MAXIMOS_DE_UN_PRESUPUESTO ? dias : undefined;
}
