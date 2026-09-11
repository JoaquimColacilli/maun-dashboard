import { X509Certificate } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { CA_DE_SUPABASE } from '../scripts/conexion.ts';
import {
  archivosDeTest,
  describirFallas,
  exigirSinControlDeTransaccion,
  interpretarTap,
  lineasDeSalida,
  migraciones,
  preludio,
  seed,
  sentenciasDeTransaccion,
} from '../scripts/pgtap.ts';

describe('sentenciasDeTransaccion', () => {
  it('encuentra begin, commit y rollback sueltos', () => {
    expect(sentenciasDeTransaccion('begin; select 1; commit;')).toEqual(['begin', 'commit']);
    expect(sentenciasDeTransaccion('select 1;\nROLLBACK;')).toEqual(['ROLLBACK']);
    expect(sentenciasDeTransaccion('start transaction; end;')).toEqual([
      'start transaction',
      'end',
    ]);
  });

  it('ignora el begin y el end de un cuerpo plpgsql', () => {
    const sql = `create function f() returns void language plpgsql as $$
begin
  perform 1;
end;
$$;`;
    expect(sentenciasDeTransaccion(sql)).toEqual([]);
  });

  it('ignora cadenas y comentarios', () => {
    expect(
      sentenciasDeTransaccion("select 'commit'; -- rollback;\n/* begin; */ select 2;"),
    ).toEqual([]);
  });

  it('no confunde un case ... end con un end de transacción', () => {
    expect(sentenciasDeTransaccion('select case when true then 1 end;')).toEqual([]);
  });
});

describe('los archivos de la suite', () => {
  it('ninguno controla la transacción: la abre y la cierra el runner', () => {
    for (const archivo of [preludio(), ...archivosDeTest()]) {
      expect(() => {
        exigirSinControlDeTransaccion(archivo);
      }).not.toThrow();
    }
  });

  it('ninguna migración ni el seed controlan la transacción: el ensayo los corre en la suya', () => {
    for (const archivo of [...migraciones(), ...seed()]) {
      expect(() => {
        exigirSinControlDeTransaccion(archivo);
      }).not.toThrow();
    }
  });

  it('hay al menos un archivo de test', () => {
    expect(archivosDeTest().length).toBeGreaterThan(0);
  });
});

describe('la raíz TLS fijada', () => {
  it('no vence en los próximos 90 días: si falla, renovala antes de que se caiga la conexión (ADR 0008)', () => {
    const vence = new Date(new X509Certificate(readFileSync(CA_DE_SUPABASE)).validTo);
    const limite = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    expect(vence.getTime()).toBeGreaterThan(limite.getTime());
  });
});

describe('interpretarTap', () => {
  it('separa plan, aciertos, fallas y diagnósticos', () => {
    const resultado = interpretarTap([
      '1..3',
      'ok 1 - uno',
      'not ok 2 - dos',
      '# Failed test 2',
      'ok 3 - tres',
      'otra cosa',
    ]);
    expect(resultado).toEqual({
      planeados: 3,
      pasaron: ['ok 1 - uno', 'ok 3 - tres'],
      fallaron: ['not ok 2 - dos'],
      diagnosticos: ['# Failed test 2'],
    });
  });
});

describe('describirFallas', () => {
  const archivo = { nombre: 'tests/x.sql', sql: '' };

  it('un archivo con todo en ok no tiene fallas', () => {
    expect(describirFallas(archivo, interpretarTap(['1..1', 'ok 1']))).toEqual([]);
  });

  it('falla si corrió menos tests de los planeados', () => {
    expect(describirFallas(archivo, interpretarTap(['1..2', 'ok 1']))).toEqual([
      'tests/x.sql: planeó 2 tests y corrió 1',
    ]);
  });

  it('falla si no declara plan', () => {
    expect(describirFallas(archivo, interpretarTap(['ok 1']))).toEqual([
      'tests/x.sql: no declara plan()',
    ]);
  });

  it('adjunta los diagnósticos a una falla', () => {
    expect(describirFallas(archivo, interpretarTap(['1..1', 'not ok 1', '# have: 1']))).toEqual([
      'not ok 1',
      '# have: 1',
    ]);
  });
});

describe('lineasDeSalida', () => {
  it('junta las filas de todas las sentencias y parte las celdas multilínea', () => {
    const resultados = [
      { rows: [{ plan: '1..2' }] },
      { rows: [{ ok: 'ok 1' }, { ok: 'not ok 2\n# detalle' }] },
      { rows: [{ nada: null }] },
    ];
    expect(lineasDeSalida(resultados)).toEqual(['1..2', 'ok 1', 'not ok 2', '# detalle']);
  });

  it('acepta el resultado de una sola sentencia', () => {
    expect(lineasDeSalida({ rows: [{ plan: '1..1' }] })).toEqual(['1..1']);
  });
});
