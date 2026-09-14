import { useSyncExternalStore } from 'react';

export const CLAVE_DEL_BLOQUEO = 'maun:bloqueo';
export const CLAVE_DE_LAS_PREGUNTAS = 'maun:huella-preguntada';
export const TOPE_DE_UNA_RECARGA_MS = 15_000;

const EVENTO_DEL_BLOQUEO = 'maun:bloqueo-cambio';
const ESPERA_DE_LA_HUELLA_MS = 60_000;
const BYTES_DEL_DESAFIO = 32;
const NO_DISPONIBLE = new Set([
  'NotSupportedError',
  'SecurityError',
  'InvalidStateError',
  'ConstraintError',
  'UnknownError',
]);

export interface BloqueoDelDispositivo {
  usuarioId: string;
  credencial: string | null;
  desbloqueadaEn: number | null;
  salioEn: number | null;
}

export type SellosDelBloqueo = Pick<BloqueoDelDispositivo, 'desbloqueadaEn' | 'salioEn'>;

export type ResultadoDeLaHuella =
  { tipo: 'confirmada'; credencial: string } | { tipo: 'cancelada' } | { tipo: 'no-disponible' };

type Apertura = 'sin-decidir' | 'abierta' | 'cerrada';

const INICIO_DE_LA_APERTURA = Date.now();

let apertura: Apertura = 'sin-decidir';
let entroConContrasena = false;
let ocultaDesde: number | null = null;
let salioAbierta = false;

