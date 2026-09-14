import { rechazoDeLaBase } from '@maun/db';

import { traducirRechazo, type ContextoDelRechazo } from './rechazos';

const ENLACE_EN_OTRO_NAVEGADOR =
  'El enlace se abrió en otro navegador o en otra app, y solo sirve en el mismo desde el que lo pediste. Pedí uno nuevo desde este dispositivo y abrilo acá mismo.';
const ENLACE_VENCIDO =
  'El enlace venció o ya se usó: cada enlace sirve una sola vez y por un rato. Pedí uno nuevo.';
const SESION_TERMINADA = 'Tu sesión se cerró. Entrá de nuevo con tu mail y tu contraseña.';
const CUENTA_REPETIDA =
  'Ya hay una cuenta con ese mail. Entrá con tu contraseña, o pedí una nueva si no te la acordás.';
const HUELLA_REPETIDA = 'Este dispositivo ya tiene la huella registrada para tu cuenta.';
const HUELLA_CANCELADA =
  'La huella se canceló o tardó demasiado. Probá de nuevo, o entrá con tu contraseña.';
const HUELLA_EN_OTRA_DIRECCION =
  'La huella no se puede usar desde esta dirección de la app. Abrila desde la dirección de siempre.';
const SIN_HUELLA_EN_EL_DISPOSITIVO =
  'Este dispositivo no tiene huella ni bloqueo de pantalla para confirmar que sos vos.';
const HUELLA_VENCIDA = 'Pasó demasiado tiempo antes de confirmar la huella. Probá de nuevo.';
const GENERICO = 'No pudimos completar la operación. Probá de nuevo.';

const POR_CODIGO: Readonly<Record<string, string>> = {
  invalid_credentials:
    'El mail o la contraseña no coinciden. Revisalos; si no te acordás la contraseña, pedí una nueva.',
  email_not_confirmed:
    'Todavía no confirmaste el mail. Abrí el enlace que te mandamos al crear la cuenta, o pedí que te lo mandemos de nuevo.',
  user_already_exists: CUENTA_REPETIDA,
  email_exists: CUENTA_REPETIDA,
  weak_password: 'La contraseña es muy débil: usá al menos 6 caracteres.',
  same_password: 'La contraseña nueva es igual a la que ya tenías. Elegí otra.',
  over_email_send_rate_limit:
    'El servidor ya mandó todos los mails que permite por hora. Esperá un rato y volvé a pedirlo; mientras, fijate en el correo no deseado.',
  over_request_rate_limit:
    'Hubo demasiados intentos seguidos. Esperá unos minutos y volvé a probar.',
  validation_failed:
    'Revisá el mail y la contraseña: alguno de los dos no tiene un formato válido.',
  email_address_invalid: 'Ese mail no parece válido. Revisá que esté bien escrito.',
  email_address_not_authorized: 'El servidor no manda mails a esa dirección. Probá con otro mail.',
  signup_disabled: 'Por ahora no se pueden crear cuentas nuevas.',
  email_provider_disabled: 'Por ahora no se puede entrar con mail y contraseña.',
  user_banned: 'Esta cuenta está suspendida y no puede entrar.',
  user_not_found: 'No encontramos esa cuenta. Revisá el mail.',
  flow_state_not_found: ENLACE_EN_OTRO_NAVEGADOR,
  bad_code_verifier: ENLACE_EN_OTRO_NAVEGADOR,
  pkce_code_verifier_not_found: ENLACE_EN_OTRO_NAVEGADOR,
  flow_state_expired: ENLACE_VENCIDO,
  otp_expired: ENLACE_VENCIDO,
  session_not_found: SESION_TERMINADA,
  session_expired: SESION_TERMINADA,
  refresh_token_not_found: SESION_TERMINADA,
  refresh_token_already_used: SESION_TERMINADA,
  reauthentication_needed:
    'Para cambiar la contraseña hay que confirmar que sos vos: pedí el enlace de recuperación y abrilo desde el correo.',
  request_timeout: 'El servidor tardó demasiado en contestar. Probá de nuevo.',
  unexpected_failure: 'El servidor tuvo un problema. Probá de nuevo en un rato.',
  passkey_disabled:
    'La huella todavía no está habilitada en el servidor. Mientras tanto, entrá con tu contraseña.',
  too_many_passkeys: 'Tu cuenta ya tiene el máximo de huellas registradas.',
  webauthn_credential_exists: HUELLA_REPETIDA,
  webauthn_challenge_expired: HUELLA_VENCIDA,
  webauthn_challenge_not_found: HUELLA_VENCIDA,
  webauthn_verification_failed:
    'El servidor no pudo verificar la huella. Probá de nuevo, o entrá con tu contraseña.',
  ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED: HUELLA_REPETIDA,
  ERROR_CEREMONY_ABORTED: HUELLA_CANCELADA,
  ERROR_INVALID_DOMAIN: HUELLA_EN_OTRA_DIRECCION,
  ERROR_INVALID_RP_ID: HUELLA_EN_OTRA_DIRECCION,
  ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT: SIN_HUELLA_EN_EL_DISPOSITIVO,
  ERROR_AUTHENTICATOR_MISSING_DISCOVERABLE_CREDENTIAL_SUPPORT: SIN_HUELLA_EN_EL_DISPOSITIVO,
  ERROR_AUTHENTICATOR_GENERAL_ERROR:
    'El sensor de huella tuvo un problema. Probá de nuevo, o entrá con tu contraseña.',
};

