import { generateKeyPairSync, randomBytes } from 'node:crypto';

import type { CDPSession, Page } from '@playwright/test';

export const CLAVE_DEL_BLOQUEO = 'maun:bloqueo';

export interface TelefonoVirtual {
  cdp: CDPSession;
  autenticador: string;
}

type VentanaConPedidos = Window & { pedidosDeHuella: number; pedidosCondicionales: number };

type VentanaDelBloqueo = Window & { disenosDelBloqueo: string[]; bajadasDelBloqueo: string[] };

type VentanaConRutas = Window & { rutasVistas: string[] };

const REFRESCO_DEL_TOKEN = /\/auth\/v1\/token\?grant_type=refresh_token/;

type VentanaConVisibilidad = Window & {
  cambiarVisibilidad: (estado: DocumentVisibilityState) => void;
};

export async function visibilidadControlable(page: Page): Promise<void> {
  await page.addInitScript(() => {
    let estado: DocumentVisibilityState = 'visible';
    Object.defineProperty(Document.prototype, 'visibilityState', {
      configurable: true,
      get: () => estado,
    });
    Object.defineProperty(Document.prototype, 'hidden', {
      configurable: true,
      get: () => estado === 'hidden',
    });
    (window as unknown as VentanaConVisibilidad).cambiarVisibilidad = (siguiente) => {
      estado = siguiente;
      document.dispatchEvent(new Event('visibilitychange'));
    };
  });
}

export async function aSegundoPlano(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as VentanaConVisibilidad).cambiarVisibilidad('hidden');
  });
}

export async function alFrente(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as VentanaConVisibilidad).cambiarVisibilidad('visible');
  });
}

export async function telefonoConHuella(page: Page, verifica = true): Promise<TelefonoVirtual> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable', { enableUI: false });
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: verifica,
      automaticPresenceSimulation: true,
    },
  });
  return { cdp, autenticador: authenticatorId };
}

export async function registrarHuellaEnElTelefono(
  telefono: TelefonoVirtual,
  usuarioId: string,
): Promise<void> {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  await telefono.cdp.send('WebAuthn.addCredential', {
    authenticatorId: telefono.autenticador,
    credential: {
      credentialId: randomBytes(16).toString('base64'),
      isResidentCredential: true,
      rpId: 'localhost',
      privateKey: privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'),
      userHandle: Buffer.from(usuarioId).toString('base64'),
      signCount: 0,
    },
  });
}

export async function huellaQueVerifica(
  telefono: TelefonoVirtual,
  verifica: boolean,
): Promise<void> {
  await telefono.cdp.send('WebAuthn.setUserVerified', {
    authenticatorId: telefono.autenticador,
    isUserVerified: verifica,
  });
}

export async function credencialesDelTelefono(telefono: TelefonoVirtual): Promise<number> {
  const { credentials } = await telefono.cdp.send('WebAuthn.getCredentials', {
    authenticatorId: telefono.autenticador,
  });
  return credentials.length;
}

export async function contarPedidosDeHuella(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const ventana = window as unknown as VentanaConPedidos;
    ventana.pedidosDeHuella = 0;
    ventana.pedidosCondicionales = 0;
    const original = navigator.credentials.get.bind(navigator.credentials);
    navigator.credentials.get = (opciones?: CredentialRequestOptions) => {
      if (opciones?.mediation === 'conditional') ventana.pedidosCondicionales += 1;
      else ventana.pedidosDeHuella += 1;
      return original(opciones);
    };
  });
}

export async function pedidosDeHuella(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as VentanaConPedidos).pedidosDeHuella);
}

export async function pedidosCondicionales(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as VentanaConPedidos).pedidosCondicionales);
}

export async function presenciaAutomatica(
  telefono: TelefonoVirtual,
  activa: boolean,
): Promise<void> {
  await telefono.cdp.send('WebAuthn.setAutomaticPresenceSimulation', {
    authenticatorId: telefono.autenticador,
    enabled: activa,
  });
}

export async function registrarLaPantallaDeBloqueo(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const ventana = window as unknown as VentanaDelBloqueo;
    ventana.disenosDelBloqueo = [];
    ventana.bajadasDelBloqueo = [];
    const anotar = (lista: string[], valor: string) => {
      if (valor !== '' && lista.at(-1) !== valor) lista.push(valor);
    };
    new MutationObserver(() => {
      const pantalla = document.querySelector('[data-pantalla-de-acceso]');
      const titulo = pantalla?.querySelector('h1')?.textContent ?? '';
      if (!pantalla || !titulo.startsWith('Hola')) return;
      const esperando = [...pantalla.querySelectorAll('p[role="status"]')].some((parrafo) =>
        parrafo.textContent.includes('Esperando la huella'),
      );
      anotar(ventana.disenosDelBloqueo, esperando ? 'huella' : 'formulario');
      anotar(
        ventana.bajadasDelBloqueo,
        pantalla.querySelector('header p')?.textContent.trim() ?? '',
      );
    }).observe(document, { subtree: true, childList: true, characterData: true });
  });
}

