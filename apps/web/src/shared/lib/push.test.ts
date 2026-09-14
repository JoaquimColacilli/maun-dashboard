import { describe, expect, it } from 'vitest';

import { claveComoBytes, datosDeLaSuscripcion, esIphoneOIpad, mismaClave } from './push';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';

describe('esIphoneOIpad', () => {
  it('reconoce el iPhone', () => {
    expect(esIphoneOIpad(IPHONE, 5)).toBe(true);
  });

  it('reconoce el iPad que se presenta como Mac porque tiene pantalla táctil', () => {
    expect(esIphoneOIpad(MAC, 5)).toBe(true);
  });

  it('una Mac sin pantalla táctil y un Android no lo son', () => {
    expect(esIphoneOIpad(MAC, 0)).toBe(false);
    expect(esIphoneOIpad(ANDROID, 5)).toBe(false);
  });
});

describe('claveComoBytes', () => {
  it('lee base64url sin relleno', () => {
    expect([...claveComoBytes('AQID-_8')]).toEqual([1, 2, 3, 0xfb, 0xff]);
  });
});

describe('mismaClave', () => {
  it('compara la clave con la que se suscribió el navegador', () => {
    const clave = claveComoBytes('AQID');
    expect(mismaClave(new Uint8Array([1, 2, 3]).buffer, clave)).toBe(true);
    expect(mismaClave(new Uint8Array([1, 2, 4]).buffer, clave)).toBe(false);
    expect(mismaClave(new Uint8Array([1, 2]).buffer, clave)).toBe(false);
    expect(mismaClave(null, clave)).toBe(false);
  });
});

describe('datosDeLaSuscripcion', () => {
  it('saca el endpoint y las dos claves', () => {
    expect(
      datosDeLaSuscripcion({
        endpoint: 'https://push.example/1',
        toJSON: () => ({ keys: { p256dh: 'publica', auth: 'secreto' } }),
      }),
    ).toEqual({ endpoint: 'https://push.example/1', p256dh: 'publica', auth: 'secreto' });
  });

  it('sin claves no sirve para mandar nada', () => {
    expect(() =>
      datosDeLaSuscripcion({ endpoint: 'https://push.example/1', toJSON: () => ({}) }),
    ).toThrow('no trae sus claves');
  });
});
