import { describe, expect, it } from 'vitest';

import {
  archivosDeTest,
  correrTest,
  describirFallas,
  enTransaccionConRollback,
} from '../scripts/pgtap.ts';

describe('pgTAP contra la base linkeada, cada archivo en una transacción que termina en rollback', () => {
  it.each(archivosDeTest().map((archivo) => [archivo.nombre, archivo] as const))(
    '%s',
    async (_nombre, archivo) => {
      const resultado = await enTransaccionConRollback((cliente) => correrTest(cliente, archivo));
      expect(describirFallas(archivo, resultado)).toEqual([]);
    },
  );
});