function almacen(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function avisar(): void {
  globalThis.dispatchEvent(new Event(EVENTO_DEL_BLOQUEO));
}

function instante(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : null;
}

function leerBloqueo(): BloqueoDelDispositivo | null {
  try {
    const crudo = almacen()?.getItem(CLAVE_DEL_BLOQUEO) ?? null;
    if (crudo === null) return null;
    const valor: unknown = JSON.parse(crudo);
    if (typeof valor !== 'object' || valor === null) return null;
    const { usuarioId, credencial, desbloqueadaEn, salioEn } = valor as Record<string, unknown>;
    if (typeof usuarioId !== 'string') return null;
    return {
      usuarioId,
      credencial: typeof credencial === 'string' ? credencial : null,
      desbloqueadaEn: instante(desbloqueadaEn),
      salioEn: instante(salioEn),
    };
  } catch {
    return null;
  }
}

function guardarBloqueo(bloqueo: BloqueoDelDispositivo): void {
  try {
    almacen()?.setItem(CLAVE_DEL_BLOQUEO, JSON.stringify(bloqueo));
  } catch {
    return;
  }
}

function sellar(sellos: Partial<SellosDelBloqueo>): void {
  const bloqueo = leerBloqueo();
  if (bloqueo !== null) guardarBloqueo({ ...bloqueo, ...sellos });
}

export function abreSinHuella(
  sellos: SellosDelBloqueo,
  ahora: number,
  tipoDeNavegacion: string | undefined,
  descartada: boolean,
): boolean {
  if (tipoDeNavegacion !== 'reload' || descartada) return false;
  const ultimaVezAdentro = Math.max(
    sellos.desbloqueadaEn ?? Number.NEGATIVE_INFINITY,
    sellos.salioEn ?? Number.NEGATIVE_INFINITY,
  );
  const transcurrido = ahora - ultimaVezAdentro;
  return transcurrido >= 0 && transcurrido < TOPE_DE_UNA_RECARGA_MS;
}

function tipoDeNavegacion(): string | undefined {
  if (typeof PerformanceNavigationTiming === 'undefined') return undefined;
  const [entrada] = globalThis.performance.getEntriesByType('navigation');
  return entrada instanceof PerformanceNavigationTiming ? entrada.type : undefined;
}

function fueDescartada(): boolean {
  return 'wasDiscarded' in document && document.wasDiscarded === true;
}

export function bloqueoDe(usuarioId: string): BloqueoDelDispositivo | null {
  const bloqueo = leerBloqueo();
  return bloqueo?.usuarioId === usuarioId ? bloqueo : null;
}

export function appBloqueada(usuarioId: string): boolean {
  const bloqueo = bloqueoDe(usuarioId);
  if (bloqueo === null) return false;
  if (apertura === 'sin-decidir') {
    apertura = abreSinHuella(bloqueo, INICIO_DE_LA_APERTURA, tipoDeNavegacion(), fueDescartada())
      ? 'abierta'
      : 'cerrada';
  }
  return apertura === 'cerrada';
}

export function activarBloqueo(usuarioId: string, credencial: string | null): void {
  apertura = 'abierta';
  salioAbierta = false;
  guardarBloqueo({ usuarioId, credencial, desbloqueadaEn: Date.now(), salioEn: null });
  avisar();
}

export function anotarCredencial(usuarioId: string, credencial: string): void {
  const bloqueo = bloqueoDe(usuarioId);
  if (!bloqueo || bloqueo.credencial === credencial) return;
  guardarBloqueo({ ...bloqueo, credencial });
}

export function olvidarBloqueo(): void {
  try {
    almacen()?.removeItem(CLAVE_DEL_BLOQUEO);
  } finally {
    avisar();
  }
}

export function marcarDesbloqueada(): void {
  salioAbierta = false;
  sellar({ desbloqueadaEn: Date.now() });
  if (apertura === 'abierta') return;
  apertura = 'abierta';
  avisar();
}

export function anotarIngresoConContrasena(): void {
  entroConContrasena = true;
  marcarDesbloqueada();
}

export function entroRecienConContrasena(): boolean {
  return entroConContrasena;
}

function alOcultarse(): void {
  if (ocultaDesde !== null) return;
  ocultaDesde = Date.now();
  if (apertura !== 'abierta') return;
  salioAbierta = true;
  sellar({ salioEn: ocultaDesde });
}

function alVolver(): void {
  const saliaAbierta = salioAbierta;
  ocultaDesde = null;
  salioAbierta = false;
  if (apertura !== 'abierta' || !saliaAbierta) return;
  apertura = 'cerrada';
  avisar();
}

export function vigilarElBloqueo(): () => void {
  const alCambiarLaVisibilidad = () => {
    if (document.visibilityState === 'hidden') alOcultarse();
    else alVolver();
  };
  const alDescargarse = () => {
    if (document.visibilityState === 'visible') alOcultarse();
  };
  const alMostrarse = (evento: PageTransitionEvent) => {
    if (evento.persisted) alVolver();
  };
  document.addEventListener('visibilitychange', alCambiarLaVisibilidad);
  globalThis.addEventListener('pagehide', alDescargarse);
  globalThis.addEventListener('pageshow', alMostrarse);
  return () => {
    document.removeEventListener('visibilitychange', alCambiarLaVisibilidad);
    globalThis.removeEventListener('pagehide', alDescargarse);
    globalThis.removeEventListener('pageshow', alMostrarse);
  };
}

function usuariosPreguntados(): string[] {
  try {
    const valor: unknown = JSON.parse(almacen()?.getItem(CLAVE_DE_LAS_PREGUNTAS) ?? '[]');
    return Array.isArray(valor) ? valor.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function yaSePreguntoPorLaHuella(usuarioId: string): boolean {
  return usuariosPreguntados().includes(usuarioId);
}

export function anotarPreguntaPorLaHuella(usuarioId: string): void {
  if (yaSePreguntoPorLaHuella(usuarioId)) return;
  try {
    almacen()?.setItem(
      CLAVE_DE_LAS_PREGUNTAS,
      JSON.stringify([...usuariosPreguntados(), usuarioId]),
    );
  } catch {
    return;
  }
}

function suscribir(avisarAReact: () => void): () => void {
  globalThis.addEventListener(EVENTO_DEL_BLOQUEO, avisarAReact);
  globalThis.addEventListener('storage', avisarAReact);
  return () => {
    globalThis.removeEventListener(EVENTO_DEL_BLOQUEO, avisarAReact);
    globalThis.removeEventListener('storage', avisarAReact);
  };
}

function nunca(): boolean {
  return false;
}

export function useBloqueoActivo(usuarioId: string): boolean {
  return useSyncExternalStore(suscribir, () => bloqueoDe(usuarioId) !== null, nunca);
}

export function useAppBloqueada(usuarioId: string): boolean {
  return useSyncExternalStore(suscribir, () => appBloqueada(usuarioId), nunca);
}

function desdeBase64Url(texto: string): Uint8Array<ArrayBuffer> {
  const base64 = texto.replace(/-/g, '+').replace(/_/g, '/');
  const binario = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
  const bytes = new Uint8Array(binario.length);
  for (let indice = 0; indice < binario.length; indice += 1) {
    bytes[indice] = binario.charCodeAt(indice);
  }
  return bytes;
}

export async function huellaDisponible(): Promise<boolean> {
  if (
    !('PublicKeyCredential' in globalThis) ||
    !('isUserVerifyingPlatformAuthenticatorAvailable' in PublicKeyCredential)
  ) {
    return false;
  }
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export async function pedirHuella(
  credencial: string | null,
  signal: AbortSignal,
): Promise<ResultadoDeLaHuella> {
  if (!('PublicKeyCredential' in globalThis) || !('credentials' in navigator)) {
    return { tipo: 'no-disponible' };
  }
  try {
    const obtenida = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(BYTES_DEL_DESAFIO)),
        userVerification: 'required',
        timeout: ESPERA_DE_LA_HUELLA_MS,
        ...(credencial === null
          ? {}
          : {
              allowCredentials: [
                { type: 'public-key', id: desdeBase64Url(credencial), transports: ['internal'] },
              ],
            }),
      },
      signal,
    });
    return obtenida instanceof PublicKeyCredential
      ? { tipo: 'confirmada', credencial: obtenida.id }
      : { tipo: 'cancelada' };
  } catch (error) {
    const nombre =
      typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      typeof error.name === 'string'
        ? error.name
        : '';
    return !signal.aborted && NO_DISPONIBLE.has(nombre)
      ? { tipo: 'no-disponible' }
      : { tipo: 'cancelada' };
  }
}