const POR_NOMBRE: Readonly<Record<string, string>> = {
  AuthSessionMissingError: SESION_TERMINADA,
  AuthPKCECodeVerifierMissingError: ENLACE_EN_OTRO_NAVEGADOR,
  AuthInvalidTokenResponseError: 'El servidor contestó algo que no esperábamos. Probá de nuevo.',
  NotAllowedError: HUELLA_CANCELADA,
  AbortError: HUELLA_CANCELADA,
  SecurityError: HUELLA_EN_OTRA_DIRECCION,
};

const SIN_RED = 'No hay conexión con el servidor. Probá de nuevo cuando vuelva la señal.';

const MENSAJE_DE_RED = /failed to fetch|networkerror|network request failed|load failed/i;

const SIN_WEBAUTHN = /does not support webauthn/i;

export class RechazoDeAcceso extends Error {
  readonly code: string;

  constructor(codigo: string) {
    super(codigo);
    this.name = 'RechazoDeAcceso';
    this.code = codigo;
  }
}

function codigoDeAuth(error: unknown): { codigo: string; estado: number; nombre: string } {
  if (typeof error !== 'object' || error === null) return { codigo: '', estado: 0, nombre: '' };
  const posible = error as Record<string, unknown>;
  const detalles = posible.details;
  const delDetalle =
    typeof detalles === 'object' && detalles !== null
      ? (detalles as Record<string, unknown>).code
      : undefined;
  const codigo =
    typeof posible.code === 'string' && posible.code !== ''
      ? posible.code
      : typeof delDetalle === 'string'
        ? delDetalle
        : '';
  return {
    codigo,
    estado: typeof posible.status === 'number' ? posible.status : 0,
    nombre: typeof posible.name === 'string' ? posible.name : '',
  };
}

export function codigoDeAcceso(error: unknown): string {
  return codigoDeAuth(error).codigo;
}

export function esFalloDeRed(error: unknown): boolean {
  if (error instanceof TypeError) return true;

  const { nombre, estado } = codigoDeAuth(error);
  if (nombre === 'FunctionsFetchError') return true;
  if (nombre === 'AuthRetryableFetchError') return estado === 0 || estado >= 500;
  if (nombre === 'StorageUnknownError') {
    const original = (error as Record<string, unknown>).originalError;
    const mensaje = error instanceof Error ? error.message : '';
    return original instanceof TypeError || MENSAJE_DE_RED.test(mensaje);
  }

  const rechazo = rechazoDeLaBase(error);
  return rechazo !== undefined && rechazo.codigo === '' && MENSAJE_DE_RED.test(rechazo.mensaje);
}

export function mensajeDeAcceso(error: unknown): string {
  if (esFalloDeRed(error)) return SIN_RED;

  const { codigo, estado, nombre } = codigoDeAuth(error);
  const porCodigo = POR_CODIGO[codigo];
  if (porCodigo) return porCodigo;
  const porNombre = POR_NOMBRE[nombre];
  if (porNombre) return porNombre;
  if (error instanceof Error && SIN_WEBAUTHN.test(error.message)) {
    return 'Este navegador no puede usar la huella. Entrá con tu contraseña.';
  }
  if (estado === 429)
    return 'Hubo demasiados intentos seguidos. Esperá unos minutos y volvé a probar.';
  if (estado > 0 || nombre.startsWith('Auth')) {
    return codigo === ''
      ? GENERICO
      : `No pudimos completar la operación (${codigo}). Probá de nuevo.`;
  }

  const rechazo = rechazoDeLaBase(error);
  if (rechazo?.codigo.startsWith('MN')) {
    return rechazo.hint === '' ? rechazo.mensaje : `${rechazo.mensaje} ${rechazo.hint}`;
  }
  if (rechazo && rechazo.codigo !== '') {
    return `No pudimos completar la operación (${rechazo.codigo}). Probá de nuevo.`;
  }
  return GENERICO;
}

export function mensajeDeSincronizacion(error: unknown, contexto?: ContextoDelRechazo): string {
  if (esFalloDeRed(error)) return SIN_RED;
  const traducido = traducirRechazo(error, contexto);
  if (traducido) return `${traducido.titulo} ${traducido.queHacer}`;
  return mensajeDeAcceso(error);
}

export function errorDelEnlace(direccion: string): string | undefined {
  let url: URL;
  try {
    url = new URL(direccion);
  } catch {
    return undefined;
  }
  const delHash = new URLSearchParams(url.hash.replace(/^#/, ''));
  const leer = (clave: string) => url.searchParams.get(clave) ?? delHash.get(clave);
  const codigo = leer('error_code');
  if (codigo === null && leer('error') === null && leer('error_description') === null) {
    return undefined;
  }
  return (
    (codigo === null ? undefined : POR_CODIGO[codigo]) ??
    'El enlace del correo no sirvió. Pedí uno nuevo desde este dispositivo.'
  );
}

export function esAltaRepetida(
  usuario: { identities?: readonly unknown[] | null } | null | undefined,
): boolean {
  return Array.isArray(usuario?.identities) && usuario.identities.length === 0;
}
