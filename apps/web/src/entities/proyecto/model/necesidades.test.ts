import { TIPOS_DE_NECESIDAD } from '@maun/domain';
import { describe, expect, it } from 'vitest';

import { TABLAS_REPLICADAS, type Replica, type TablaReplicada } from '@/shared/api';

import {
  catalogoDelTaller,
  comoViajan,
  conUnaNecesidadDeVuelta,
  conUnaNecesidadEditada,
  conUnaNecesidadMas,
  conUnaNecesidadTildada,
  listaDelTipo,
  LISTAS_DEL_TRABAJO,
  necesidadesDelProyecto,
  nombreConCantidad,
  sinUnaNecesidad,
  sugerenciasParaEscribir,
  type Necesidad,
} from './necesidades';

function necesidad(extra: Partial<Necesidad> & { id: string }): Necesidad {
  return {
    household_id: 'h',
    created_at: '2026-09-01T12:00:00Z',
    updated_at: '2026-09-01T12:00:00Z',
    deleted_at: null,
    version: 1,
    proyecto_id: 'p1',
    tipo: 'herraje',
    nombre: 'Bisagras',
    cantidad: null,
    listo: false,
    ...extra,
  };
}

function conFilas(filas: readonly Necesidad[]): Replica {
  const tablas = {} as Record<TablaReplicada, Record<string, unknown>>;
  for (const tabla of TABLAS_REPLICADAS) tablas[tabla] = {};
  tablas.necesidades = Object.fromEntries(filas.map((fila) => [fila.id, fila]));
  return { usuarioId: 'u', cursor: '', reconciliadoEn: '', tablas } as unknown as Replica;
}

const NOMBRES = (entradas: readonly { nombre: string }[]) => entradas.map((e) => e.nombre);

describe('las tres listas del trabajo', () => {
  it('van en el orden del dominio: materiales, herrajes y herramientas', () => {
    expect(LISTAS_DEL_TRABAJO.map((lista) => lista.tipo)).toEqual(TIPOS_DE_NECESIDAD);
    expect(LISTAS_DEL_TRABAJO.map((lista) => lista.titulo)).toEqual([
      'Materiales necesarios',
      'Herrajes necesarios',
      'Herramientas necesarias',
    ]);
  });

  it('las tres llevan cantidad opcional, y cada campo dice de qué es', () => {
    expect(LISTAS_DEL_TRABAJO.map((lista) => lista.cuantos)).toEqual([
      'Cuántos materiales',
      'Cuántos herrajes',
      'Cuántas herramientas',
    ]);
  });

  it('cada una habla en su género: no dice «agregar el herramienta»', () => {
    expect(LISTAS_DEL_TRABAJO.map((lista) => lista.agregar)).toEqual([
      'Agregar el material',
      'Agregar el herraje',
      'Agregar la herramienta',
    ]);
    expect(LISTAS_DEL_TRABAJO.map((lista) => lista.listo)).toEqual(['Listo', 'Listo', 'Lista']);
    expect(LISTAS_DEL_TRABAJO.map((lista) => lista.listos)).toEqual(['listos', 'listos', 'listas']);
  });

  it('los textos de un tipo se buscan por el tipo', () => {
    expect(listaDelTipo('material').titulo).toBe('Materiales necesarios');
    expect(listaDelTipo('herramienta').agregar).toBe('Agregar la herramienta');
  });
});

describe('lo que hace falta para un trabajo', () => {
  const filas = [
    necesidad({ id: 'n1', nombre: 'Bisagras', cantidad: 6 }),
    necesidad({ id: 'n2', nombre: 'Tarugos', listo: true }),
    necesidad({ id: 'n3', tipo: 'herramienta', nombre: 'Sierra Circular' }),
    necesidad({ id: 'n4', proyecto_id: 'p2', nombre: 'Pistones' }),
  ];

  it('trae solo lo de ese trabajo, en orden estable', () => {
    expect(necesidadesDelProyecto(conFilas(filas), 'p1').map((f) => f.id)).toEqual([
      'n1',
      'n2',
      'n3',
    ]);
  });
});

