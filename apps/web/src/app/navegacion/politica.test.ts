import { describe, expect, it } from 'vitest';

import { CATALOGO, type Pantalla } from './catalogo';
import {
  decidir,
  inverso,
  movimientoAlApilar,
  type EntradaDeLaPolitica,
  type Movimiento,
} from './politica';

function entrada(cambios: Partial<EntradaDeLaPolitica>): EntradaDeLaPolitica {
  return {
    desde: '/',
    hacia: '/agenda',
    navegacion: { tipo: 'apilar' },
    ancho: 'movil',
    alcanceEnElementos: true,
    transicionesDelDocumento: true,
    aLaVista: true,
    menosMovimiento: false,
    navegadorYaAnimo: false,
    desdeLaNavegacion: false,
    sinTransicion: false,
    desdeUnaTarjeta: false,
    memoria: {},
    ...cambios,
  };
}

function movimiento(que: Movimiento, alcance: 'main' | 'documento' = 'main') {
  return { tipo: 'movimiento', movimiento: que, alcance };
}

function urlDe(pantalla: Pantalla): string {
  const camino = pantalla.patron.replace(':id', '0190');
  return typeof pantalla.etapa === 'string' ? `${camino}?etapa=${pantalla.etapa}` : camino;
}

describe('1. ninguna transición', () => {
  it('con menos movimiento, con la página oculta, si el navegador ya animó o con sinTransicion', () => {
    expect(decidir(entrada({ menosMovimiento: true }))).toEqual({ tipo: 'ninguno' });
    expect(decidir(entrada({ aLaVista: false }))).toEqual({ tipo: 'ninguno' });
    expect(decidir(entrada({ navegadorYaAnimo: true }))).toEqual({ tipo: 'ninguno' });
    expect(decidir(entrada({ sinTransicion: true }))).toEqual({ tipo: 'ninguno' });
  });

  it('afuera del marco y en la primera pantalla que se pinta', () => {
    expect(decidir(entrada({ hacia: '/acceso' }))).toEqual({ tipo: 'ninguno' });
    expect(decidir(entrada({ desde: '/v/token', hacia: '/' }))).toEqual({ tipo: 'ninguno' });
    expect(decidir(entrada({ desde: null }))).toEqual({ tipo: 'ninguno' });
  });
});

describe('2. en la tablet y en la compu, lo de hoy', () => {
  it('el fundido del navegador solo para lo que viene de la navegación, hojas incluidas', () => {
    for (const ancho of ['tablet', 'escritorio'] as const) {
      expect(decidir(entrada({ ancho, desdeLaNavegacion: true, hacia: '/clientes' }))).toEqual({
        tipo: 'fundido-del-navegador',
      });
      expect(
        decidir(entrada({ ancho, desdeLaNavegacion: true, hacia: '/finanzas/nuevo' })),
      ).toEqual({ tipo: 'fundido-del-navegador' });
      expect(decidir(entrada({ ancho, hacia: '/clientes/1' }))).toEqual({ tipo: 'ninguno' });
      expect(
        decidir(entrada({ ancho, navegacion: { tipo: 'atras', saltos: 1 }, hacia: '/' })),
      ).toEqual({ tipo: 'ninguno' });
    }
  });

  it('sin transiciones del documento, nada', () => {
    expect(
      decidir(
        entrada({ ancho: 'escritorio', desdeLaNavegacion: true, transicionesDelDocumento: false }),
      ),
    ).toEqual({ tipo: 'ninguno' });
  });
});

describe('3. en el celular, lo que no se anima', () => {
  it('sin alcance en elementos, nada', () => {
    expect(decidir(entrada({ alcanceEnElementos: false }))).toEqual({ tipo: 'ninguno' });
  });

  it('si el origen o el destino es una hoja', () => {
    expect(decidir(entrada({ desde: '/finanzas', hacia: '/finanzas/nuevo' }))).toEqual({
      tipo: 'ninguno',
    });
    expect(
      decidir(
        entrada({ desde: '/agenda/anotar', hacia: '/agenda', navegacion: { tipo: 'terminar' } }),
      ),
    ).toEqual({ tipo: 'ninguno' });
  });

  it('si solo cambian la búsqueda o el hash, salvo entre pestañas', () => {
    expect(decidir(entrada({ desde: '/finanzas', hacia: '/finanzas?tesoro=hogar' }))).toEqual({
      tipo: 'ninguno',
    });
    expect(decidir(entrada({ desde: '/opiniones', hacia: '/opiniones?respuesta=1' }))).toEqual({
      tipo: 'ninguno',
    });
    expect(
      decidir(
        entrada({
          desde: '/proyectos',
          hacia: '/proyectos?etapa=historial',
          navegacion: { tipo: 'reemplazar' },
        }),
      ),
    ).toEqual(movimiento('pestana-adelante'));
  });
});

