import { CLAVE_DE_SESION } from '@maun/db';

import { leerEnv } from '@/shared/config';

import { clienteMaun } from './cliente';
import { esAltaRepetida, esFalloDeRed, RechazoDeAcceso } from './errores';

export interface Claims {
  usuarioId: string;
  email: string;
  nombre: string;
  foto: string;
}

interface SesionMinima {
  user: { id: string; email?: string; user_metadata?: unknown };
}

const BUCKET_DE_FOTOS = 'fotos-de-perfil';

function textoDeLosMetadatos(metadatos: unknown, clave: 'nombre' | 'foto'): string {
  if (typeof metadatos !== 'object' || metadatos === null || !(clave in metadatos)) return '';
  const valor = (metadatos as Record<string, unknown>)[clave];
  return typeof valor === 'string' ? valor : '';
}

function nombreDeLosMetadatos(metadatos: unknown): string {
  return textoDeLosMetadatos(metadatos, 'nombre');
}

function fotoDeLosMetadatos(metadatos: unknown): string {
  const foto = textoDeLosMetadatos(metadatos, 'foto');
  if (foto === '') return '';
  const base = leerEnv(import.meta.env).VITE_SUPABASE_URL.replace(/\/+$/, '');
  return foto.startsWith(`${base}/storage/v1/object/public/${BUCKET_DE_FOTOS}/`) ? foto : '';
}

function claimsDeSesion(sesion: SesionMinima | null): Claims | undefined {
  if (!sesion) return undefined;
  return {
    usuarioId: sesion.user.id,
    email: sesion.user.email ?? '',
    nombre: nombreDeLosMetadatos(sesion.user.user_metadata),
    foto: fotoDeLosMetadatos(sesion.user.user_metadata),
  };
}

function sesionGuardada(): Claims | undefined {
  try {
    const crudo = globalThis.localStorage.getItem(CLAVE_DE_SESION);
    if (crudo === null) return undefined;
    const guardado = JSON.parse(crudo) as {
      user?: { id?: unknown; email?: unknown; user_metadata?: unknown };
    };
    const id = guardado.user?.id;
    if (typeof id !== 'string') return undefined;
    const email = guardado.user?.email;
    return {
      usuarioId: id,
      email: typeof email === 'string' ? email : '',
      nombre: nombreDeLosMetadatos(guardado.user?.user_metadata),
      foto: fotoDeLosMetadatos(guardado.user?.user_metadata),
    };
  } catch {
    return undefined;
  }
}

export function claimsGuardados(): Claims | undefined {
  return sesionGuardada();
}

export async function leerClaims(): Promise<Claims | undefined> {
  try {
    const { data, error } = await clienteMaun().auth.getClaims();
    if (error) throw error;
    if (!data) return undefined;
    const { sub, email } = data.claims;
    const guardada = sesionGuardada();
    return {
      usuarioId: sub,
      email: typeof email === 'string' ? email : '',
      nombre:
        guardada?.usuarioId === sub
          ? guardada.nombre
          : nombreDeLosMetadatos(data.claims.user_metadata),
      foto:
        guardada?.usuarioId === sub ? guardada.foto : fotoDeLosMetadatos(data.claims.user_metadata),
    };
  } catch (error) {
    if (!esFalloDeRed(error)) throw error;
    const { data } = await clienteMaun().auth.getSession();
    return claimsDeSesion(data.session) ?? sesionGuardada();
  }
}

export type CambioDeSesion = 'cerrada' | 'recuperacion' | 'otro';

export function escucharSesion(
  alCambiar: (claims: Claims | undefined, cambio: CambioDeSesion) => void,
): () => void {
  const { data } = clienteMaun().auth.onAuthStateChange((evento, sesion) => {
    const cambio: CambioDeSesion =
      evento === 'SIGNED_OUT'
        ? 'cerrada'
        : evento === 'PASSWORD_RECOVERY'
          ? 'recuperacion'
          : 'otro';
    alCambiar(claimsDeSesion(sesion), cambio);
  });
  return () => {
    data.subscription.unsubscribe();
  };
}

export async function entrar(email: string, contrasena: string): Promise<void> {
  const { error } = await clienteMaun().auth.signInWithPassword({ email, password: contrasena });
  if (error) throw error;
}

export async function crearCuenta(
  email: string,
  contrasena: string,
  volverA: string,
): Promise<void> {
  const { data, error } = await clienteMaun().auth.signUp({
    email,
    password: contrasena,
    options: { emailRedirectTo: volverA },
  });
  if (error) throw error;
  if (esAltaRepetida(data.user)) throw new RechazoDeAcceso('user_already_exists');
}

export async function reenviarConfirmacion(email: string, volverA: string): Promise<void> {
  const { error } = await clienteMaun().auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: volverA },
  });
  if (error) throw error;
}

export async function pedirRecuperacion(email: string, volverA: string): Promise<void> {
  const { error } = await clienteMaun().auth.resetPasswordForEmail(email, { redirectTo: volverA });
  if (error) throw error;
}

export async function cambiarContrasena(contrasena: string): Promise<void> {
  const { error } = await clienteMaun().auth.updateUser({ password: contrasena });
  if (error) throw error;
}

export async function guardarNombreDeLaPersona(nombre: string): Promise<void> {
  const { error } = await clienteMaun().auth.updateUser({ data: { nombre } });
  if (error) throw error;
}

export async function subirFotoDeLaPersona(usuarioId: string, foto: Blob): Promise<string> {
  const bucket = clienteMaun().storage.from(BUCKET_DE_FOTOS);
  const ruta = `${usuarioId}/foto`;
  const { error } = await bucket.upload(ruta, foto, { upsert: true, contentType: foto.type });
  if (error) throw error;
  const { data } = bucket.getPublicUrl(ruta, { cacheNonce: String(Date.now()) });
  const { error: errorDeLaCuenta } = await clienteMaun().auth.updateUser({
    data: { foto: data.publicUrl },
  });
  if (errorDeLaCuenta) throw errorDeLaCuenta;
  return data.publicUrl;
}

export async function salir(): Promise<void> {
  const { error } = await clienteMaun().auth.signOut();
  if (!error) return;
  if (!esFalloDeRed(error)) throw error;
  const { error: errorLocal } = await clienteMaun().auth.signOut({ scope: 'local' });
  if (errorLocal) throw errorLocal;
}
