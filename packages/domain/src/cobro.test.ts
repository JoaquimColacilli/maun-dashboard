import { describe, expect, it } from 'vitest';

import {
  claveBancariaDe,
  digitosDeCbu,
  esClaveVirtual,
  esLinkDeMercadoPago,
  formatearCbu,
  HOSTS_DE_MERCADO_PAGO,
  LARGO_DE_CBU,
  LARGO_MAXIMO_DE_ALIAS,
  LARGO_MAXIMO_DEL_LINK,
  LARGO_MINIMO_DE_ALIAS,
  normalizarAlias,
  normalizarLinkDeCobro,
  revisarAlias,
  revisarCbu,
  revisarLinkDeCobro,
  verificadorDelBloque,
} from './cobro.ts';

// Todos los números de este archivo están construidos aplicando el algoritmo del BCRA (t.o. SNP,
// «clave 10 con el ponderador 9713»). Ninguno es una cuenta de nadie. Los dos primeros usan
// códigos de entidad que existen, así que sirven para probar el algoritmo y para nada más; los
// otros usan 999 y 0999, que no están asignados.
const EL_EJEMPLO_DEL_BCRA = '0110138202011100377664';
const VALIDO_DEL_BANCO = '0110001312345678901233';
const VALIDO_CON_CEROS = '2850590900000000000017';
const VALIDO_TODO_NUEVES = '9999999199999999999993';
const CVU_VALIDO = '0000999109999999999990';

describe('los dígitos de una clave bancaria', () => {
  it('se quedan solo con los números, vengan como vengan escritos', () => {
    expect(digitosDeCbu('0110 0013 1234 5678 9012 33')).toBe(VALIDO_DEL_BANCO);
    expect(digitosDeCbu('0110-0013-1234-5678-9012-33')).toBe(VALIDO_DEL_BANCO);
    expect(digitosDeCbu('  0110001312345678901233  ')).toBe(VALIDO_DEL_BANCO);
    expect(digitosDeCbu('sin números')).toBe('');
  });

  it('se muestran de a cuatro para poder leerlos en voz alta', () => {
    expect(formatearCbu(VALIDO_DEL_BANCO)).toBe('0110 0013 1234 5678 9012 33');
    expect(formatearCbu('0110 0013 1234 5678 9012 33')).toBe('0110 0013 1234 5678 9012 33');
    expect(formatearCbu('01100013123456789012339999')).toBe('0110 0013 1234 5678 9012 33');
    expect(formatearCbu('')).toBe('');
    expect(formatearCbu('011')).toBe('011');
  });
});

describe('el dígito verificador de un bloque', () => {
  // El ejemplo publicado por el BCRA: banco 011, sucursal 0138, verificador 2; cuenta
  // 0201110037766, verificador 4.
  it('reproduce el ejemplo del BCRA', () => {
    expect(verificadorDelBloque('0110138', [7, 1, 3, 9, 7, 1, 3])).toBe(2);
    expect(verificadorDelBloque('0201110037766', [3, 9, 7, 1, 3, 9, 7, 1, 3, 9, 7, 1, 3])).toBe(4);
  });

  it('cuando la suma cierra en cero el verificador es cero, no diez', () => {
    expect(verificadorDelBloque('0000999', [7, 1, 3, 9, 7, 1, 3])).toBe(1);
    expect(verificadorDelBloque('0999999999999', [3, 9, 7, 1, 3, 9, 7, 1, 3, 9, 7, 1, 3])).toBe(0);
  });

  it('sin la cantidad de dígitos que espera, no hay verificador', () => {
    expect(verificadorDelBloque('011', [7, 1, 3, 9, 7, 1, 3])).toBeNull();
    expect(verificadorDelBloque('01101380', [7, 1, 3, 9, 7, 1, 3])).toBeNull();
  });
});

