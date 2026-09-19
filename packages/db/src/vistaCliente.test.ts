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
    fechas: {
      presupuesto: '2026-08-01',
      aprobado: '2026-08-04',
      inicio: '2026-08-24',
      entrega_pautada: '2026-10-02',
      entregado: null,
      cobro: null,
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
      fechas: {
        presupuesto: '2026-08-01',
        aprobado: '2026-08-04',
        inicio: '2026-08-24',
        entregaPautada: '2026-10-02',
        entregado: null,
        cobro: null,
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
          presupuesto: null,
          aprobado: null,
          inicio: null,
          entrega_pautada: null,
          entregado: null,
          cobro: null,
        },
      }),
    );
    expect(vacio.precio).toBeNull();
    expect(vacio.pagos).toEqual([]);
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
      respuesta({ fechas: null }),
      respuesta({ fechas: { presupuesto: 1 } }),
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
