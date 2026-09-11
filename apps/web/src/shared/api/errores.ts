import { rechazoDeLaBase } from '@maun/db';

const POR_CODIGO: Record<string, string> = {
  invalid_credentials: 'El mail o la contraseña no coinciden.',
  email_not_confirmed:
    'Todavía no confirmaste el mail. Abrí el enlace que te mandamos y volvé a entrar.',
  over_email_send_rate_limit:
    'Se llegó al límite de mails por hora. Esperá una hora y volvé a intentar.',
  over_request_rate_limit: 'Demasiados intentos seguidos. Esperá unos minutos y volvé a intentar.',
  weak_password: 'La contraseña es muy corta: tiene que tener al menos 6 caracteres.',
  same_password: 'La contraseña nueva tiene que ser distinta de la anterior.',
  validation_failed: 'Revisá el mail y la contraseña.',
  user_already_exists: 'Ya hay una cuenta con ese mail. Entrá o recuperá la contraseña.',
  flow_state_not_found:
    'El enlace no se puede usar en este navegador: pedí uno nuevo y abrilo desde acá.',
  flow_state_expired: 'El enlace venció. Pedí uno nuevo.',
  pkce_code_verifier_not_found:
    'El enlace no se puede usar en este navegador: pedí uno nuevo y abrilo desde acá.',
  otp_expired: 'El enlace venció. Pedí uno nuevo.',
};

const SIN_RED = 'No hay conexión con el servidor. Probá de nuevo cuando vuelva la señal.';

// PostgREST no rechaza con un TypeError: devuelve un objeto con el code vacío y el mensaje del
// fetch adentro. Sin esto, un corte de red termina mostrando "TypeError: Failed to fetch".
const MENSAJE_DE_RED = /failed to fetch|networkerror|network request failed|load failed/i;

function codigoDeAuth(error: unknown): { codigo: string; estado: number; nombre: string } {
  if (typeof error !== 'object' || error === null) return { codigo: '', estado: 0, nombre: '' };
  const posible = error as Record<string, unknown>;
  return {
    codigo: typeof posible.code === 'string' ? posible.code : '',
    estado: typeof posible.status === 'number' ? posible.status : 0,
    nombre: typeof posible.name === 'string' ? posible.name : '',
  };
}

export function esFalloDeRed(error: unknown): boolean {
  if (error instanceof TypeError) return true;

  const { nombre, estado } = codigoDeAuth(error);
  if (nombre === 'AuthRetryableFetchError') return estado === 0 || estado >= 500;

  const rechazo = rechazoDeLaBase(error);
  return rechazo !== undefined && rechazo.codigo === '' && MENSAJE_DE_RED.test(rechazo.mensaje);
}

export function mensajeDeAcceso(error: unknown): string {
  if (esFalloDeRed(error)) return SIN_RED;

  const { codigo, estado } = codigoDeAuth(error);
  const conocido = POR_CODIGO[codigo];
  if (conocido) return conocido;
  if (estado === 429) return 'Demasiados intentos seguidos. Esperá un rato y volvé a intentar.';
  if (estado > 0) {
    return codigo === ''
      ? 'No pudimos completar la operación. Probá de nuevo.'
      : `No pudimos completar la operación (${codigo}). Probá de nuevo.`;
  }

  const rechazo = rechazoDeLaBase(error);
  if (rechazo) return rechazo.hint === '' ? rechazo.mensaje : `${rechazo.mensaje} ${rechazo.hint}`;

  if (error instanceof Error && error.message !== '') return error.message;
  return 'No pudimos completar la operación. Probá de nuevo.';
}

export function mensajeDeSincronizacion(error: unknown): string {
  if (esFalloDeRed(error)) return SIN_RED;
  const rechazo = rechazoDeLaBase(error);
  if (rechazo?.codigo === '42501') return 'Tu cuenta no tiene acceso a ningún taller.';
  return mensajeDeAcceso(error);
}