describe('revisar un CBU o un CVU', () => {
  it('vacío es vacío: los cuatro datos son opcionales', () => {
    expect(revisarCbu('')).toEqual({ estado: 'vacio' });
    expect(revisarCbu('   ')).toEqual({ estado: 'vacio' });
  });

  it('acepta los que cierran los dos verificadores', () => {
    expect(revisarCbu(EL_EJEMPLO_DEL_BCRA)).toEqual({ estado: 'valido', clave: 'cbu' });
    expect(revisarCbu(VALIDO_DEL_BANCO)).toEqual({ estado: 'valido', clave: 'cbu' });
    expect(revisarCbu(VALIDO_CON_CEROS)).toEqual({ estado: 'valido', clave: 'cbu' });
    expect(revisarCbu(VALIDO_TODO_NUEVES)).toEqual({ estado: 'valido', clave: 'cbu' });
  });

  it('acepta el que escribieron con espacios o con guiones', () => {
    expect(revisarCbu('0110 0013 1234 5678 9012 33')).toEqual({ estado: 'valido', clave: 'cbu' });
    expect(revisarCbu('0110-0013-1234-5678-9012-33')).toEqual({ estado: 'valido', clave: 'cbu' });
  });

  it('reconoce el CVU por sus tres ceros de adelante', () => {
    expect(revisarCbu(CVU_VALIDO)).toEqual({ estado: 'valido', clave: 'cvu' });
    expect(esClaveVirtual('0000999109999999999990')).toBe(true);
    expect(esClaveVirtual(VALIDO_DEL_BANCO)).toBe(false);
    expect(claveBancariaDe('0000 9991 0999 9999 9999 90')).toBe('cvu');
    expect(claveBancariaDe(VALIDO_DEL_BANCO)).toBe('cbu');
  });

  it('un largo que no es 22 no llega a los verificadores', () => {
    expect(revisarCbu('011000131234567890123')).toEqual({ estado: 'invalido', motivo: 'largo' });
    expect(revisarCbu('01100013123456789012333')).toEqual({ estado: 'invalido', motivo: 'largo' });
    expect(revisarCbu('0110')).toEqual({ estado: 'invalido', motivo: 'largo' });
  });

  it('dice cuál de los dos bloques no cierra', () => {
    expect(revisarCbu('0110001412345678901233')).toEqual({ estado: 'invalido', motivo: 'banco' });
    expect(revisarCbu('2850590900000000000010')).toEqual({ estado: 'invalido', motivo: 'cuenta' });
    expect(revisarCbu('9999999299999999999994')).toEqual({ estado: 'invalido', motivo: 'banco' });
  });

  it('agarra el error de tipeo más común, que es cambiar dos dígitos de lugar', () => {
    expect(revisarCbu('0110001321345678901233')).toEqual({ estado: 'invalido', motivo: 'cuenta' });
  });

  it('el largo que espera es el de la norma', () => {
    expect(LARGO_DE_CBU).toBe(22);
    expect(digitosDeCbu(VALIDO_DEL_BANCO)).toHaveLength(LARGO_DE_CBU);
  });
});

describe('revisar un alias', () => {
  it('vacío es vacío', () => {
    expect(revisarAlias('')).toEqual({ estado: 'vacio' });
    expect(revisarAlias('   ')).toEqual({ estado: 'vacio' });
  });

  it('acepta letras, números, punto y guion medio, de 6 a 20', () => {
    for (const alias of [
      'maun.muebles',
      'MAUN.Muebles',
      'taller-maun-2026',
      'abcdef',
      'a'.repeat(LARGO_MAXIMO_DE_ALIAS),
      '123456',
    ]) {
      expect(revisarAlias(alias), alias).toEqual({ estado: 'valido', aviso: null });
    }
  });

  it('recorta los espacios de los bordes antes de mirar nada', () => {
    expect(normalizarAlias('  maun.muebles  ')).toBe('maun.muebles');
    expect(revisarAlias('  maun.muebles  ')).toEqual({ estado: 'valido', aviso: null });
  });

  it('frena lo que la norma del BCRA deja afuera', () => {
    expect(revisarAlias('corto')).toEqual({ estado: 'invalido', motivo: 'corto' });
    expect(revisarAlias('a'.repeat(LARGO_MAXIMO_DE_ALIAS + 1))).toEqual({
      estado: 'invalido',
      motivo: 'largo',
    });
    expect(revisarAlias('plata_del_taller')).toEqual({ estado: 'invalido', motivo: 'caracteres' });
    expect(revisarAlias('maun muebles')).toEqual({ estado: 'invalido', motivo: 'caracteres' });
    expect(revisarAlias('muebles.ñandú')).toEqual({ estado: 'invalido', motivo: 'caracteres' });
    expect(revisarAlias('maun@muebles')).toEqual({ estado: 'invalido', motivo: 'caracteres' });
  });

  // Lo que la norma no dice, avisa en vez de frenar: la lista de caracteres del BCRA no prohíbe
  // empezar con un punto ni poner dos seguidos, así que un alias así se guarda igual.
  it('avisa, sin frenar, de lo que la norma no aclara', () => {
    expect(revisarAlias('.maun.muebles')).toEqual({
      estado: 'valido',
      aviso: 'separador-en-la-punta',
    });
    expect(revisarAlias('maun.muebles-')).toEqual({
      estado: 'valido',
      aviso: 'separador-en-la-punta',
    });
    expect(revisarAlias('maun..muebles')).toEqual({
      estado: 'valido',
      aviso: 'separadores-seguidos',
    });
    expect(revisarAlias('maun-.muebles')).toEqual({
      estado: 'valido',
      aviso: 'separadores-seguidos',
    });
  });

  it('los largos son los de la norma', () => {
    expect(LARGO_MINIMO_DE_ALIAS).toBe(6);
    expect(LARGO_MAXIMO_DE_ALIAS).toBe(20);
  });
});

