import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Huella = typeof import('./huella');

const AHORA = Date.UTC(2026, 8, 13, 15, 0, 0);
const SEGUNDO = 1000;
const MINUTO = 60 * SEGUNDO;

class CredencialDePrueba {
  readonly id: string;

  constructor(id: string) {
    this.id = id;
  }
}

async function modulo(): Promise<Huella> {
  vi.resetModules();
  return import('./huella');
}

let dejarDeVigilar: (() => void) | undefined;

async function moduloVigilado(): Promise<Huella> {
  const huella = await modulo();
  dejarDeVigilar = huella.vigilarElBloqueo();
  return huella;
}

let visibilidad: DocumentVisibilityState = 'visible';

function cambiarVisibilidad(estado: DocumentVisibilityState): void {
  visibilidad = estado;
  document.dispatchEvent(new Event('visibilitychange'));
}

function guardarMarca(marca: Record<string, unknown>): void {
  localStorage.setItem(
    'maun:bloqueo',
    JSON.stringify({ usuarioId: 'ana', credencial: null, ...marca }),
  );
}

function marcaGuardada(): Record<string, unknown> {
  return JSON.parse(localStorage.getItem('maun:bloqueo') ?? 'null') as Record<string, unknown>;
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('PublicKeyCredential', CredencialDePrueba);
  vi.useFakeTimers({ now: AHORA, toFake: ['Date'] });
  visibilidad = 'visible';
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => visibilidad,
  });
});

