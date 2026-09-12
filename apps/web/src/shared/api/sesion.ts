import { CLAVE_DE_SESION } from '@maun/db';

import { clienteMaun } from './cliente';
import { esFalloDeRed } from './errores';

export interface Claims {
  usuarioId: string;
  email: string;
}

interface SesionMinima {
  user: { id: string; email?: string };
}

function claimsDeSesion(sesion: SesionMinima | null): Claims | undefined {
  if (!sesion) return undefined;
  return { usuarioId: sesion.user.id, email: sesion.user.email ?? '' };
}

function sesionGuardada(): Claims | undefined {
  try {
    const crudo = globalThis.localStorage.getItem(CLAVE_DE_SESION);
    if (crudo === null) return undefined;
    const guardado = JSON.parse(crudo) as { user?: { id?: unknown; email?: unknown } };
    const id = guardado.user?.id;
    if (typeof id !== 'string') return undefined;
    const email = guardado.user?.email;
    return { usuarioId: id, email: typeof email === 'string' ? email : '' };
  } catch {
    return undefined;
  }
}

export async function leerClaims(): Promise<Claims | undefined> {
  try {
    const { data, error } = await clienteMaun().auth.getClaims();
    if (error) throw error;
    if (!data) return undefined;
    const { sub, email } = data.claims;
    return { usuarioId: sub, email: typeof email === 'string' ? email : '' };
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
  const { error } = await clienteMaun().auth.signUp({
    email,
    password: contrasena,
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

export async function salir(): Promise<void> {
  const { error } = await clienteMaun().auth.signOut();
  if (!error) return;
  if (!esFalloDeRed(error)) throw error;
  const { error: errorLocal } = await clienteMaun().auth.signOut({ scope: 'local' });
  if (errorLocal) throw errorLocal;
}
