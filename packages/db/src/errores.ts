export const SIN_PERMISO = '42501';

// Clases de SQLSTATE que sí pasan solas: conexión, transacción abortada, falta de recursos y
// apagado del servidor. Cualquier otro código es una respuesta definitiva de Postgres y
// reintentarlo no cambia nada: solo tapa la cola, que drena de a una.
const CLASES_TRANSITORIAS = ['08', '40', '53', '57', '58'];

const SQLSTATE = /^[0-9A-Z]{5}$/;

export interface RechazoDeLaBase {
  codigo: string;
  mensaje: string;
  hint: string;
}

export function rechazoDeLaBase(error: unknown): RechazoDeLaBase | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const posible = error as Record<string, unknown>;
  if (typeof posible.code !== 'string' || typeof posible.message !== 'string') return undefined;
  return {
    codigo: posible.code,
    mensaje: posible.message,
    hint: typeof posible.hint === 'string' ? posible.hint : '',
  };
}

export function esRechazoDeNegocio(error: unknown): boolean {
  const rechazo = rechazoDeLaBase(error);
  if (!rechazo) return false;
  return /^MN\d{3}$/.test(rechazo.codigo) || rechazo.codigo === SIN_PERMISO;
}

export function debeReintentarse(error: unknown): boolean {
  const rechazo = rechazoDeLaBase(error);
  // Sin código no hubo respuesta de la base: es red, timeout o un 5xx. Eso sí se reintenta.
  // PostgREST devuelve los fallos de fetch como un objeto con code vacío.
  if (!rechazo || rechazo.codigo === '') return true;
  if (esRechazoDeNegocio(error)) return false;
  if (!SQLSTATE.test(rechazo.codigo)) return true;
  return CLASES_TRANSITORIAS.includes(rechazo.codigo.slice(0, 2));
}