describe('4. atrás desanda y adelante repite', () => {
  it('atrás es el inverso de lo que hizo la entrada de la que te vas', () => {
    const atras = { tipo: 'atras', saltos: 1 } as const;
    expect(
      decidir(
        entrada({
          desde: '/clientes/1',
          hacia: '/clientes',
          navegacion: atras,
          memoria: { deLaQueSeVa: 'empuje' },
        }),
      ),
    ).toEqual(movimiento('vuelta'));
    expect(
      decidir(
        entrada({
          desde: '/proyectos/1/editar',
          hacia: '/proyectos/1',
          navegacion: atras,
          memoria: { deLaQueSeVa: 'subida' },
        }),
      ),
    ).toEqual(movimiento('bajada', 'documento'));
    expect(
      decidir(
        entrada({
          desde: '/proyectos/1',
          hacia: '/proyectos',
          navegacion: atras,
          memoria: { deLaQueSeVa: 'tarjeta' },
        }),
      ),
    ).toEqual(movimiento('tarjeta-vuelta', 'documento'));
    expect(
      decidir(
        entrada({
          desde: '/clientes',
          hacia: '/',
          navegacion: atras,
          memoria: { deLaQueSeVa: 'fundido' },
        }),
      ),
    ).toEqual(movimiento('fundido'));
  });

  it('sin memoria, se calcula como si se hubiera apilado desde el destino y se invierte', () => {
    expect(
      decidir(
        entrada({
          desde: '/proyectos/1',
          hacia: '/proyectos',
          navegacion: { tipo: 'atras', saltos: 1 },
        }),
      ),
    ).toEqual(movimiento('vuelta'));
  });

  it('adelante repite el de la entrada a la que vas, y un salto de más de uno es un fundido', () => {
    expect(
      decidir(
        entrada({
          desde: '/proyectos',
          hacia: '/proyectos/1',
          navegacion: { tipo: 'adelante', saltos: 1 },
          memoria: { deLaQueLlega: 'tarjeta' },
        }),
      ),
    ).toEqual(movimiento('tarjeta', 'documento'));
    expect(
      decidir(
        entrada({
          desde: '/proyectos',
          hacia: '/proyectos/1',
          navegacion: { tipo: 'adelante', saltos: 1 },
        }),
      ),
    ).toEqual(movimiento('empuje'));
    expect(
      decidir(
        entrada({
          desde: '/clientes/1',
          hacia: '/',
          navegacion: { tipo: 'atras', saltos: 2 },
          memoria: { deLaQueSeVa: 'empuje' },
        }),
      ),
    ).toEqual(movimiento('fundido'));
  });
});

describe('5. entre pestañas de la misma pantalla', () => {
  it('hacia el lado que corresponde, aunque sean dos raíces de Proyectos', () => {
    expect(decidir(entrada({ desde: '/consultas', hacia: '/proyectos?etapa=historial' }))).toEqual(
      movimiento('pestana-adelante'),
    );
    expect(decidir(entrada({ desde: '/proyectos?etapa=historial', hacia: '/consultas' }))).toEqual(
      movimiento('pestana-atras'),
    );
    expect(decidir(entrada({ desde: '/opiniones', hacia: '/opiniones/preguntas' }))).toEqual(
      movimiento('pestana-adelante'),
    );
  });
});

describe('6. las secciones', () => {
  it('ir a otra sección es un fundido', () => {
    expect(
      decidir(
        entrada({
          desde: '/clientes/1',
          hacia: '/finanzas',
          navegacion: { tipo: 'seccion', saltos: 2, cambiaDePestana: false },
        }),
      ),
    ).toEqual(movimiento('fundido'));
  });

  it('la sección en la que estás: vuelta si su raíz está justo abajo, fundido si hay que saltar más', () => {
    const misma = (saltos: number, cambiaDePestana = false) =>
      decidir(
        entrada({
          desde: '/proyectos/1/compartir',
          hacia: '/consultas',
          navegacion: { tipo: 'seccion', saltos, cambiaDePestana },
        }),
      );
    expect(misma(1)).toEqual(movimiento('vuelta'));
    expect(misma(2)).toEqual(movimiento('fundido'));
    expect(misma(1, true)).toEqual(movimiento('fundido'));
  });
});

