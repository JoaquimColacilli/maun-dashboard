import { centavos } from '@maun/domain';
import { describe, expect, it } from 'vitest';

import { buscarClientes, corteDeOrigenes, ordenarClientes } from './busqueda';
import type { Cliente, OrigenDeContacto } from './catalogos';
import { CLIENTE_EN_BLANCO } from './formulario';
import type { ResumenDeCliente } from './resumen';

function resumen(
  nombre: string,
  extra: Partial<Cliente> = {},
  datos: Partial<ResumenDeCliente> = {},
): ResumenDeCliente {
  return {
    cliente: {
      ...CLIENTE_EN_BLANCO,
      id: nombre,
      nombre,
      household_id: 'h',
      created_at: '',
      updated_at: '',
      deleted_at: null,
      version: 1,
      ...extra,
    },
    proyectos: [],
    enConsultas: 0,
    facturados: 0,
    ultimo: undefined,
    fechaDelUltimo: undefined,
    facturado: centavos(0),
    saldo: centavos(0),
    ...datos,
  };
}

const AGENDA = [
  resumen('Ana Gómez', { zona: 'Vicente López', telefono: '11 5555-1111' }),
  resumen('Bruno Díaz', { zona: 'Olivos', direccion: 'Av. Maipú 1234' }),
  resumen('Carla Núñez', { zona: 'Martínez', razon_social: 'Núñez SRL' }),
];

describe('buscarClientes', () => {
  it('sin consulta devuelve todo', () => {
    expect(buscarClientes(AGENDA, '')).toHaveLength(3);
    expect(buscarClientes(AGENDA, '   ')).toHaveLength(3);
  });

  it('busca por nombre desde la primera letra', () => {
    expect(buscarClientes(AGENDA, 'a').map((r) => r.cliente.nombre)).toEqual([
      'Ana Gómez',
      'Bruno Díaz',
      'Carla Núñez',
    ]);
    expect(buscarClientes(AGENDA, 'ana')).toHaveLength(1);
  });

  it('ignora acentos y mayúsculas', () => {
    expect(buscarClientes(AGENDA, 'GOMEZ')).toHaveLength(1);
    expect(buscarClientes(AGENDA, 'nunez')).toHaveLength(1);
  });

  it('busca por zona, dirección y razón social', () => {
    expect(buscarClientes(AGENDA, 'olivos')).toHaveLength(1);
    expect(buscarClientes(AGENDA, 'maipú')).toHaveLength(1);
    expect(buscarClientes(AGENDA, 'SRL')).toHaveLength(1);
  });

  it('busca por teléfono sin importar cómo esté escrito', () => {
    expect(buscarClientes(AGENDA, '5555-1111')).toHaveLength(1);
    expect(buscarClientes(AGENDA, '11 5555 1111')).toHaveLength(1);
  });

  it('devuelve vacío cuando no coincide nadie', () => {
    expect(buscarClientes(AGENDA, 'zzz')).toEqual([]);
  });
});

describe('ordenarClientes', () => {
  const conDatos = [
    resumen('Zulema', {}, { facturado: centavos(100), fechaDelUltimo: '2026-01-01' }),
    resumen('ana', {}, { facturado: centavos(300), fechaDelUltimo: '2026-05-01' }),
    resumen('Beto', {}, { facturado: centavos(200) }),
  ];

  it('por nombre, sin que las mayúsculas manden', () => {
    expect(ordenarClientes(conDatos, 'nombre').map((r) => r.cliente.nombre)).toEqual([
      'ana',
      'Beto',
      'Zulema',
    ]);
  });

  it('por total facturado, de mayor a menor', () => {
    expect(ordenarClientes(conDatos, 'facturado').map((r) => r.cliente.nombre)).toEqual([
      'ana',
      'Beto',
      'Zulema',
    ]);
  });

  it('por último trabajo, y el que no tiene queda al final', () => {
    expect(ordenarClientes(conDatos, 'ultimo').map((r) => r.cliente.nombre)).toEqual([
      'ana',
      'Zulema',
      'Beto',
    ]);
  });

  it('no muta la lista que recibe', () => {
    const original = [...conDatos];
    ordenarClientes(conDatos, 'nombre');
    expect(conDatos).toEqual(original);
  });
});

describe('corteDeOrigenes', () => {
  function conOrigen(nombre: string, origen: OrigenDeContacto | null) {
    return resumen(nombre, { origen_contacto: origen });
  }

  it('cuenta por origen, de mayor a menor, y saltea los que no tienen nadie', () => {
    const corte = corteDeOrigenes([
      conOrigen('a', 'redes'),
      conOrigen('b', 'referido'),
      conOrigen('c', 'referido'),
      conOrigen('d', null),
    ]);

    expect(corte.map((c) => [c.id, c.cantidad])).toEqual([
      ['referido', 2],
      ['redes', 1],
    ]);
  });

  it('sin orígenes anotados no hay corte que mostrar', () => {
    expect(corteDeOrigenes([conOrigen('a', null)])).toEqual([]);
    expect(corteDeOrigenes([])).toEqual([]);
  });
});
