import { describe, expect, it } from 'vitest';

import { RespuestaInvalidaError } from './replica.ts';
import { leerVistaDelCliente } from './vistaCliente.ts';

function respuesta(cambios: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    taller: { nombre: 'Taller MAUN' },
    cliente: { nombre: 'Marcela Duarte' },
    trabajo: 'Placard 3 puertas',
    direccion: 'Olazábal 1240',
    estado: 'en_curso',
    precio_centavos: 124_000_000,
    sena_centavos: 62_000_000,
    fechas: {
      estimativo: '2026-07-24',
      presupuesto: '2026-08-01',
      aprobado: '2026-08-04',
      inicio: '2026-08-24',
      entrega_pautada: '2026-10-02',
      entregado: null,
      cobro: null,
      vale_hasta: null,
    },
    visita: { dia: '2026-07-28', hecha: true },
    pago: {
      instancia: 'sena',
      formas: ['transferencia', 'efectivo'],
      monto_centavos: 22_000_000,
      siguiente: {
        instancia: 'saldo',
        formas: ['efectivo'],
        monto_centavos: 62_000_000,
      },
    },
    cobro: {
      alias: 'maun.muebles',
      cbu: '0110001312345678901233',
      titular: 'Ana Gutiérrez',
      cuit: '27-30123456-4',
      link: 'https://mpago.la/2vXyZ1',
    },
    pagos: [{ id: 'p1', fecha: '2026-08-04', concepto: 'Seña', monto_centavos: 40_000_000 }],
    archivos: [
      {
        id: 'a1',
        nombre: 'Plano de frente',
        tipo: 'image/webp',
        ancho: 1600,
        alto: 900,
        fecha: '2026-08-02T12:00:00+00:00',
        ruta: 'h/p/a1.webp',
        ruta_mini: 'h/p/a1.mini.webp',
      },
    ],
    ...cambios,
  };
}

