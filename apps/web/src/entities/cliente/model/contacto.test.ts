import { describe, expect, it } from 'vitest';

import {
  enlaceDeEmail,
  enlaceDeLlamada,
  enlaceDeMapa,
  enlaceDeWhatsapp,
  iniciales,
  nombreCorto,
  telefonoParaWhatsapp,
} from './contacto';

describe('iniciales', () => {
  it('toma la primera y la última palabra', () => {
    expect(iniciales('Ana Gómez')).toBe('AG');
    expect(iniciales('María Belén Sosa Díaz')).toBe('MD');
  });

  it('con una sola palabra devuelve una sola letra', () => {
    expect(iniciales('Carpintería')).toBe('C');
  });

  it('aguanta espacios de más y el vacío', () => {
    expect(iniciales('  Ana   Gómez  ')).toBe('AG');
    expect(iniciales('')).toBe('');
  });
});

describe('nombreCorto', () => {
  it('usa el nombre de pila para hablarle al usuario', () => {
    expect(nombreCorto('Ana Gómez')).toBe('Ana');
  });

  it('no parte los nombres que son de un grupo', () => {
    expect(nombreCorto('Familia Rossi')).toBe('Familia Rossi');
    expect(nombreCorto('Estudio Lomas')).toBe('Estudio Lomas');
  });
});

describe('telefonoParaWhatsapp', () => {
  it('arma el formato internacional desde un número escrito a mano', () => {
    expect(telefonoParaWhatsapp('11 5555-5555')).toBe('5491155555555');
    expect(telefonoParaWhatsapp('(011) 5555-5555')).toBe('5491155555555');
  });

  it('saca el 0 de adelante y el 15 del medio', () => {
    expect(telefonoParaWhatsapp('011 15 5555-5555')).toBe('5491155555555');
    expect(telefonoParaWhatsapp('0221 15 456-7890')).toBe('5492214567890');
  });

  it('respeta un número que ya viene internacional', () => {
    expect(telefonoParaWhatsapp('+54 9 11 5555-5555')).toBe('5491155555555');
    expect(telefonoParaWhatsapp('0054 9 11 5555 5555')).toBe('5491155555555');
    expect(telefonoParaWhatsapp('5491155555555')).toBe('5491155555555');
  });

  it('no inventa un número cuando no hay dígitos', () => {
    expect(telefonoParaWhatsapp('')).toBeNull();
    expect(telefonoParaWhatsapp('sin teléfono')).toBeNull();
  });
});

describe('enlaces', () => {
  it('el de llamar conserva el + para que el celular marque bien', () => {
    expect(enlaceDeLlamada('+54 9 11 5555-5555')).toBe('tel:+5491155555555');
    expect(enlaceDeLlamada('11 5555-5555')).toBe('tel:1155555555');
    expect(enlaceDeLlamada('')).toBeNull();
  });

  it('el de WhatsApp usa el número normalizado', () => {
    expect(enlaceDeWhatsapp('11 5555-5555')).toBe('https://wa.me/5491155555555');
    expect(enlaceDeWhatsapp('')).toBeNull();
  });

  it('el del mapa junta dirección y zona', () => {
    expect(enlaceDeMapa('Av. Maipú 1234', 'Olivos')).toBe(
      'https://www.google.com/maps/search/?api=1&query=Av.%20Maip%C3%BA%201234%2C%20Olivos',
    );
    expect(enlaceDeMapa('', 'Olivos')).toContain('Olivos');
    expect(enlaceDeMapa('', '')).toBeNull();
  });

  it('el de email queda deshabilitado si no hay email', () => {
    expect(enlaceDeEmail('ana@taller.com.ar')).toBe('mailto:ana@taller.com.ar');
    expect(enlaceDeEmail('   ')).toBeNull();
  });
});
