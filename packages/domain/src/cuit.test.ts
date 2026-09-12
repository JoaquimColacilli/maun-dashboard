import { describe, expect, it } from 'vitest';

import {
  digitosDeCuit,
  formatearCuit,
  LARGO_DE_CUIT,
  PREFIJOS_DE_EMPRESA,
  PREFIJOS_DE_PERSONA,
  revisarCuit,
  verificadorDeCuit,
} from './cuit.ts';

function conVerificador(diez: string): string {
  const digito = verificadorDeCuit(diez);
  if (digito === null) throw new Error(`${diez} cae en el caso ambiguo`);
  return `${diez}${String(digito)}`;
}

describe('digitosDeCuit', () => {
  it('se queda solo con los dígitos', () => {
    expect(digitosDeCuit('20-12345678-9')).toBe('20123456789');
    expect(digitosDeCuit(' 20 12345678 9 ')).toBe('20123456789');
    expect(digitosDeCuit('sin números')).toBe('');
  });
});

describe('formatearCuit', () => {
  it('arma NN-NNNNNNNN-N, que es el formato que exige la base', () => {
    expect(formatearCuit('20123456789')).toBe('20-12345678-9');
  });

  it('formatea mientras se escribe, sin exigir que esté completo', () => {
    expect(formatearCuit('')).toBe('');
    expect(formatearCuit('2')).toBe('2');
    expect(formatearCuit('20')).toBe('20');
    expect(formatearCuit('201')).toBe('20-1');
    expect(formatearCuit('2012345678')).toBe('20-12345678');
  });

  it('corta lo que pasa de once dígitos en vez de arrastrarlo', () => {
    expect(formatearCuit('201234567891234')).toBe('20-12345678-9');
  });

  it('reformatea algo que ya venía con guiones', () => {
    expect(formatearCuit('20-12345678-9')).toBe('20-12345678-9');
  });
});

describe('verificadorDeCuit', () => {
  it('aplica los pesos 5 4 3 2 7 6 5 4 3 2 sobre los primeros diez dígitos', () => {
    expect(verificadorDeCuit('2012345678')).toBe(6);
  });

  it('ignora los separadores y los dígitos de más', () => {
    expect(verificadorDeCuit('20-12345678-9')).toBe(6);
  });

  it('devuelve null cuando todavía no hay diez dígitos', () => {
    expect(verificadorDeCuit('201234567')).toBeNull();
    expect(verificadorDeCuit('')).toBeNull();
  });

  it('un resto de 11 es un verificador 0', () => {
    expect(verificadorDeCuit('2000000006')).toBe(0);
    expect(verificadorDeCuit('2700000003')).toBe(0);
  });

  it('devuelve null en el caso ambiguo: el resto da 10 y no hay una convención única', () => {
    let ambiguos = 0;
    for (let n = 0; n < 500; n++) {
      const diez = `20${String(n).padStart(8, '0')}`;
      if (verificadorDeCuit(diez) === null) ambiguos += 1;
    }
    expect(ambiguos).toBeGreaterThan(0);
    expect(verificadorDeCuit('2000000001')).toBeNull();
    expect(verificadorDeCuit('2700000009')).toBeNull();
  });
});

describe('revisarCuit', () => {
  it('el campo vacío no es un error: el CUIT es opcional', () => {
    expect(revisarCuit('')).toEqual({ estado: 'vacio' });
    expect(revisarCuit('  ')).toEqual({ estado: 'vacio' });
  });

  it('acepta los prefijos de persona física y de persona jurídica', () => {
    for (const prefijo of [...PREFIJOS_DE_PERSONA, ...PREFIJOS_DE_EMPRESA]) {
      const cuit = conVerificador(`${String(prefijo)}12345678`);
      expect(revisarCuit(cuit)).toEqual({ estado: 'valido' });
      expect(cuit).toHaveLength(LARGO_DE_CUIT);
    }
  });

  it('rechaza un prefijo que no existe', () => {
    expect(revisarCuit('21123456784')).toEqual({ estado: 'invalido', motivo: 'prefijo' });
  });

  it('rechaza lo que no tiene once dígitos', () => {
    expect(revisarCuit('2012345678')).toEqual({ estado: 'invalido', motivo: 'largo' });
    expect(revisarCuit('201234567890')).toEqual({ estado: 'invalido', motivo: 'largo' });
  });

  it('rechaza un verificador que no cierra', () => {
    const bueno = conVerificador('2012345678');
    const malo = `${bueno.slice(0, 10)}${String((Number(bueno[10]) + 1) % 10)}`;
    expect(revisarCuit(malo)).toEqual({ estado: 'invalido', motivo: 'verificador' });
  });

  it('marca como ambiguo, no como inválido, el CUIT cuyo módulo da 10', () => {
    expect(revisarCuit('20000000019')).toEqual({ estado: 'ambiguo' });
    expect(revisarCuit('27000000090')).toEqual({ estado: 'ambiguo' });
  });

  it('acepta el mismo número con guiones y sin ellos', () => {
    expect(revisarCuit('20-12345678-6')).toEqual({ estado: 'valido' });
    expect(revisarCuit('20123456786')).toEqual({ estado: 'valido' });
  });
});
