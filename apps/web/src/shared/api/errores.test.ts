import { describe, expect, it } from 'vitest';

import {
  codigoDeAcceso,
  errorDelEnlace,
  esAltaRepetida,
  esFalloDeRed,
  mensajeDeAcceso,
  RechazoDeAcceso,
} from './errores';

function deAuth(codigo: string, mensaje: string, estado = 400): unknown {
  return Object.assign(new Error(mensaje), { name: 'AuthApiError', code: codigo, status: estado });
}

function conNombre(nombre: string, mensaje: string, extra: Record<string, unknown> = {}): unknown {
  return Object.assign(new Error(mensaje), { name: nombre, ...extra });
}

const EN_INGLES = /invalid|login|credentials|expired|already|password|session|browser|webauthn/i;

describe('los rechazos del acceso, en castellano de taller', () => {
  it.each([
    ['invalid_credentials', 'Invalid login credentials', 'El mail o la contraseña no coinciden.'],
    ['email_not_confirmed', 'Email not confirmed', 'Todavía no confirmaste el mail.'],
    ['user_already_exists', 'User already registered', 'Ya hay una cuenta con ese mail.'],
    ['email_exists', 'Email address already exists', 'Ya hay una cuenta con ese mail.'],
    ['otp_expired', 'Email link is invalid or has expired', 'El enlace venció o ya se usó'],
    ['weak_password', 'Password should be at least 6 characters.', 'La contraseña es muy débil'],
    ['same_password', 'New password should be different', 'La contraseña nueva es igual'],
    ['over_email_send_rate_limit', 'email rate limit exceeded', 'Esperá un rato y volvé a pedirlo'],
    ['passkey_disabled', 'Passkeys are disabled', 'La huella todavía no está habilitada'],
  ])('%s', (codigo, enIngles, esperado) => {
    const mensaje = mensajeDeAcceso(deAuth(codigo, enIngles));
    expect(mensaje).toContain(esperado);
    expect(mensaje).not.toContain(enIngles);
  });

  it('un rechazo sin traducción nunca muestra el texto en inglés: dice el código para pedir ayuda', () => {
    const mensaje = mensajeDeAcceso(deAuth('captcha_failed', 'Captcha protection failed'));
    expect(mensaje).toBe('No pudimos completar la operación (captcha_failed). Probá de nuevo.');
  });

  it('un error cualquiera de JavaScript tampoco deja pasar su mensaje', () => {
    expect(mensajeDeAcceso(new Error('Something exploded in the SDK'))).toBe(
      'No pudimos completar la operación. Probá de nuevo.',
    );
  });

  it('sin señal lo dice como falta de conexión', () => {
    expect(mensajeDeAcceso(new TypeError('Failed to fetch'))).toBe(
      'No hay conexión con el servidor. Probá de nuevo cuando vuelva la señal.',
    );
  });

  it('una función de borde que no se alcanza también es falta de conexión', () => {
    expect(
      esFalloDeRed(
        conNombre('FunctionsFetchError', 'Failed to send a request to the Edge Function'),
      ),
    ).toBe(true);
    expect(esFalloDeRed(conNombre('FunctionsHttpError', 'Edge Function returned a non-2xx'))).toBe(
      false,
    );
  });

  it('la sesión que ya no existe', () => {
    expect(mensajeDeAcceso(conNombre('AuthSessionMissingError', 'Auth session missing!'))).toBe(
      'Tu sesión se cerró. Entrá de nuevo con tu mail y tu contraseña.',
    );
  });

  it('el enlace abierto en otro navegador, aunque llegue sin código', () => {
    expect(
      mensajeDeAcceso(
        conNombre('AuthPKCECodeVerifierMissingError', 'PKCE code verifier not found'),
      ),
    ).toContain('Pedí uno nuevo desde este dispositivo');
  });

  it('el enlace vencido que vuelve en la URL trae el código en los detalles', () => {
    const error = conNombre(
      'AuthImplicitGrantRedirectError',
      'Email link is invalid or has expired',
      {
        details: { error: 'access_denied', code: 'otp_expired' },
      },
    );
    expect(codigoDeAcceso(error)).toBe('otp_expired');
    expect(mensajeDeAcceso(error)).toContain('El enlace venció o ya se usó');
  });

  it('la huella cancelada y la ya registrada', () => {
    const cancelada = conNombre(
      'NotAllowedError',
      'The operation either timed out or was not allowed',
      {
        code: 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY',
      },
    );
    expect(mensajeDeAcceso(cancelada)).toContain('La huella se canceló o tardó demasiado');

    const repetida = conNombre('InvalidStateError', 'The authenticator was previously registered', {
      code: 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED',
    });
    expect(mensajeDeAcceso(repetida)).toBe(
      'Este dispositivo ya tiene la huella registrada para tu cuenta.',
    );
  });

  it('el navegador sin WebAuthn', () => {
    expect(
      mensajeDeAcceso(conNombre('AuthUnknownError', 'Browser does not support WebAuthn')),
    ).toBe('Este navegador no puede usar la huella. Entrá con tu contraseña.');
  });

  it('el alta repetida que la app detecta sola se traduce igual', () => {
    expect(mensajeDeAcceso(new RechazoDeAcceso('user_already_exists'))).toContain(
      'Ya hay una cuenta con ese mail.',
    );
  });

  it('ninguna traducción está en inglés', () => {
    for (const [codigo, nombre] of [
      ['invalid_credentials', 'AuthApiError'],
      ['session_not_found', 'AuthApiError'],
      ['', 'AuthSessionMissingError'],
      ['', 'NotAllowedError'],
    ] as const) {
      expect(mensajeDeAcceso(conNombre(nombre, 'x', { code: codigo }))).not.toMatch(EN_INGLES);
    }
  });

  it('los rechazos de negocio de la base siguen diciendo su mensaje y su camino', () => {
    const rechazo = {
      code: 'MN003',
      message: 'El cliente tiene proyectos vivos.',
      hint: 'Borralos antes.',
    };
    expect(mensajeDeAcceso(rechazo)).toBe('El cliente tiene proyectos vivos. Borralos antes.');
  });
});

describe('el error que trae el enlace del correo en la URL', () => {
  it('con PKCE viene en la query', () => {
    expect(
      errorDelEnlace(
        'https://numa-dashboard.netlify.app/acceso?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
      ),
    ).toBe(
      'El enlace venció o ya se usó: cada enlace sirve una sola vez y por un rato. Pedí uno nuevo.',
    );
  });

  it('también lo lee del hash', () => {
    expect(
      errorDelEnlace('http://localhost:5173/acceso#error=access_denied&error_code=otp_expired'),
    ).toContain('El enlace venció');
  });

  it('un código que no conocemos no se muestra en inglés', () => {
    expect(
      errorDelEnlace('http://localhost:5173/acceso?error=server_error&error_description=Boom'),
    ).toBe('El enlace del correo no sirvió. Pedí uno nuevo desde este dispositivo.');
  });

  it('sin error no dice nada', () => {
    expect(errorDelEnlace('http://localhost:5173/acceso?code=abc')).toBeUndefined();
  });
});

describe('el alta de un mail que ya tenía cuenta', () => {
  it('Supabase no da error: devuelve un usuario sin identidades', () => {
    expect(esAltaRepetida({ identities: [] })).toBe(true);
    expect(esAltaRepetida({ identities: [{ provider: 'email' }] })).toBe(false);
    expect(esAltaRepetida(null)).toBe(false);
    expect(esAltaRepetida({})).toBe(false);
  });
});