describe('el catálogo sale de la réplica, sin tabla ni pantalla de administración', () => {
  it('la primera vez está vacío', () => {
    expect(catalogoDelTaller(conFilas([]), 'herraje')).toEqual([]);
  });

  it('junta lo que usó en todos los trabajos, no solo en este', () => {
    const replica = conFilas([
      necesidad({ id: 'n1', proyecto_id: 'p1', nombre: 'Bisagras' }),
      necesidad({ id: 'n2', proyecto_id: 'p2', nombre: 'Bisagras' }),
      necesidad({ id: 'n3', proyecto_id: 'p3', nombre: 'Tiradores' }),
    ]);
    expect(NOMBRES(catalogoDelTaller(replica, 'herraje'))).toEqual(['Bisagras', 'Tiradores']);
  });

  it('no sugiere herramientas mientras cargás herrajes', () => {
    const replica = conFilas([
      necesidad({ id: 'n1', nombre: 'Bisagras' }),
      necesidad({ id: 'n2', tipo: 'herramienta', nombre: 'Sierra Circular' }),
    ]);
    expect(NOMBRES(catalogoDelTaller(replica, 'herraje'))).toEqual(['Bisagras']);
    expect(NOMBRES(catalogoDelTaller(replica, 'herramienta'))).toEqual(['Sierra Circular']);
  });

  it('no repite lo que este trabajo ya tiene cargado', () => {
    const replica = conFilas([
      necesidad({ id: 'n1', proyecto_id: 'p2', nombre: 'Bisagras' }),
      necesidad({ id: 'n2', proyecto_id: 'p2', nombre: 'Tiradores' }),
      necesidad({ id: 'n3', proyecto_id: 'p1', nombre: 'Bisagras' }),
    ]);
    const catalogo = catalogoDelTaller(replica, 'herraje');
    const puestos = necesidadesDelProyecto(replica, 'p1');
    expect(NOMBRES(sugerenciasParaEscribir(catalogo, '', puestos))).toEqual(['Tiradores']);
  });
});

describe('los cambios viajan con la lista entera', () => {
  const filas = [
    necesidad({ id: 'n1', nombre: 'Bisagras', cantidad: 6 }),
    necesidad({ id: 'n2', nombre: 'Tarugos' }),
  ];

  it('agregar suma una y deja las demás como estaban', () => {
    const quedan = conUnaNecesidadMas(filas, {
      id: 'n3',
      tipo: 'herraje',
      nombre: '  Pistones  ',
      cantidad: 3,
    });
    expect(quedan).toHaveLength(3);
    expect(quedan[2]).toEqual({
      id: 'n3',
      tipo: 'herraje',
      nombre: 'Pistones',
      cantidad: 3,
      listo: false,
    });
    expect(quedan.slice(0, 2)).toEqual(comoViajan(filas));
  });

  it('tildar una no toca las otras', () => {
    const quedan = conUnaNecesidadTildada(filas, 'n1', true);
    expect(quedan[0]).toMatchObject({ id: 'n1', listo: true });
    expect(quedan[1]).toMatchObject({ id: 'n2', listo: false });
  });

  it('editar una le cambia el nombre y la cantidad, y no la tilda ni la destilda', () => {
    const tildadas = [
      necesidad({ id: 'n1', nombre: 'bisagras', cantidad: 4, listo: true }),
      necesidad({ id: 'n2', nombre: 'Tarugos' }),
    ];
    const quedan = conUnaNecesidadEditada(tildadas, 'n1', {
      nombre: 'Bisagras Cazoleta 35',
      cantidad: 6,
    });
    expect(quedan).toEqual([
      { id: 'n1', tipo: 'herraje', nombre: 'Bisagras Cazoleta 35', cantidad: 6, listo: true },
      { id: 'n2', tipo: 'herraje', nombre: 'Tarugos', cantidad: null, listo: false },
    ]);
  });

  it('a una que no tenía cantidad se le puede poner, y las demás viajan como estaban', () => {
    const quedan = conUnaNecesidadEditada(filas, 'n2', { nombre: 'Tarugos', cantidad: 20 });
    expect(quedan[0]).toEqual(comoViajan(filas)[0]);
    expect(quedan[1]).toMatchObject({ id: 'n2', cantidad: 20 });
  });

  it('el nombre con su cantidad es lo que dicen la casilla y el tacho', () => {
    expect(nombreConCantidad({ nombre: 'Bisagras', cantidad: 6 })).toBe('6 Bisagras');
    expect(nombreConCantidad({ nombre: 'Tarugos', cantidad: null })).toBe('Tarugos');
  });

  it('sacar una la manda marcada de baja, con su id solo', () => {
    const quedan = sinUnaNecesidad(filas, 'n2');
    expect(quedan).toEqual([
      { id: 'n1', tipo: 'herraje', nombre: 'Bisagras', cantidad: 6, listo: false },
      { id: 'n2', borrado: true },
    ]);
  });

  it('deshacer la vuelve a mandar entera, sin la marca de baja', () => {
    const [queda, sacada] = filas;
    if (queda === undefined || sacada === undefined) throw new Error('las dos tienen que existir');
    const quedan = conUnaNecesidadDeVuelta([queda], sacada);
    expect(quedan).toEqual([
      { id: 'n1', tipo: 'herraje', nombre: 'Bisagras', cantidad: 6, listo: false },
      { id: 'n2', tipo: 'herraje', nombre: 'Tarugos', cantidad: null, listo: false },
    ]);
  });
});