describe('leer la vista del cliente', () => {
  it('traduce lo que devuelve la base a lo que el dominio sabe leer', () => {
    expect(leerVistaDelCliente(respuesta())).toEqual({
      taller: 'Taller MAUN',
      cliente: 'Marcela Duarte',
      trabajo: 'Placard 3 puertas',
      direccion: 'Olazábal 1240',
      estado: 'en_curso',
      precio: 124_000_000,
      sena: 62_000_000,
      fechas: {
        estimativo: '2026-07-24',
        presupuesto: '2026-08-01',
        aprobado: '2026-08-04',
        inicio: '2026-08-24',
        entregaPautada: '2026-10-02',
        entregado: null,
        cobro: null,
        valeHasta: null,
      },
      visita: { dia: '2026-07-28', hecha: true },
      pago: {
        instancia: 'sena',
        formas: ['transferencia', 'efectivo'],
        monto: 22_000_000,
        siguiente: { instancia: 'saldo', formas: ['efectivo'], monto: 62_000_000 },
      },
      cobro: {
        alias: 'maun.muebles',
        cbu: '0110001312345678901233',
        titular: 'Ana Gutiérrez',
        cuit: '27-30123456-4',
        link: 'https://mpago.la/2vXyZ1',
      },
      pagos: [{ id: 'p1', fecha: '2026-08-04', concepto: 'Seña', monto: 40_000_000 }],
      archivos: [
        {
          id: 'a1',
          nombre: 'Plano de frente',
          tipo: 'image/webp',
          ancho: 1600,
          alto: 900,
          fecha: '2026-08-02T12:00:00+00:00',
          ruta: 'h/p/a1.webp',
          rutaMini: 'h/p/a1.mini.webp',
        },
      ],
    });
  });

  it('un trabajo sin presupuesto y sin nada cargado también se lee', () => {
    const vacio = leerVistaDelCliente(
      respuesta({
        precio_centavos: null,
        pagos: [],
        archivos: [],
        fechas: {
          estimativo: null,
          presupuesto: null,
          aprobado: null,
          inicio: null,
          entrega_pautada: null,
          entregado: null,
          cobro: null,
        },
        visita: { dia: null, hecha: false },
      }),
    );
    expect(vacio.precio).toBeNull();
    expect(vacio.pagos).toEqual([]);
    expect(vacio.fechas.estimativo).toBeNull();
    expect(vacio.visita).toEqual({ dia: null, hecha: false });
  });

  it('esperando la seña, lee hasta cuándo vale el presupuesto y la seña en pesos', () => {
    const esperando = leerVistaDelCliente(
      respuesta({
        estado: 'presupuesto_enviado',
        direccion: '',
        sena_centavos: 62_400_000,
        fechas: {
          estimativo: null,
          presupuesto: '2026-09-14',
          aprobado: null,
          inicio: null,
          entrega_pautada: null,
          entregado: null,
          cobro: null,
          vale_hasta: '2026-10-02',
        },
      }),
    );
    expect(esperando.fechas.valeHasta).toBe('2026-10-02');
    expect(esperando.sena).toBe(62_400_000);
    expect(esperando.direccion).toBe('');
  });

  it('una respuesta de antes, sin la seña en pesos ni hasta cuándo vale, se lee sin seña y sin fecha', () => {
    const { sena_centavos: _sena, ...sinSena } = respuesta();
    const vieja = leerVistaDelCliente({
      ...sinSena,
      fechas: {
        estimativo: null,
        presupuesto: '2026-08-01',
        aprobado: null,
        inicio: null,
        entrega_pautada: null,
        entregado: null,
        cobro: null,
      },
    });
    expect(vieja.sena).toBeNull();
    expect(vieja.fechas.valeHasta).toBeNull();
  });

  it('una respuesta de antes, sin el día del estimativo ni la visita, se lee como que no hubo', () => {
    const vieja = leerVistaDelCliente(
      respuesta({
        fechas: {
          presupuesto: '2026-08-01',
          aprobado: null,
          inicio: null,
          entrega_pautada: null,
          entregado: null,
          cobro: null,
        },
        visita: undefined,
      }),
    );
    expect(vieja.fechas.estimativo).toBeNull();
    expect(vieja.visita).toEqual({ dia: null, hecha: false });
  });

  it('un PDF viene sin medidas', () => {
    const conPdf = leerVistaDelCliente(
      respuesta({
        archivos: [
          {
            id: 'a2',
            nombre: 'Presupuesto.pdf',
            tipo: 'application/pdf',
            ancho: null,
            alto: null,
            fecha: '2026-08-01T12:00:00+00:00',
            ruta: 'h/p/a2.pdf',
            ruta_mini: 'h/p/a2.pdf',
          },
        ],
      }),
    );
    expect(conPdf.archivos[0]?.ancho).toBeNull();
  });

  it('no le cree a una respuesta que no tiene la forma que tiene que tener', () => {
    for (const rota of [
      null,
      'texto',
      respuesta({ taller: null }),
      respuesta({ cliente: {} }),
      respuesta({ trabajo: 7 }),
      respuesta({ direccion: null }),
      respuesta({ estado: null }),
      respuesta({ precio_centavos: '124' }),
      respuesta({ sena_centavos: '62' }),
      respuesta({ fechas: null }),
      respuesta({ fechas: { vale_hasta: 20261002 } }),
      respuesta({ fechas: { presupuesto: 1 } }),
      respuesta({ fechas: { estimativo: 20260724 } }),
      respuesta({ visita: 'mañana' }),
      respuesta({ visita: { dia: '2026-07-28' } }),
      respuesta({ visita: { dia: '2026-07-28', hecha: 'sí' } }),
      respuesta({ visita: { dia: 28, hecha: true } }),
      respuesta({ pagos: null }),
      respuesta({ pagos: [{ id: 'p1', fecha: '2026-08-04', concepto: 'Seña' }] }),
      respuesta({ pagos: [{ id: 1, fecha: '2026-08-04', concepto: 'x', monto_centavos: 1 }] }),
      respuesta({ archivos: null }),
      respuesta({ archivos: [{ id: 'a1' }] }),
    ]) {
      expect(() => leerVistaDelCliente(rota)).toThrow(RespuestaInvalidaError);
    }
  });
});

