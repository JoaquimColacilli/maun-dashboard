import { onlineManager } from '@tanstack/react-query';

import { codigoDeAcceso, esFalloDeRed, mensajeDeAcceso, registrarHuella } from '@/shared/api';
import { activarBloqueo, conUnaSolaCeremonia, pedirHuella } from '@/shared/lib';

export const SIN_SENAL_PARA_ACTIVAR =
  'Para activar la huella hace falta señal: se registra en el servidor. Probá cuando vuelva.';

const SIN_RESPUESTA = 'El registro de la huella no respondió. Probá de nuevo.';

const YA_REGISTRADA = new Set([
  'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED',
  'webauthn_credential_exists',
]);

export type ResultadoDeActivar =
  { tipo: 'activada' } | { tipo: 'no-se-pudo'; mensaje: string } | { tipo: 'interrumpida' };

export async function activarHuella(
  usuarioId: string,
  signal?: AbortSignal,
): Promise<ResultadoDeActivar> {
  if (!onlineManager.isOnline()) return { tipo: 'no-se-pudo', mensaje: SIN_SENAL_PARA_ACTIVAR };

  const registro = await conUnaSolaCeremonia(
    (senal) => registrarHuella(senal),
    signal === undefined ? {} : { signal },
  );

  switch (registro.tipo) {
    case 'terminada':
      activarBloqueo(usuarioId, null);
      return { tipo: 'activada' };
    case 'cancelada-por-la-app':
      return { tipo: 'interrumpida' };
    case 'sin-respuesta':
      return { tipo: 'no-se-pudo', mensaje: SIN_RESPUESTA };
    case 'fallida':
      break;
  }

  const fallo = registro.error;
  if (!YA_REGISTRADA.has(codigoDeAcceso(fallo))) {
    return {
      tipo: 'no-se-pudo',
      mensaje: esFalloDeRed(fallo) ? SIN_SENAL_PARA_ACTIVAR : mensajeDeAcceso(fallo),
    };
  }
  const confirmada = await pedirHuella(null, signal);
  if (confirmada.tipo === 'interrumpida') return { tipo: 'interrumpida' };
  if (confirmada.tipo !== 'confirmada') {
    return { tipo: 'no-se-pudo', mensaje: 'La huella no se confirmó. Probá de nuevo.' };
  }
  activarBloqueo(usuarioId, confirmada.credencial);
  return { tipo: 'activada' };
}