afterEach(() => {
  dejarDeVigilar?.();
  dejarDeVigilar = undefined;
  Reflect.deleteProperty(document, 'visibilityState');
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function conCredenciales(get: (opciones: CredentialRequestOptions) => Promise<unknown>) {
  Object.defineProperty(navigator, 'credentials', { value: { get }, configurable: true });
}

describe('la marca de bloqueo de este dispositivo', () => {
  it('se activa por usuario y no vale para otro', async () => {
    const huella = await modulo();
    huella.activarBloqueo('ana', null);

    expect(huella.bloqueoDe('ana')).toMatchObject({ usuarioId: 'ana', credencial: null });
    expect(huella.bloqueoDe('otro')).toBeNull();
  });

  it('activarla no bloquea la apertura en curso: el que la activó ya demostró que es él', async () => {
    const huella = await modulo();
    const avisos = vi.fn();
    window.addEventListener('maun:bloqueo-cambio', avisos);

    huella.activarBloqueo('ana', null);

    expect(avisos).toHaveBeenCalled();
    expect(huella.appBloqueada('ana')).toBe(false);
    expect(huella.bloqueoDe('ana')?.desbloqueadaEn).toBe(AHORA);
    window.removeEventListener('maun:bloqueo-cambio', avisos);
  });

  it('anota la credencial que confirmó la huella sin perder los momentos', async () => {
    const huella = await modulo();
    huella.activarBloqueo('ana', null);
    huella.anotarCredencial('ana', 'Y3JlZGVuY2lhbA');

    expect(huella.bloqueoDe('ana')).toMatchObject({
      credencial: 'Y3JlZGVuY2lhbA',
      desbloqueadaEn: AHORA,
    });
  });

  it('olvidarla la borra del almacenamiento', async () => {
    const huella = await modulo();
    huella.activarBloqueo('ana', 'abc');
    huella.olvidarBloqueo();

    expect(localStorage.getItem(huella.CLAVE_DEL_BLOQUEO)).toBeNull();
    expect(huella.bloqueoDe('ana')).toBeNull();
  });

  it('una marca rota no bloquea nada', async () => {
    localStorage.setItem('maun:bloqueo', '{no es json');
    const huella = await modulo();
    expect(huella.bloqueoDe('ana')).toBeNull();
    expect(huella.appBloqueada('ana')).toBe(false);
  });

  it('lo preguntado se recuerda por usuario', async () => {
    const huella = await modulo();
    expect(huella.yaSePreguntoPorLaHuella('ana')).toBe(false);
    huella.anotarPreguntaPorLaHuella('ana');
    huella.anotarPreguntaPorLaHuella('ana');

    expect(huella.yaSePreguntoPorLaHuella('ana')).toBe(true);
    expect(huella.yaSePreguntoPorLaHuella('beto')).toBe(false);
    expect(JSON.parse(localStorage.getItem(huella.CLAVE_DE_LAS_PREGUNTAS) ?? '')).toEqual(['ana']);
  });

  it('entrar con la contraseña deja la apertura desbloqueada', async () => {
    const huella = await modulo();
    expect(huella.entroRecienConContrasena()).toBe(false);
    huella.anotarIngresoConContrasena();
    expect(huella.entroRecienConContrasena()).toBe(true);
  });
});

describe('cuándo se abre sin huella', () => {
  it('sin ningún momento guardado, la pide', async () => {
    const { abreSinHuella } = await modulo();
    expect(abreSinHuella({ desbloqueadaEn: null, salioEn: null }, AHORA, 'navigate')).toBe(false);
    expect(abreSinHuella({ desbloqueadaEn: null, salioEn: null }, AHORA, 'reload')).toBe(false);
  });

  it('dentro del minuto desde la última vez adentro no la pide, pasado el minuto sí', async () => {
    const { abreSinHuella } = await modulo();
    const hace = (ms: number) => AHORA - ms;

    expect(
      abreSinHuella({ desbloqueadaEn: hace(5 * SEGUNDO), salioEn: null }, AHORA, 'navigate'),
    ).toBe(true);
    expect(abreSinHuella({ desbloqueadaEn: hace(MINUTO), salioEn: null }, AHORA, 'navigate')).toBe(
      false,
    );
    expect(
      abreSinHuella(
        { desbloqueadaEn: hace(60 * MINUTO), salioEn: hace(30 * SEGUNDO) },
        AHORA,
        'navigate',
      ),
    ).toBe(true);
    expect(
      abreSinHuella(
        { desbloqueadaEn: hace(60 * MINUTO), salioEn: hace(2 * MINUTO) },
        AHORA,
        'navigate',
      ),
    ).toBe(false);
  });

  it('con el reloj atrasado respecto del momento guardado, la pide', async () => {
    const { abreSinHuella } = await modulo();
    expect(abreSinHuella({ desbloqueadaEn: AHORA + MINUTO, salioEn: null }, AHORA, 'reload')).toBe(
      false,
    );
  });

  it('una recarga de una apertura que nunca salió a segundo plano no la pide, con un tope', async () => {
    const { abreSinHuella, TOPE_DE_UNA_RECARGA_MS } = await modulo();
    const sinSalir = { desbloqueadaEn: AHORA - 5 * MINUTO, salioEn: null };

    expect(abreSinHuella(sinSalir, AHORA, 'reload')).toBe(true);
    expect(abreSinHuella(sinSalir, AHORA, 'navigate')).toBe(false);
    expect(abreSinHuella(sinSalir, AHORA, undefined)).toBe(false);
    expect(
      abreSinHuella(
        { desbloqueadaEn: AHORA - TOPE_DE_UNA_RECARGA_MS, salioEn: null },
        AHORA,
        'reload',
      ),
    ).toBe(false);
  });

  it('una "recarga" de algo que ya había salido a segundo plano no se salva: decide el minuto', async () => {
    const { abreSinHuella } = await modulo();
    expect(
      abreSinHuella(
        { desbloqueadaEn: AHORA - 5 * MINUTO, salioEn: AHORA - 2 * MINUTO },
        AHORA,
        'reload',
      ),
    ).toBe(false);
  });
});

describe('la apertura, contra el reloj', () => {
  it('abrir a los segundos de haber estado adentro no bloquea', async () => {
    guardarMarca({ desbloqueadaEn: AHORA - 5 * SEGUNDO });
    const huella = await modulo();
    expect(huella.appBloqueada('ana')).toBe(false);
  });

  it('un arranque en frío pasado el minuto bloquea', async () => {
    guardarMarca({ desbloqueadaEn: AHORA - 60 * MINUTO, salioEn: AHORA - 2 * MINUTO });
    const huella = await modulo();
    expect(huella.appBloqueada('ana')).toBe(true);
  });

  it('la marca sin momentos, la de antes de este cambio, bloquea', async () => {
    guardarMarca({});
    const huella = await modulo();
    expect(huella.appBloqueada('ana')).toBe(true);
  });

  it('desbloquear anota el momento y abre', async () => {
    guardarMarca({});
    const huella = await modulo();
    expect(huella.appBloqueada('ana')).toBe(true);

    vi.setSystemTime(AHORA + 10 * SEGUNDO);
    huella.marcarDesbloqueada();

    expect(huella.appBloqueada('ana')).toBe(false);
    expect(marcaGuardada().desbloqueadaEn).toBe(AHORA + 10 * SEGUNDO);
  });
});

describe('el segundo plano', () => {
  it('al ocultarse, estando adentro, anota el momento', async () => {
    guardarMarca({ desbloqueadaEn: AHORA - 5 * SEGUNDO });
    const huella = await moduloVigilado();
    expect(huella.appBloqueada('ana')).toBe(false);

    vi.setSystemTime(AHORA + 30 * SEGUNDO);
    cambiarVisibilidad('hidden');

    expect(marcaGuardada().salioEn).toBe(AHORA + 30 * SEGUNDO);
  });

  it('bloqueada, ocultarse no renueva nada', async () => {
    guardarMarca({ desbloqueadaEn: AHORA - 60 * MINUTO });
    const huella = await moduloVigilado();
    expect(huella.appBloqueada('ana')).toBe(true);

    cambiarVisibilidad('hidden');

    expect(marcaGuardada()).toEqual({
      usuarioId: 'ana',
      credencial: null,
      desbloqueadaEn: AHORA - 60 * MINUTO,
    });
  });

  it('volver antes del minuto no bloquea; volver después, sí, y avisa', async () => {
    guardarMarca({ desbloqueadaEn: AHORA - 5 * SEGUNDO });
    const huella = await moduloVigilado();
    expect(huella.appBloqueada('ana')).toBe(false);
    const avisos = vi.fn();
    window.addEventListener('maun:bloqueo-cambio', avisos);

    cambiarVisibilidad('hidden');
    vi.setSystemTime(AHORA + 40 * SEGUNDO);
    cambiarVisibilidad('visible');
    expect(huella.appBloqueada('ana')).toBe(false);
    expect(avisos).not.toHaveBeenCalled();

    cambiarVisibilidad('hidden');
    vi.setSystemTime(AHORA + 40 * SEGUNDO + MINUTO);
    cambiarVisibilidad('visible');
    expect(huella.appBloqueada('ana')).toBe(true);
    expect(avisos).toHaveBeenCalledTimes(1);

    window.removeEventListener('maun:bloqueo-cambio', avisos);
  });

  it('otro aviso de oculta sin haber vuelto a la vista no renueva el momento', async () => {
    guardarMarca({ desbloqueadaEn: AHORA - 5 * SEGUNDO });
    const huella = await moduloVigilado();
    expect(huella.appBloqueada('ana')).toBe(false);

    cambiarVisibilidad('hidden');
    vi.setSystemTime(AHORA + 10 * MINUTO);
    cambiarVisibilidad('hidden');

    expect(marcaGuardada().salioEn).toBe(AHORA);
  });

  it('cerrar la app que ya estaba en segundo plano no renueva el momento', async () => {
    guardarMarca({ desbloqueadaEn: AHORA - 5 * SEGUNDO });
    const huella = await moduloVigilado();
    expect(huella.appBloqueada('ana')).toBe(false);

    cambiarVisibilidad('hidden');
    vi.setSystemTime(AHORA + 60 * MINUTO);
    window.dispatchEvent(new Event('pagehide'));

    expect(marcaGuardada().salioEn).toBe(AHORA);
  });

  it('descargarse estando a la vista, sin aviso de visibilidad, sí lo renueva', async () => {
    guardarMarca({ desbloqueadaEn: AHORA - 5 * SEGUNDO });
    const huella = await moduloVigilado();
    expect(huella.appBloqueada('ana')).toBe(false);

    vi.setSystemTime(AHORA + 20 * MINUTO);
    window.dispatchEvent(new Event('pagehide'));

    expect(marcaGuardada().salioEn).toBe(AHORA + 20 * MINUTO);
  });
});

describe('la ceremonia local de la huella', () => {
  it('pide la verificación del usuario con un desafío propio, sin mediación y sin servidor', async () => {
    const huella = await modulo();
    const get = vi.fn(() => Promise.resolve(new CredencialDePrueba('Y3JlZA')));
    conCredenciales(get);

    const resultado = await huella.pedirHuella(null, new AbortController().signal);

    expect(resultado).toEqual({ tipo: 'confirmada', credencial: 'Y3JlZA' });
    expect(get).toHaveBeenCalledTimes(1);
    const [opciones] = get.mock.calls[0] as unknown as [CredentialRequestOptions];
    expect(opciones.mediation).toBeUndefined();
    expect(opciones.publicKey?.userVerification).toBe('required');
    expect((opciones.publicKey?.challenge as Uint8Array).byteLength).toBe(32);
    expect(opciones.publicKey?.allowCredentials).toBeUndefined();
    expect(opciones.publicKey?.rpId).toBeUndefined();
  });

  it('con la credencial conocida la pide directo, solo al autenticador del teléfono', async () => {
    const huella = await modulo();
    const get = vi.fn(() => Promise.resolve(new CredencialDePrueba('AQID')));
    conCredenciales(get);

    await huella.pedirHuella('AQID', new AbortController().signal);

    const [opciones] = get.mock.calls[0] as unknown as [CredentialRequestOptions];
    const [permitida] = opciones.publicKey?.allowCredentials ?? [];
    expect(permitida?.transports).toEqual(['internal']);
    expect(Array.from(permitida?.id as Uint8Array)).toEqual([1, 2, 3]);
  });

  it('dos pedidos no repiten el desafío', async () => {
    const huella = await modulo();
    const get = vi.fn(() => Promise.resolve(new CredencialDePrueba('x')));
    conCredenciales(get);

    await huella.pedirHuella(null, new AbortController().signal);
    await huella.pedirHuella(null, new AbortController().signal);

    const desafios = (get.mock.calls as unknown as [CredentialRequestOptions][]).map(([op]) =>
      Array.from(op.publicKey?.challenge as Uint8Array).join(','),
    );
    expect(desafios[0]).not.toBe(desafios[1]);
  });

  it('descartar el pedido es cancelar, y lleva a la contraseña', async () => {
    const huella = await modulo();
    conCredenciales(() => Promise.reject(new DOMException('cancelado', 'NotAllowedError')));

    expect(await huella.pedirHuella(null, new AbortController().signal)).toEqual({
      tipo: 'cancelada',
    });
  });

  it('un sensor que no responde o un navegador que no puede es huella no disponible', async () => {
    const huella = await modulo();
    conCredenciales(() => Promise.reject(new DOMException('no', 'NotSupportedError')));

    expect(await huella.pedirHuella(null, new AbortController().signal)).toEqual({
      tipo: 'no-disponible',
    });
  });

  it('sin WebAuthn en el navegador no hay huella', async () => {
    const huella = await modulo();
    vi.unstubAllGlobals();

    expect(await huella.pedirHuella(null, new AbortController().signal)).toEqual({
      tipo: 'no-disponible',
    });
    expect(await huella.huellaDisponible()).toBe(false);
  });
});