describe('el pago que toca', () => {
  it('lee la instancia, las formas, el importe y el pago que sigue', () => {
    expect(leerVistaDelCliente(respuesta()).pago).toEqual({
      instancia: 'sena',
      formas: ['transferencia', 'efectivo'],
      monto: 22_000_000,
      siguiente: { instancia: 'saldo', formas: ['efectivo'], monto: 62_000_000 },
    });
  });

  it('sin otro pago después, siguiente queda en null', () => {
    const leido = leerVistaDelCliente(
      respuesta({
        pago: {
          instancia: 'saldo',
          formas: ['efectivo'],
          monto_centavos: 1,
          siguiente: null,
        },
      }),
    );
    expect(leido.pago.siguiente).toBeNull();
  });

  it('una respuesta vieja, sin la clave siguiente, tampoco rompe', () => {
    const leido = leerVistaDelCliente(
      respuesta({ pago: { instancia: 'saldo', formas: ['efectivo'], monto_centavos: 1 } }),
    );
    expect(leido.pago.siguiente).toBeNull();
  });

  it('sin instancia no hay nada que pagar', () => {
    const leido = leerVistaDelCliente(
      respuesta({ pago: { instancia: null, formas: [], monto_centavos: null, siguiente: null } }),
    );
    expect(leido.pago).toEqual({ instancia: null, formas: [], monto: null, siguiente: null });
  });

  it('una respuesta vieja, sin la clave, no rompe la vista', () => {
    expect(leerVistaDelCliente(respuesta({ pago: undefined })).pago).toEqual({
      instancia: null,
      formas: [],
      monto: null,
      siguiente: null,
    });
  });

  it('una forma que esta versión no conoce se ignora en vez de romper la página del cliente', () => {
    const leido = leerVistaDelCliente(
      respuesta({
        pago: { instancia: 'saldo', formas: ['efectivo', 'cripto'], monto_centavos: 1 },
      }),
    );
    expect(leido.pago.formas).toEqual(['efectivo']);
  });

  it('una instancia que no existe no se cree', () => {
    expect(() =>
      leerVistaDelCliente(
        respuesta({ pago: { instancia: 'visita', formas: [], monto_centavos: null } }),
      ),
    ).toThrow(RespuestaInvalidaError);
  });

  it('ni un importe que no es un número', () => {
    expect(() =>
      leerVistaDelCliente(
        respuesta({ pago: { instancia: 'sena', formas: [], monto_centavos: '100' } }),
      ),
    ).toThrow(RespuestaInvalidaError);
  });
});

describe('los datos para transferir', () => {
  it('lo que el dueño no cargó llega en null y se queda en null', () => {
    const leido = leerVistaDelCliente(
      respuesta({ cobro: { alias: null, cbu: null, titular: null, cuit: null } }),
    );
    expect(leido.cobro).toEqual({ alias: null, cbu: null, titular: null, cuit: null, link: null });
  });

  it('una cadena vacía o con espacios se lee como que no hay dato', () => {
    const leido = leerVistaDelCliente(
      respuesta({ cobro: { alias: '', cbu: '  ', titular: null, cuit: '' } }),
    );
    expect(leido.cobro).toEqual({ alias: null, cbu: null, titular: null, cuit: null, link: null });
  });

  it('una respuesta vieja, sin la clave, no rompe la vista', () => {
    const leido = leerVistaDelCliente(respuesta({ cobro: undefined }));
    expect(leido.cobro).toEqual({ alias: null, cbu: null, titular: null, cuit: null, link: null });
  });

  it('y lo que vino con algo adentro se lee recortado', () => {
    const leido = leerVistaDelCliente(
      respuesta({ cobro: { alias: '  maun.muebles ', cbu: null, titular: null, cuit: null } }),
    );
    expect(leido.cobro.alias).toBe('maun.muebles');
  });

  it('un dato que no es texto no se cree', () => {
    expect(() => leerVistaDelCliente(respuesta({ cobro: { alias: 42 } }))).toThrow(
      RespuestaInvalidaError,
    );
  });
});

describe('el link de Mercado Pago', () => {
  it('se lee cuando la base lo manda', () => {
    const leido = leerVistaDelCliente(
      respuesta({
        cobro: {
          alias: null,
          cbu: null,
          titular: null,
          cuit: null,
          link: ' https://mpago.la/2vXyZ1 ',
        },
      }),
    );
    expect(leido.cobro.link).toBe('https://mpago.la/2vXyZ1');
  });

  it('un link que no es de Mercado Pago se descarta: esta página la abre un desconocido', () => {
    for (const link of [
      'https://pagame-aca.com/taller',
      'http://mpago.la/2vXyZ1',
      'javascript:alert(1)',
    ]) {
      const leido = leerVistaDelCliente(
        respuesta({ cobro: { alias: null, cbu: null, titular: null, cuit: null, link } }),
      );
      expect(leido.cobro.link).toBeNull();
    }
  });
});
