import { clienteMaun } from './cliente';

export async function registrarHuella(signal?: AbortSignal): Promise<void> {
  const { error } = await clienteMaun().auth.registerPasskey(
    signal === undefined ? undefined : { options: { signal } },
  );
  if (error) throw error;
}

function autocompletadoConHuellaPosible(): boolean {
  return (
    'PublicKeyCredential' in globalThis &&
    'parseRequestOptionsFromJSON' in PublicKeyCredential &&
    'isConditionalMediationAvailable' in PublicKeyCredential
  );
}

export async function esperarHuellaDelAutocompletado(signal: AbortSignal): Promise<boolean> {
  if (!autocompletadoConHuellaPosible()) return false;
  if (!(await PublicKeyCredential.isConditionalMediationAvailable())) return false;

  const auth = clienteMaun().auth;
  const { data, error } = await auth.passkey.startAuthentication();
  if (error) return false;

  const { challenge, rpId, timeout, userVerification } = data.options;
  let credencial: Credential | null;
  try {
    credencial = await navigator.credentials.get({
      mediation: 'conditional',
      publicKey: PublicKeyCredential.parseRequestOptionsFromJSON({
        challenge,
        rpId,
        timeout,
        userVerification,
      }),
      signal,
    });
  } catch {
    return false;
  }
  if (!(credencial instanceof PublicKeyCredential)) return false;

  const respuesta = credencial.toJSON();
  if (!('signature' in respuesta.response)) return false;
  const { clientDataJSON, authenticatorData, signature, userHandle } = respuesta.response;
  const modalidad = credencial.authenticatorAttachment;

  const { error: alVerificar } = await auth.passkey.verifyAuthentication({
    challengeId: data.challenge_id,
    credential: {
      id: respuesta.id,
      rawId: respuesta.rawId,
      type: 'public-key',
      clientExtensionResults: {},
      ...(modalidad === 'platform' || modalidad === 'cross-platform'
        ? { authenticatorAttachment: modalidad }
        : {}),
      response: {
        clientDataJSON,
        authenticatorData,
        signature,
        ...(userHandle === undefined ? {} : { userHandle }),
      },
    },
  });
  if (alVerificar) throw alVerificar;
  return true;
}