describe('7. apilar, reemplazar o terminar', () => {
  it('a una capa sube y desde una capa baja, y las dos son del documento', () => {
    expect(decidir(entrada({ desde: '/proyectos/1', hacia: '/proyectos/1/editar' }))).toEqual(
      movimiento('subida', 'documento'),
    );
    expect(
      decidir(
        entrada({
          desde: '/proyectos/nuevo',
          hacia: '/proyectos/2',
          navegacion: { tipo: 'terminar' },
        }),
      ),
    ).toEqual(movimiento('bajada', 'documento'));
    expect(
      decidir(
        entrada({
          desde: '/proyectos/1/editar',
          hacia: '/proyectos/1/cobrar',
          navegacion: { tipo: 'terminar' },
        }),
      ),
    ).toEqual(movimiento('bajada', 'documento'));
  });

  it('de una tarjeta de trabajo a su ficha, la tarjeta; sin tarjeta, un empuje', () => {
    expect(
      decidir(entrada({ desde: '/proyectos', hacia: '/proyectos/1', desdeUnaTarjeta: true })),
    ).toEqual(movimiento('tarjeta', 'documento'));
    expect(
      decidir(entrada({ desde: '/clientes/2', hacia: '/proyectos/1', desdeUnaTarjeta: true })),
    ).toEqual(movimiento('tarjeta', 'documento'));
    expect(decidir(entrada({ desde: '/proyectos', hacia: '/proyectos/1' }))).toEqual(
      movimiento('empuje'),
    );
  });

  it('a algo más profundo o de otra rama empuja, a algo menos profundo de la misma sección vuelve', () => {
    expect(decidir(entrada({ desde: '/proyectos/1', hacia: '/clientes/2' }))).toEqual(
      movimiento('empuje'),
    );
    expect(decidir(entrada({ desde: '/', hacia: '/agenda' }))).toEqual(movimiento('empuje'));
    expect(
      decidir(
        entrada({
          desde: '/proyectos/1/cobrar',
          hacia: '/proyectos/1',
          navegacion: { tipo: 'terminar' },
        }),
      ),
    ).toEqual(movimiento('vuelta'));
    expect(
      decidir(
        entrada({ desde: '/proyectos/1', hacia: '/proyectos', navegacion: { tipo: 'reemplazar' } }),
      ),
    ).toEqual(movimiento('vuelta'));
    expect(decidir(entrada({ desde: '/', hacia: '/finanzas' }))).toEqual(movimiento('fundido'));
  });
});

describe('los movimientos', () => {
  it('cada uno tiene su inverso, y el inverso del inverso es él mismo', () => {
    const todos: Movimiento[] = [
      'fundido',
      'empuje',
      'vuelta',
      'subida',
      'bajada',
      'tarjeta',
      'tarjeta-vuelta',
      'pestana-adelante',
      'pestana-atras',
    ];
    for (const uno of todos) expect(inverso(inverso(uno))).toBe(uno);
    expect(inverso('empuje')).toBe('vuelta');
    expect(inverso('subida')).toBe('bajada');
  });

  it('cada pantalla del catálogo sale y llega por lo menos una vez', () => {
    for (const pantalla of CATALOGO) {
      const url = urlDe(pantalla);
      const ida = decidir(entrada({ desde: '/', hacia: url }));
      const vuelta = decidir(
        entrada({ desde: url, hacia: '/', navegacion: { tipo: 'reemplazar' } }),
      );
      if (pantalla.forma === 'hoja') {
        expect(ida, pantalla.id).toEqual({ tipo: 'ninguno' });
        expect(vuelta, pantalla.id).toEqual({ tipo: 'ninguno' });
        continue;
      }
      if (pantalla.id === 'inicio') {
        expect(ida, pantalla.id).toEqual({ tipo: 'ninguno' });
        continue;
      }
      expect(ida.tipo, pantalla.id).toBe('movimiento');
      expect(vuelta.tipo, pantalla.id).toBe('movimiento');
      expect(movimientoAlApilar('/', url), pantalla.id).toBeTypeOf('string');
    }
  });
});
