export const LARGO_DE_CBU = 22;

export const LARGO_MINIMO_DE_ALIAS = 6;

export const LARGO_MAXIMO_DE_ALIAS = 20;

const PESOS_DEL_BANCO = [7, 1, 3, 9, 7, 1, 3] as const;

const PESOS_DE_LA_CUENTA = [3, 9, 7, 1, 3, 9, 7, 1, 3, 9, 7, 1, 3] as const;

const PREFIJO_VIRTUAL = '000';

const CARACTERES_DEL_ALIAS = /^[A-Za-z0-9.-]+$/;

const SEPARADORES_SEGUIDOS = /[.-]{2}/;

export type ClaveBancaria = 'cbu' | 'cvu';

export type MotivoDeCbu = 'largo' | 'banco' | 'cuenta';

export type RevisionDeCbu =
  | { estado: 'vacio' }
  | { estado: 'valido'; clave: ClaveBancaria }
  | { estado: 'invalido'; motivo: MotivoDeCbu };

export type MotivoDeAlias = 'corto' | 'largo' | 'caracteres';

export type AvisoDeAlias = 'separador-en-la-punta' | 'separadores-seguidos';

export type RevisionDeAlias =
  | { estado: 'vacio' }
  | { estado: 'valido'; aviso: AvisoDeAlias | null }
  | { estado: 'invalido'; motivo: MotivoDeAlias };

export function digitosDeCbu(texto: string): string {
  return texto.replace(/\D/g, '');
}

export function formatearCbu(texto: string): string {
  const digitos = digitosDeCbu(texto).slice(0, LARGO_DE_CBU);
  return (digitos.match(/.{1,4}/g) ?? []).join(' ');
}

export function verificadorDelBloque(digitos: string, pesos: readonly number[]): number | null {
  if (digitos.length !== pesos.length) return null;

  let suma = 0;
  for (const [indice, peso] of pesos.entries()) {
    suma += peso * Number(digitos[indice]);
  }
  return (10 - (suma % 10)) % 10;
}

export function esClaveVirtual(digitos: string): boolean {
  return digitos.startsWith(PREFIJO_VIRTUAL);
}

export function claveBancariaDe(texto: string): ClaveBancaria {
  return esClaveVirtual(digitosDeCbu(texto)) ? 'cvu' : 'cbu';
}

export function revisarCbu(texto: string): RevisionDeCbu {
  const digitos = digitosDeCbu(texto);
  if (digitos === '') return { estado: 'vacio' };
  if (digitos.length !== LARGO_DE_CBU) return { estado: 'invalido', motivo: 'largo' };

  if (verificadorDelBloque(digitos.slice(0, 7), PESOS_DEL_BANCO) !== Number(digitos[7])) {
    return { estado: 'invalido', motivo: 'banco' };
  }
  if (verificadorDelBloque(digitos.slice(8, 21), PESOS_DE_LA_CUENTA) !== Number(digitos[21])) {
    return { estado: 'invalido', motivo: 'cuenta' };
  }

  return { estado: 'valido', clave: esClaveVirtual(digitos) ? 'cvu' : 'cbu' };
}

export function normalizarAlias(texto: string): string {
  return texto.trim();
}

function avisoDelAlias(alias: string): AvisoDeAlias | null {
  if (/^[.-]/.test(alias) || /[.-]$/.test(alias)) return 'separador-en-la-punta';
  if (SEPARADORES_SEGUIDOS.test(alias)) return 'separadores-seguidos';
  return null;
}

export function revisarAlias(texto: string): RevisionDeAlias {
  const alias = normalizarAlias(texto);
  if (alias === '') return { estado: 'vacio' };
  if (alias.length < LARGO_MINIMO_DE_ALIAS) return { estado: 'invalido', motivo: 'corto' };
  if (alias.length > LARGO_MAXIMO_DE_ALIAS) return { estado: 'invalido', motivo: 'largo' };
  if (!CARACTERES_DEL_ALIAS.test(alias)) return { estado: 'invalido', motivo: 'caracteres' };
  return { estado: 'valido', aviso: avisoDelAlias(alias) };
}

export const LARGO_MAXIMO_DEL_LINK = 300;

export const HOSTS_DE_MERCADO_PAGO = [
  'www.mercadopago.com.ar',
  'mercadopago.com.ar',
  'link.mercadopago.com.ar',
  'mpago.la',
  'mpago.li',
] as const;

const LINK_DE_MERCADO_PAGO =
  /^https:\/\/(?:www\.mercadopago\.com\.ar|mercadopago\.com\.ar|link\.mercadopago\.com\.ar|mpago\.la|mpago\.li)\/\S*$/;

const SOLO_EL_HOST =
  /^https:\/\/(?:www\.mercadopago\.com\.ar|mercadopago\.com\.ar|link\.mercadopago\.com\.ar|mpago\.la|mpago\.li)$/;

export type MotivoDelLink = 'largo' | 'sin-https' | 'otro-sitio';

export type RevisionDelLink =
  { estado: 'vacio' } | { estado: 'valido' } | { estado: 'invalido'; motivo: MotivoDelLink };

export function normalizarLinkDeCobro(texto: string): string {
  const link = texto.trim();
  return SOLO_EL_HOST.test(link) ? `${link}/` : link;
}

export function esLinkDeMercadoPago(texto: string): boolean {
  return texto.length <= LARGO_MAXIMO_DEL_LINK && LINK_DE_MERCADO_PAGO.test(texto);
}

export function revisarLinkDeCobro(texto: string): RevisionDelLink {
  const link = normalizarLinkDeCobro(texto);
  if (link === '') return { estado: 'vacio' };
  if (link.length > LARGO_MAXIMO_DEL_LINK) return { estado: 'invalido', motivo: 'largo' };
  if (!link.startsWith('https://')) return { estado: 'invalido', motivo: 'sin-https' };
  if (!LINK_DE_MERCADO_PAGO.test(link)) return { estado: 'invalido', motivo: 'otro-sitio' };
  return { estado: 'valido' };
}
