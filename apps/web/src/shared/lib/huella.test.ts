import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Huella = typeof import('./huella');

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

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('PublicKeyCredential', CredencialDePrueba);
});

afterEach(() => {
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

    expect(huella.bloqueoDe('ana')).toEqual({ usuarioId: 'ana', credencial: null });
    expect(huella.bloqueoDe('otro')).toBeNull();
  });

  it('activarla no bloquea la apertura en curso: el que la activó ya demostró que es él', async () => {
    const huella = await modulo();
    const avisos = vi.fn();
    window.addEventListener('maun:bloqueo-cambio', avisos);

    huella.activarBloqueo('ana', null);

    expect(avisos).toHaveBeenCalled();
    window.removeEventListener('maun:bloqueo-cambio', avisos);
  });

  it('anota la credencial que confirmó la huella para pedirla directo la próxima vez', async () => {
    const huella = await modulo();
    huella.activarBloqueo('ana', null);
    huella.anotarCredencial('ana', 'Y3JlZGVuY2lhbA');

    expect(huella.bloqueoDe('ana')?.credencial).toBe('Y3JlZGVuY2lhbA');
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
