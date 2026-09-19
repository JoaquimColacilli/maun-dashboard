import type { MutationOptions } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import type { Archivo } from '@/entities/archivo';
import type { NuevoAviso } from '@/shared/lib';

import {
  anotarArchivo,
  borrarArchivo,
  ESPERA_ANTES_DE_QUITAR_DEL_BUCKET_MS,
  type Mandar,
  type OpcionesDelBorrado,
} from './acciones';

const ARCHIVO: Archivo = {
  id: 'a1',
  household_id: 'h',
  proyecto_id: 'p',
  nombre: 'despiece.pdf',
  visible_para_cliente: false,
  tipo: 'application/pdf',
  bytes: 800_000,
  ancho: null,
  alto: null,
  created_at: '2026-09-15T12:00:00Z',
  updated_at: '2026-09-15T12:00:00Z',
  deleted_at: null,
  version: 1,
};

function registrador() {
  const mandadas: { clave: readonly unknown[] | undefined; variables: unknown }[] = [];
  const mandar: Mandar = (opciones: MutationOptions<Archivo, unknown, never>, variables) => {
    mandadas.push({ clave: opciones.mutationKey, variables });
  };
  return { mandadas, mandar };
}

function opciones(extra: Partial<OpcionesDelBorrado> = {}) {
  const avisos: NuevoAviso[] = [];
  const programados: { hacer: () => void; espera: number }[] = [];
  const quitadas: (readonly string[])[] = [];
  const cancelados: unknown[] = [];
  const base: OpcionesDelBorrado = {
    avisar: (aviso) => {
      avisos.push(aviso);
    },
    quitarDelBucket: (rutas) => {
      quitadas.push(rutas);
      return Promise.resolve();
    },
    enLinea: () => true,
    sigueBorrado: () => true,
    programar: (hacer, espera) => {
      programados.push({ hacer, espera });
      return programados.length;
    },
    cancelar: (reloj) => {
      cancelados.push(reloj);
    },
    ...extra,
  };
  return { base, avisos, programados, quitadas, cancelados };
}

describe('anotar un archivo subido', () => {
  it('va por la cola como un alta nueva, en silencio', () => {
    const { mandadas, mandar } = registrador();
    anotarArchivo(mandar, { ...ARCHIVO, id: 'a2' });
    expect(mandadas).toHaveLength(1);
    expect(mandadas[0]?.clave).toEqual(['archivos', 'crear']);
    expect(mandadas[0]?.variables).toMatchObject({ previo: null, nuevo: { id: 'a2' } });
  });
});

describe('borrar un archivo', () => {
  it('lo da de baja por la cola, avisa con deshacer y quita el binario cuando vence el deshacer', () => {
    const { mandadas, mandar } = registrador();
    const { base, avisos, programados, quitadas } = opciones();
    borrarArchivo(mandar, ARCHIVO, base);

    expect(mandadas[0]?.clave).toEqual(['archivos', 'borrar']);
    expect(avisos[0]).toMatchObject({
      tono: 'hecho',
      texto: 'Borraste «despiece.pdf».',
      accion: { etiqueta: 'Deshacer' },
    });
    expect(programados[0]?.espera).toBe(ESPERA_ANTES_DE_QUITAR_DEL_BUCKET_MS);

    programados[0]?.hacer();
    expect(quitadas).toEqual([['h/p/a1.pdf']]);
  });

  it('deshacer lo vuelve a dar de alta con la fila de antes y no quita nada del bucket', () => {
    const { mandadas, mandar } = registrador();
    const { base, avisos, programados, quitadas, cancelados } = opciones();
    borrarArchivo(mandar, ARCHIVO, base);

    avisos[0]?.accion?.alTocar();
    expect(cancelados).toHaveLength(1);
    expect(mandadas[1]?.clave).toEqual(['archivos', 'crear']);
    expect(mandadas[1]?.variables).toMatchObject({ previo: ARCHIVO, nuevo: { id: 'a1' } });

    programados[0]?.hacer();
    expect(quitadas).toEqual([]);
  });

  it('sin señal, o si la baja rebotó y la fila volvió, el binario se queda', () => {
    for (const extra of [{ enLinea: () => false }, { sigueBorrado: () => false }]) {
      const { mandar } = registrador();
      const { base, programados, quitadas } = opciones(extra);
      borrarArchivo(mandar, ARCHIVO, base);
      programados[0]?.hacer();
      expect(quitadas).toEqual([]);
    }
  });

  it('una imagen se lleva también su miniatura', () => {
    const { mandar } = registrador();
    const quitar = vi.fn(() => Promise.resolve());
    const { base, programados } = opciones({ quitarDelBucket: quitar });
    borrarArchivo(mandar, { ...ARCHIVO, tipo: 'image/webp', nombre: 'foto.jpg' }, base);
    programados[0]?.hacer();
    expect(quitar).toHaveBeenCalledWith(['h/p/a1.webp', 'h/p/a1.mini.webp']);
  });
});
