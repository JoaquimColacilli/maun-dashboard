import type { GrupoPorCarga, ResumenDeDias } from '@maun/domain';

function numero(valor: number): string {
  return String(Math.round(valor * 10) / 10).replace('.', ',');
}

export function enDias(valor: number): string {
  return Math.abs(valor) === 1 ? `${numero(valor)} día` : `${numero(valor)} días`;
}

export function desvioEnPalabras(desvio: number): string {
  if (desvio === 0) return 'el mismo día';
  return desvio > 0 ? `${enDias(desvio)} después` : `${enDias(-desvio)} antes`;
}

function enLista(valores: readonly string[]): string {
  const ultimo = valores[valores.length - 1];
  if (ultimo === undefined) return '';
  return valores.length === 1 ? ultimo : `${valores.slice(0, -1).join(', ')} y ${ultimo}`;
}

export function resumenDeLosDias(resumen: ResumenDeDias): string {
  if (resumen.n === 0) return 'Sin datos todavía';
  if (resumen.modo === 'mediana') {
    return `${enDias(resumen.mediana)} en la mediana, de ${numero(resumen.minimo)} a ${numero(resumen.maximo)}`;
  }
  const [solo] = resumen.valores;
  if (resumen.valores.length === 1 && solo !== undefined) return enDias(solo);
  return `${enLista(resumen.valores.map(numero))} días`;
}

export function resumenDelDesvio(resumen: ResumenDeDias): string {
  if (resumen.n === 0) return 'Sin fecha estimada para comparar';
  if (resumen.modo === 'casos') return enLista(resumen.valores.map(desvioEnPalabras));
  return `${desvioEnPalabras(resumen.mediana)} en la mediana`;
}

export function cuantosTrabajos(n: number): string {
  return n === 1 ? '1 trabajo' : `${String(n)} trabajos`;
}

export function hayAlgoPorCarga(porCarga: readonly GrupoPorCarga[]): boolean {
  return porCarga.some((grupo) => grupo.demora.n > 0);
}
