const BYTES_DEL_TOKEN = 24;

export const CLAVE_DE_LOS_ENLACES = 'maun:enlaces';

export function tokenNuevo(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(BYTES_DEL_TOKEN));
  const crudo = btoa(String.fromCharCode(...bytes));
  return crudo.replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export async function hashDelToken(token: string): Promise<string> {
  const resumen = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(resumen), (valor) => valor.toString(16).padStart(2, '0')).join(
    '',
  );
}

function leerTodos(): Record<string, string> {
  try {
    const guardado: unknown = JSON.parse(localStorage.getItem(CLAVE_DE_LOS_ENLACES) ?? '{}');
    if (typeof guardado !== 'object' || guardado === null) return {};
    return Object.fromEntries(
      Object.entries(guardado as Record<string, unknown>).filter(
        (entrada): entrada is [string, string] => typeof entrada[1] === 'string',
      ),
    );
  } catch {
    return {};
  }
}

function escribirTodos(tokens: Record<string, string>): void {
  try {
    localStorage.setItem(CLAVE_DE_LOS_ENLACES, JSON.stringify(tokens));
  } catch {
    return;
  }
}

export function tokenDelEnlace(enlaceId: string): string | undefined {
  return leerTodos()[enlaceId];
}

export function recordarToken(enlaceId: string, token: string): void {
  escribirTodos({ ...leerTodos(), [enlaceId]: token });
}

export function olvidarToken(enlaceId: string): void {
  const tokens = leerTodos();
  if (!(enlaceId in tokens)) return;
  escribirTodos(Object.fromEntries(Object.entries(tokens).filter(([clave]) => clave !== enlaceId)));
}

export function olvidarLosTokens(): void {
  try {
    localStorage.removeItem(CLAVE_DE_LOS_ENLACES);
  } catch {
    return;
  }
}

export function enlaceDelCliente(token: string): string {
  return `${globalThis.location.origin}/v/${token}`;
}
