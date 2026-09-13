const FORMATO = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

const FORMATO_CON_CENTAVOS = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
});

export function formatearPesos(centavos: number): string {
  const pesos = centavos / 100;
  return Number.isInteger(pesos) ? FORMATO.format(pesos) : FORMATO_CON_CENTAVOS.format(pesos);
}
