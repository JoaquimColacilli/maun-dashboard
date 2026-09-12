const FORMATO = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });

const MAXIMO_BP = 100_000;

export function formatearPorcentaje(bp: number): string {
  return FORMATO.format(bp / 100);
}

export function parsearPorcentaje(texto: string): number | undefined {
  const limpio = texto.replace(/[%\s]/g, '').replace(',', '.');
  if (limpio === '' || !/^\d+(\.\d{1,2})?$/.test(limpio)) return undefined;

  const bp = Math.round(Number(limpio) * 100);
  if (!Number.isFinite(bp) || bp < 0 || bp > MAXIMO_BP) return undefined;
  return bp;
}