describe('el link de cobro del taller', () => {
  it('acepta los hosts con los que Mercado Pago reparte un cobro', () => {
    for (const host of HOSTS_DE_MERCADO_PAGO) {
      expect(revisarLinkDeCobro(`https://${host}/2vXyZ1`)).toEqual({ estado: 'valido' });
    }
  });

  it('rechaza cualquier otro sitio, aunque el nombre se le parezca', () => {
    expect(revisarLinkDeCobro('https://pagame-aca.com/taller')).toEqual({
      estado: 'invalido',
      motivo: 'otro-sitio',
    });
    expect(revisarLinkDeCobro('https://mercadopago.com.ar.pagame.net/x')).toEqual({
      estado: 'invalido',
      motivo: 'otro-sitio',
    });
    expect(revisarLinkDeCobro('https://mpago.la.otro.com/x')).toEqual({
      estado: 'invalido',
      motivo: 'otro-sitio',
    });
  });

  it('rechaza lo que no viaja cifrado', () => {
    expect(revisarLinkDeCobro('http://mpago.la/2vXyZ1')).toEqual({
      estado: 'invalido',
      motivo: 'sin-https',
    });
    expect(revisarLinkDeCobro('mpago.la/2vXyZ1')).toEqual({
      estado: 'invalido',
      motivo: 'sin-https',
    });
  });

  it('rechaza lo que no entra en la columna', () => {
    expect(revisarLinkDeCobro(`https://mpago.la/${'x'.repeat(LARGO_MAXIMO_DEL_LINK)}`)).toEqual({
      estado: 'invalido',
      motivo: 'largo',
    });
  });

  it('vacío es vacío: el campo es opcional', () => {
    expect(revisarLinkDeCobro('')).toEqual({ estado: 'vacio' });
    expect(revisarLinkDeCobro('   ')).toEqual({ estado: 'vacio' });
  });

  it('le agrega la barra al link pelado, que es lo que espera la base', () => {
    expect(normalizarLinkDeCobro('  https://mpago.la  ')).toBe('https://mpago.la/');
    expect(normalizarLinkDeCobro('https://mpago.la/2vXyZ1')).toBe('https://mpago.la/2vXyZ1');
    expect(revisarLinkDeCobro('https://link.mercadopago.com.ar')).toEqual({ estado: 'valido' });
  });

  it('esLinkDeMercadoPago es la misma regla, sin el motivo', () => {
    expect(esLinkDeMercadoPago('https://mpago.la/2vXyZ1')).toBe(true);
    expect(esLinkDeMercadoPago('https://pagame-aca.com/taller')).toBe(false);
    expect(esLinkDeMercadoPago(`https://mpago.la/${'x'.repeat(LARGO_MAXIMO_DEL_LINK)}`)).toBe(
      false,
    );
  });
});