export async function disenosDelBloqueo(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as VentanaDelBloqueo).disenosDelBloqueo);
}

export async function bajadasDelBloqueo(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as VentanaDelBloqueo).bajadasDelBloqueo);
}

export async function registrarRutas(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const ventana = window as unknown as VentanaConRutas;
    ventana.rutasVistas = [location.pathname];
    const anotar = () => {
      ventana.rutasVistas.push(location.pathname);
    };
    const empujar = history.pushState.bind(history);
    const reemplazar = history.replaceState.bind(history);
    history.pushState = (...argumentos: Parameters<History['pushState']>) => {
      empujar(...argumentos);
      anotar();
    };
    history.replaceState = (...argumentos: Parameters<History['replaceState']>) => {
      reemplazar(...argumentos);
      anotar();
    };
  });
}

export async function rutasVistas(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as VentanaConRutas).rutasVistas);
}

export interface RefrescoDelToken {
  devolverLaSesion: () => void;
  rechazar: () => void;
}

export async function sesionVencidaConRefrescoControlado(page: Page): Promise<RefrescoDelToken> {
  const guardada = await page.evaluate(() => localStorage.getItem('maun.sesion'));
  if (guardada === null) throw new Error('No hay sesión guardada en el navegador.');
  let modo: 'sin-red' | 'sesion' | 'rechazo' = 'sin-red';

  await page.route(REFRESCO_DEL_TOKEN, (ruta) => {
    if (modo === 'sin-red') return ruta.abort('failed');
    if (modo === 'rechazo') {
      return ruta.fulfill({
        status: 400,
        json: {
          code: 400,
          error_code: 'refresh_token_not_found',
          msg: 'Invalid Refresh Token: Refresh Token Not Found',
        },
      });
    }
    const sesion = JSON.parse(guardada) as Record<string, unknown>;
    return ruta.fulfill({
      json: { ...sesion, expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600 },
    });
  });
  await page.addInitScript(() => {
    const crudo = localStorage.getItem('maun.sesion');
    if (crudo === null) return;
    const sesion = JSON.parse(crudo) as Record<string, unknown>;
    localStorage.setItem(
      'maun.sesion',
      JSON.stringify({ ...sesion, expires_at: Math.floor(Date.now() / 1000) - 3600 }),
    );
  });

  return {
    devolverLaSesion: () => {
      modo = 'sesion';
    },
    rechazar: () => {
      modo = 'rechazo';
    },
  };
}

export async function usuarioDeLaSesion(page: Page): Promise<string> {
  return page.evaluate(() => {
    const guardada = JSON.parse(localStorage.getItem('maun.sesion') ?? 'null') as {
      user: { id: string };
    } | null;
    if (!guardada) throw new Error('No hay sesión guardada en el navegador.');
    return guardada.user.id;
  });
}

export async function activarBloqueoEnElDispositivo(page: Page): Promise<void> {
  await page.evaluate((clave) => {
    const guardada = JSON.parse(localStorage.getItem('maun.sesion') ?? 'null') as {
      user: { id: string };
    } | null;
    if (!guardada) throw new Error('No hay sesión guardada en el navegador.');
    localStorage.setItem(clave, JSON.stringify({ usuarioId: guardada.user.id, credencial: null }));
  }, CLAVE_DEL_BLOQUEO);
}

export async function marcaDeBloqueo(page: Page): Promise<unknown> {
  return page.evaluate(
    (clave) => JSON.parse(localStorage.getItem(clave) ?? 'null') as unknown,
    CLAVE_DEL_BLOQUEO,
  );
}

export async function simularRegistroEnSupabase(page: Page): Promise<() => number> {
  let verificados = 0;
  await page.route('**/auth/v1/passkeys/registration/options', (ruta) =>
    ruta.fulfill({
      json: {
        challenge_id: 'registro-e2e',
        expires_at: Math.floor(Date.now() / 1000) + 300,
        options: {
          rp: { id: 'localhost', name: 'MAUN' },
          user: {
            id: randomBytes(16).toString('base64url'),
            name: 'cuenta-de-prueba',
            displayName: 'Cuenta de prueba',
          },
          challenge: randomBytes(32).toString('base64url'),
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 },
            { type: 'public-key', alg: -257 },
          ],
          timeout: 60000,
          attestation: 'none',
          authenticatorSelection: {
            residentKey: 'required',
            requireResidentKey: true,
            userVerification: 'preferred',
          },
          excludeCredentials: [],
        },
      },
    }),
  );
  await page.route('**/auth/v1/passkeys/registration/verify', (ruta) => {
    verificados += 1;
    return ruta.fulfill({
      json: { id: '00000000-0000-4000-8000-0000000fe2e0', created_at: new Date().toISOString() },
    });
  });
  return () => verificados;
}
