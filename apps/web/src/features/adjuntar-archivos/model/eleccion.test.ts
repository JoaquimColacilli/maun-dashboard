import { describe, expect, it } from 'vitest';

import {
  eleccionDelArchivo,
  LOS_VIDEOS_NO_ENTRAN,
  medidasAchicadas,
  nombreParaGuardar,
  TOPE_DE_UN_PDF_BYTES,
} from './eleccion';

describe('qué se puede subir', () => {
  it('un video no entra, se lo reconozca por el tipo o por la extensión, y dice qué sí se puede', () => {
    expect(eleccionDelArchivo({ name: 'visita.mp4', type: 'video/mp4', size: 90_000_000 })).toEqual(
      {
        clase: 'rechazado',
        motivo: LOS_VIDEOS_NO_ENTRAN,
      },
    );
    expect(eleccionDelArchivo({ name: 'VID_2026.MOV', type: '', size: 10 })).toMatchObject({
      clase: 'rechazado',
      motivo: LOS_VIDEOS_NO_ENTRAN,
    });
    expect(LOS_VIDEOS_NO_ENTRAN).toMatch(/fotos o capturas/);
  });

  it('una foto, una captura o un render son imágenes, aunque el navegador no diga el tipo', () => {
    expect(eleccionDelArchivo({ name: 'a.jpg', type: 'image/jpeg', size: 1 })).toEqual({
      clase: 'imagen',
    });
    expect(eleccionDelArchivo({ name: 'render.png', type: 'image/png', size: 1 })).toEqual({
      clase: 'imagen',
    });
    expect(eleccionDelArchivo({ name: 'IMG_0001.HEIC', type: '', size: 1 })).toEqual({
      clase: 'imagen',
    });
  });

  it('un PDF entra hasta 10 MB, y si pesa más lo dice con su peso', () => {
    expect(
      eleccionDelArchivo({
        name: 'despiece.pdf',
        type: 'application/pdf',
        size: TOPE_DE_UN_PDF_BYTES,
      }),
    ).toEqual({ clase: 'pdf' });
    expect(eleccionDelArchivo({ name: 'presupuesto.PDF', type: '', size: 1 })).toEqual({
      clase: 'pdf',
    });

    const grande = eleccionDelArchivo({
      name: 'escaneo.pdf',
      type: 'application/pdf',
      size: 14 * 1024 * 1024,
    });
    expect(grande).toMatchObject({ clase: 'rechazado' });
    expect(grande.clase === 'rechazado' ? grande.motivo : '').toMatch(/«escaneo\.pdf» pesa 14 MB/);
  });

  it('lo demás no entra, y dice qué sí', () => {
    expect(
      eleccionDelArchivo({ name: 'planilla.xlsx', type: 'application/vnd.ms-excel', size: 1 }),
    ).toEqual({
      clase: 'rechazado',
      motivo: '«planilla.xlsx» no se puede subir: se pueden subir fotos, capturas y PDF.',
    });
  });
});

describe('medidasAchicadas', () => {
  it('lleva el lado más largo al máximo y conserva la proporción', () => {
    expect(medidasAchicadas(4032, 3024, 2000)).toEqual({ ancho: 2000, alto: 1500 });
    expect(medidasAchicadas(3024, 4032, 480)).toEqual({ ancho: 360, alto: 480 });
  });

  it('una imagen más chica que el máximo no se agranda', () => {
    expect(medidasAchicadas(800, 600, 2000)).toEqual({ ancho: 800, alto: 600 });
  });

  it('una tira muy finita no queda en cero', () => {
    expect(medidasAchicadas(10_000, 2, 480)).toEqual({ ancho: 480, alto: 1 });
  });
});

describe('nombreParaGuardar', () => {
  it('limpia los espacios, corta a 200 caracteres y no queda vacío', () => {
    expect(nombreParaGuardar('  despiece.pdf ')).toBe('despiece.pdf');
    expect(nombreParaGuardar('x'.repeat(250))).toHaveLength(200);
    expect(nombreParaGuardar('   ')).toBe('Archivo');
  });
});
