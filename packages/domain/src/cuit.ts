const PESOS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2] as const;

export const PREFIJOS_DE_PERSONA = [20, 23, 24, 27] as const;
export const PREFIJOS_DE_EMPRESA = [30, 33, 34] as const;

const PREFIJOS = new Set<number>([...PREFIJOS_DE_PERSONA, ...PREFIJOS_DE_EMPRESA]);

export const LARGO_DE_CUIT = 11;

export type MotivoDeCuit = 'largo' | 'prefijo' | 'verificador';

export type RevisionDeCuit =
  | { estado: 'vacio' }
  | { estado: 'valido' }
  | { estado: 'ambiguo' }
  | { estado: 'invalido'; motivo: MotivoDeCuit };

export function digitosDeCuit(texto: string): string {
  return texto.replace(/\D/g, '');
}

export function formatearCuit(texto: string): string {
  const digitos = digitosDeCuit(texto).slice(0, LARGO_DE_CUIT);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 10) return `${digitos.slice(0, 2)}-${digitos.slice(2)}`;
  return `${digitos.slice(0, 2)}-${digitos.slice(2, 10)}-${digitos.slice(10)}`;
}

export function verificadorDeCuit(texto: string): number | null {
  const digitos = digitosDeCuit(texto);
  if (digitos.length < 10) return null;

  let suma = 0;
  for (const [indice, peso] of PESOS.entries()) {
    suma += peso * Number(digitos[indice]);
  }

  const resto = 11 - (suma % 11);
  if (resto === 11) return 0;
  return resto === 10 ? null : resto;
}

export function revisarCuit(texto: string): RevisionDeCuit {
  const digitos = digitosDeCuit(texto);
  if (digitos === '') return { estado: 'vacio' };
  if (digitos.length !== LARGO_DE_CUIT) return { estado: 'invalido', motivo: 'largo' };
  if (!PREFIJOS.has(Number(digitos.slice(0, 2)))) {
    return { estado: 'invalido', motivo: 'prefijo' };
  }

  const esperado = verificadorDeCuit(digitos);
  if (esperado === null) return { estado: 'ambiguo' };
  return esperado === Number(digitos[10])
    ? { estado: 'valido' }
    : { estado: 'invalido', motivo: 'verificador' };
}
