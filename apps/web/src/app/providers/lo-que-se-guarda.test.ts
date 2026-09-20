import { QueryClient, type Query } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { claveDeLaVistaCompartida, claveDeLaVistaDelTrabajo } from '@/entities/vista-cliente';

import { OPCIONES_DE_DESHIDRATACION } from './lo-que-se-guarda';

function consultaCon(clave: readonly unknown[], datos: unknown): Query {
  const cliente = new QueryClient();
  cliente.setQueryData(clave, datos);
  const query = cliente.getQueryCache().find({ queryKey: clave });
  if (query === undefined) throw new Error('no se creó la consulta');
  return query;
}

function seGuarda(clave: readonly unknown[], datos: unknown = { hola: true }): boolean {
  return OPCIONES_DE_DESHIDRATACION?.shouldDehydrateQuery?.(consultaCon(clave, datos)) ?? false;
}

describe('qué se guarda en el aparato', () => {
  it('la vista del cliente no se guarda, ni la del enlace ni la de adentro de la app', () => {
    expect(seGuarda(claveDeLaVistaCompartida('un-token'))).toBe(false);
    expect(seGuarda(claveDeLaVistaDelTrabajo('un-proyecto'))).toBe(false);
  });

  it('lo demás sí, que es lo que hace andar la app sin señal', () => {
    expect(seGuarda(['replica', 'un-usuario'])).toBe(true);
  });
});
