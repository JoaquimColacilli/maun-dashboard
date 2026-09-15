import { describe, expect, it } from 'vitest';

import { TABLAS_REPLICADAS, type Replica, type TablaReplicada } from '@/shared/api';

import {
  archivosDelProyecto,
  esImagen,
  espacioUsado,
  pesoLegible,
  rutaDeLaMiniatura,
  rutaDelArchivo,
  rutasEnElBucket,
  type Archivo,
} from './archivos';

function archivo(id: string, extra: Partial<Archivo> = {}): Archivo {
  return {
    id,
    household_id: 'h',
    proyecto_id: 'p',
    nombre: `${id}.jpg`,
    tipo: 'image/webp',
    bytes: 200_000,
    ancho: 2000,
    alto: 1500,
    created_at: '2026-09-15T12:00:00Z',
    updated_at: '2026-09-15T12:00:00Z',
    deleted_at: null,
    version: 1,
    ...extra,
  };
}

function replicaCon(archivos: Archivo[]): Replica {
  const tablas = {} as Record<TablaReplicada, Record<string, unknown>>;
  for (const tabla of TABLAS_REPLICADAS) tablas[tabla] = {};
  tablas.archivos = Object.fromEntries(archivos.map((fila) => [fila.id, fila]));
  return { usuarioId: 'u', cursor: '', reconciliadoEn: '', tablas } as unknown as Replica;
}

describe('dónde vive un archivo en el bucket', () => {
  it('una carpeta por taller y por trabajo, con el id como nombre y la extensión del tipo', () => {
    expect(rutaDelArchivo(archivo('a1'))).toBe('h/p/a1.webp');
    expect(rutaDelArchivo(archivo('a2', { tipo: 'image/jpeg' }))).toBe('h/p/a2.jpg');
    expect(rutaDelArchivo(archivo('a3', { tipo: 'application/pdf' }))).toBe('h/p/a3.pdf');
    expect(rutaDelArchivo(archivo('a4', { tipo: 'text/plain' }))).toBe('h/p/a4.bin');
  });

  it('una imagen tiene su miniatura al lado; un PDF no', () => {
    expect(esImagen(archivo('a1'))).toBe(true);
    expect(rutaDeLaMiniatura(archivo('a1'))).toBe('h/p/a1.mini.webp');
    expect(rutasEnElBucket(archivo('a1'))).toEqual(['h/p/a1.webp', 'h/p/a1.mini.webp']);

    const pdf = archivo('a3', { tipo: 'application/pdf' });
    expect(esImagen(pdf)).toBe(false);
    expect(rutaDeLaMiniatura(pdf)).toBe('h/p/a3.pdf');
    expect(rutasEnElBucket(pdf)).toEqual(['h/p/a3.pdf']);
  });
});

describe('los archivos de un trabajo', () => {
  it('son los de ese trabajo, lo más nuevo primero', () => {
    const replica = replicaCon([
      archivo('viejo', { created_at: '2026-09-10T12:00:00Z' }),
      archivo('nuevo', { created_at: '2026-09-14T12:00:00Z' }),
      archivo('mismo-dia-b', { created_at: '2026-09-12T12:00:00Z' }),
      archivo('mismo-dia-a', { created_at: '2026-09-12T12:00:00Z' }),
      archivo('de-otro', { proyecto_id: 'q' }),
    ]);
    expect(archivosDelProyecto(replica, 'p').map((fila) => fila.id)).toEqual([
      'nuevo',
      'mismo-dia-b',
      'mismo-dia-a',
      'viejo',
    ]);
  });

  it('el espacio usado suma todo el taller', () => {
    const replica = replicaCon([
      archivo('a', { bytes: 300 }),
      archivo('b', { proyecto_id: 'q', bytes: 700 }),
    ]);
    expect(espacioUsado(replica)).toBe(1000);
  });
});

describe('pesoLegible', () => {
  it('dice KB, MB o GB, con un decimal y coma', () => {
    expect(pesoLegible(200)).toBe('1 KB');
    expect(pesoLegible(240_000)).toBe('234 KB');
    expect(pesoLegible(3_400_000)).toBe('3,2 MB');
    expect(pesoLegible(1024 ** 3 * 1.5)).toBe('1,5 GB');
  });
});
