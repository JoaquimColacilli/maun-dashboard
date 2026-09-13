import { onlineManager } from '@tanstack/react-query';

import { codigoDeAcceso, esFalloDeRed, mensajeDeAcceso, registrarHuella } from '@/shared/api';
import { activarBloqueo, pedirHuella } from '@/shared/lib';

export const SIN_SENAL_PARA_ACTIVAR =
  'Para activar la huella hace falta señal: se registra en el servidor. Probá cuando vuelva.';

const YA_REGISTRADA = new Set([
  'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED',
  'webauthn_credential_exists',
]);

export async function activarHuella(usuarioId: string): Promise<string | undefined> {
  if (!onlineManager.isOnline()) return SIN_SENAL_PARA_ACTIVAR;

  try {
    await registrarHuella();
  } catch (fallo) {
    if (!YA_REGISTRADA.has(codigoDeAcceso(fallo))) {
      return esFalloDeRed(fallo) ? SIN_SENAL_PARA_ACTIVAR : mensajeDeAcceso(fallo);
    }
    const confirmada = await pedirHuella(null, new AbortController().signal);
    if (confirmada.tipo !== 'confirmada') return 'La huella no se confirmó. Probá de nuevo.';
    activarBloqueo(usuarioId, confirmada.credencial);
    return undefined;
  }

  activarBloqueo(usuarioId, null);
  return undefined;
}
