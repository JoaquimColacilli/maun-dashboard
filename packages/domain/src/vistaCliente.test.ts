import { describe, expect, it } from 'vitest';

import { centavos, type Money } from './money.ts';
import {
  comoPagar,
  HITOS,
  PASOS_PARA_TRANSFERIR,
  vistaDelCliente,
  hayComoTransferir,
  type PagoDelCliente,
  type TrabajoDelCliente,
} from './vistaCliente.ts';

const HOY = '2026-09-18';

// El cliente ya no ve cuánto hace que no pasa nada: lo pone a echar cuentas contra el taller y en
// una obra de muebles pasan semanas sin un hito. Lo que ve son fechas y qué sigue (ADR 0046).
const HACE_TANTOS_DIAS = new RegExp(String.raw`[Hh]ace \d`);

function pago(id: string, fecha: string, monto: number, concepto = 'Pago'): PagoDelCliente {
  return { id, fecha, concepto, monto: centavos(monto) };
}

function trabajo(cambios: Partial<TrabajoDelCliente> = {}): TrabajoDelCliente {
  return {
    taller: 'Taller MAUN',
    cliente: 'Marcela Duarte',
    trabajo: 'Placard 3 puertas',
    direccion: 'Olazábal 1240',
    estado: 'en_curso',
    precio: centavos(124_000_000),
    fechas: {
      presupuesto: null,
      aprobado: null,
      inicio: null,
      entregaPautada: null,
      entregado: null,
      cobro: null,
    },
    pago: { instancia: null, formas: [], monto: null, siguiente: null },
    cobro: { alias: null, cbu: null, titular: null, cuit: null },
    pagos: [],
    archivos: [],
    ...cambios,
  };
}

describe('el saldo y lo pagado', () => {
  it('suma los pagos y resta del precio', () => {
    const vista = vistaDelCliente(
      trabajo({
        pagos: [pago('p1', '2026-08-04', 40_000_000), pago('p2', '2026-09-02', 40_000_000)],
      }),
      HOY,
    );
    expect(vista.pagado).toBe(80_000_000);
    expect(vista.saldo).toBe(44_000_000);
    expect(vista.saldado).toBe(false);
  });

  it('sin presupuesto no hay saldo, y no está saldado', () => {
    const vista = vistaDelCliente(
      trabajo({ precio: null, pagos: [pago('p1', '2026-08-04', 1_000)] }),
      HOY,
    );
    expect(vista.saldo).toBeNull();
    expect(vista.saldado).toBe(false);
  });

  it('pagar de más sigue estando saldado', () => {
    const vista = vistaDelCliente(
      trabajo({ precio: centavos(1_000), pagos: [pago('p1', '2026-08-04', 1_500)] }),
      HOY,
    );
    expect(vista.saldo).toBe(-500);
    expect(vista.saldado).toBe(true);
  });
});

describe('el hito en el que está el trabajo', () => {
  it('lo que todavía está en seguimiento está en el presupuesto', () => {
    for (const estado of ['contacto', 'relevamiento', 'presupuesto_enviado'] as const) {
      expect(vistaDelCliente(trabajo({ estado }), HOY).hitoActual).toBe('presupuesto');
    }
  });

  it('aprobado pero sin empezar es «aprobado», y con el inicio ya pasado es «en fabricación»', () => {
    expect(vistaDelCliente(trabajo({ estado: 'en_curso' }), HOY).hitoActual).toBe('aprobado');
    expect(
      vistaDelCliente(
        trabajo({ estado: 'en_curso', fechas: { ...trabajo().fechas, inicio: '2026-09-25' } }),
        HOY,
      ).hitoActual,
    ).toBe('aprobado');
    expect(
      vistaDelCliente(
        trabajo({ estado: 'en_curso', fechas: { ...trabajo().fechas, inicio: '2026-08-24' } }),
        HOY,
      ).hitoActual,
    ).toBe('fabricacion');
  });

  it('entregado con saldo es «entregado», y entregado sin saldo ya es «pagado»', () => {
    const entregado = trabajo({
      estado: 'entregado',
      fechas: { ...trabajo().fechas, entregado: '2026-09-16' },
      pagos: [pago('p1', '2026-08-04', 40_000_000)],
    });
    expect(vistaDelCliente(entregado, HOY).hitoActual).toBe('entregado');
    expect(
      vistaDelCliente({ ...entregado, pagos: [pago('p1', '2026-08-04', 124_000_000)] }, HOY)
        .hitoActual,
    ).toBe('pagado');
  });

  it('cobrado es «pagado» aunque el saldo no dé cero', () => {
    expect(vistaDelCliente(trabajo({ estado: 'cobrado' }), HOY).hitoActual).toBe('pagado');
  });

  it('un estado que la vista pública nunca sirve cae en el primer hito', () => {
    expect(vistaDelCliente(trabajo({ estado: 'perdido' }), HOY).hitoActual).toBe('presupuesto');
  });
});

describe('el camino', () => {
  it('son siempre los cinco hitos, en orden', () => {
    const vista = vistaDelCliente(trabajo(), HOY);
    expect(vista.hitos.map((hito) => hito.id)).toEqual(HITOS.map((hito) => hito.id));
  });

  it('los que faltan no muestran fecha: dicen qué va a pasar', () => {
    const vista = vistaDelCliente(
      trabajo({
        estado: 'en_curso',
        fechas: {
          ...trabajo().fechas,
          presupuesto: '2026-08-01',
          aprobado: '2026-08-04',
          inicio: '2026-08-24',
        },
      }),
      HOY,
    );
    const futuros = vista.hitos.filter((hito) => hito.estado === 'futuro');
    expect(futuros.map((hito) => hito.id)).toEqual(['entregado', 'pagado']);
    expect(futuros.every((hito) => hito.fecha === null)).toBe(true);
    expect(futuros.map((hito) => hito.texto)).toEqual([
      'Lo llevamos y lo instalamos',
      'Cuando esté saldado',
    ]);
  });

  it('el pasado lleva su fecha y su etiqueta, y el actual habla en presente', () => {
    const vista = vistaDelCliente(
      trabajo({
        estado: 'en_curso',
        fechas: {
          ...trabajo().fechas,
          presupuesto: '2026-08-01',
          aprobado: '2026-08-04',
          inicio: '2026-08-24',
        },
      }),
      HOY,
    );
    expect(vista.hitos[0]).toEqual({
      id: 'presupuesto',
      etiqueta: 'Presupuesto enviado',
      estado: 'pasado',
      fecha: '2026-08-01',
      texto: 'Presupuesto enviado',
    });
    expect(vista.hitos[2]).toEqual({
      id: 'fabricacion',
      etiqueta: 'En fabricación',
      estado: 'actual',
      fecha: '2026-08-24',
      texto: 'Lo estamos fabricando',
    });
  });

  it('sin la fecha de aprobación guardada, el hito la toma del primer pago', () => {
    const vista = vistaDelCliente(
      trabajo({ estado: 'en_curso', pagos: [pago('p1', '2026-08-04', 40_000_000)] }),
      HOY,
    );
    expect(vista.hitos[1]?.fecha).toBe('2026-08-04');
  });

  it('sin fecha de cobro, el hito pagado toma la del último pago que lo saldó', () => {
    const vista = vistaDelCliente(
      trabajo({
        estado: 'entregado',
        fechas: { ...trabajo().fechas, entregado: '2026-09-16' },
        pagos: [pago('p1', '2026-08-04', 100_000_000), pago('p2', '2026-09-17', 24_000_000)],
      }),
      HOY,
    );
    expect(vista.hitos[4]).toMatchObject({ estado: 'actual', fecha: '2026-09-17' });
  });

  it('y con fecha de cobro, esa manda', () => {
    const vista = vistaDelCliente(
      trabajo({
        estado: 'cobrado',
        fechas: { ...trabajo().fechas, entregado: '2026-09-16', cobro: '2026-09-18' },
        pagos: [pago('p1', '2026-08-04', 124_000_000)],
      }),
      HOY,
    );
    expect(vista.hitos[4]?.fecha).toBe('2026-09-18');
  });

  it('un trabajo sin nada todavía no promete ninguna fecha', () => {
    const vista = vistaDelCliente(trabajo({ estado: 'contacto' }), HOY);
    expect(vista.hitos.every((hito) => hito.fecha === null)).toBe(true);
  });

  it('un trabajo de cero está saldado sin ningún pago, y entonces no hay día que mostrar', () => {
    const vista = vistaDelCliente(trabajo({ estado: 'entregado', precio: centavos(0) }), HOY);
    expect(vista.saldado).toBe(true);
    expect(vista.hitoActual).toBe('pagado');
    expect(vista.hitos[4]?.fecha).toBeNull();
  });
});

describe('lo que fue pasando', () => {
  it('arma la línea de tiempo con lo que ya está guardado, del más nuevo al más viejo', () => {
    const vista = vistaDelCliente(
      trabajo({
        estado: 'en_curso',
        fechas: { ...trabajo().fechas, presupuesto: '2026-08-01', inicio: '2026-09-06' },
        pagos: [pago('p1', '2026-08-04', 40_000_000), pago('p2', '2026-09-02', 40_000_000)],
      }),
      HOY,
    );
    expect(vista.eventos.map((evento) => [evento.fecha, evento.texto])).toEqual([
      ['2026-09-06', 'Empezamos a fabricarlo en el taller'],
      ['2026-09-02', 'Recibimos un adelanto'],
      ['2026-08-04', 'Recibimos tu seña y quedó aprobado'],
      ['2026-08-01', 'Te pasamos el presupuesto'],
    ]);
  });

  it('el pago que salda el trabajo lo dice, y lleva su importe aparte del texto', () => {
    const vista = vistaDelCliente(
      trabajo({
        estado: 'entregado',
        fechas: { ...trabajo().fechas, entregado: '2026-09-16' },
        pagos: [pago('p1', '2026-08-04', 100_000_000), pago('p2', '2026-09-17', 24_000_000)],
      }),
      HOY,
    );
    expect(vista.eventos[0]).toEqual({
      id: 'p2',
      fecha: '2026-09-17',
      texto: 'Recibimos el saldo y quedó saldado',
      hito: 'pagado',
      monto: 24_000_000,
    });
  });

  it('un único pago que cubre todo no se llama seña ni saldo', () => {
    const vista = vistaDelCliente(
      trabajo({ estado: 'entregado', pagos: [pago('p1', '2026-09-17', 124_000_000)] }),
      HOY,
    );
    expect(vista.eventos[0]?.texto).toBe('Recibimos el pago y quedó saldado');
  });

  it('dos cosas el mismo día se ordenan por el camino: la entrega después del pago', () => {
    const vista = vistaDelCliente(
      trabajo({
        estado: 'entregado',
        fechas: { ...trabajo().fechas, inicio: '2026-09-16', entregado: '2026-09-16' },
        pagos: [pago('p1', '2026-09-16', 40_000_000)],
      }),
      HOY,
    );
    expect(vista.eventos.map((evento) => evento.hito)).toEqual([
      'entregado',
      'fabricacion',
      'aprobado',
    ]);
  });

  it('dos pagos el mismo día conservan su orden, el más nuevo arriba', () => {
    const vista = vistaDelCliente(
      trabajo({
        pagos: [pago('p1', '2026-09-16', 10_000), pago('p2', '2026-09-16', 20_000)],
      }),
      HOY,
    );
    expect(vista.eventos.map((evento) => evento.id)).toEqual(['p2', 'p1']);
  });

  it('un trabajo recién cargado no tiene nada que contar', () => {
    expect(vistaDelCliente(trabajo({ estado: 'contacto' }), HOY).eventos).toEqual([]);
  });
});

describe('la vista no le cuenta al cliente cuánto hace que no pasa nada', () => {
  it('de un trabajo quieto hace días sale lo que sigue, no el silencio', () => {
    const vista = vistaDelCliente(
      trabajo({
        estado: 'en_curso',
        fechas: { ...trabajo().fechas, inicio: '2026-08-01' },
      }),
      HOY,
    );
    expect(vista.sigue).toBe('Lo próximo que vas a ver acá es la entrega.');
    expect(JSON.stringify(vista)).not.toMatch(HACE_TANTOS_DIAS);
  });

  it('ni de uno recién arrancado, ni de uno sin nada cargado', () => {
    for (const cambios of [
      { estado: 'en_curso' as const, fechas: { ...trabajo().fechas, inicio: '2026-09-17' } },
      { estado: 'contacto' as const },
      { estado: 'entregado' as const, fechas: { ...trabajo().fechas, entregado: HOY } },
    ]) {
      expect(JSON.stringify(vistaDelCliente(trabajo(cambios), HOY))).not.toMatch(HACE_TANTOS_DIAS);
    }
  });

  it('saldado no promete nada más', () => {
    const vista = vistaDelCliente(
      trabajo({ estado: 'cobrado', pagos: [pago('p1', '2026-09-17', 124_000_000)] }),
      HOY,
    );
    expect(vista.sigue).toBe('');
  });
});

describe('qué se lee primero', () => {
  it('antes de la entrega manda la etapa', () => {
    const vista = vistaDelCliente(
      trabajo({ estado: 'en_curso', fechas: { ...trabajo().fechas, inicio: '2026-08-24' } }),
      HOY,
    );
    expect(vista.foco).toBe('estado');
  });

  it('desde la entrega, con saldo pendiente, manda el saldo', () => {
    const vista = vistaDelCliente(
      trabajo({
        estado: 'entregado',
        fechas: { ...trabajo().fechas, entregado: '2026-09-16' },
        pagos: [pago('p1', '2026-08-04', 40_000_000)],
      }),
      HOY,
    );
    expect(vista.foco).toBe('saldo');
  });

  it('entregado y saldado vuelve a la etapa: no hay cifra que cobrar', () => {
    const vista = vistaDelCliente(
      trabajo({
        estado: 'entregado',
        fechas: { ...trabajo().fechas, entregado: '2026-09-16' },
        pagos: [pago('p1', '2026-08-04', 124_000_000)],
      }),
      HOY,
    );
    expect(vista.foco).toBe('estado');
  });

  it('entregado sin presupuesto tampoco tiene saldo que mostrar', () => {
    const vista = vistaDelCliente(
      trabajo({
        estado: 'entregado',
        precio: null,
        fechas: { ...trabajo().fechas, entregado: '2026-09-16' },
      }),
      HOY,
    );
    expect(vista.foco).toBe('estado');
  });
});

describe('lo que viaja es lo que llegó', () => {
  it('el trabajo queda tal cual: la vista solo agrega lo que deriva', () => {
    const entrada = trabajo({
      archivos: [
        {
          id: 'a1',
          nombre: 'Plano de frente',
          tipo: 'image/webp',
          ancho: 1600,
          alto: 900,
          fecha: '2026-08-02T12:00:00Z',
          ruta: 'h/p/a1.webp',
          rutaMini: 'h/p/a1.mini.webp',
        },
      ],
    });
    const vista = vistaDelCliente(entrada, HOY);
    expect(vista.trabajo).toBe(entrada);
    expect(vista.trabajo.archivos).toHaveLength(1);
  });
});

describe('los importes son centavos enteros con marca', () => {
  it('lo pagado sale de sumar los pagos', () => {
    const total: Money = vistaDelCliente(
      trabajo({ pagos: [pago('p1', '2026-08-04', 1), pago('p2', '2026-08-05', 2)] }),
      HOY,
    ).pagado;
    expect(total).toBe(3);
  });
});

describe('si hay cómo transferirle al taller', () => {
  it('alcanza con el alias o con el CBU: eso es lo que el cliente pega en su banco', () => {
    expect(hayComoTransferir({ alias: 'maun.muebles', cbu: null, titular: null, cuit: null })).toBe(
      true,
    );
    expect(
      hayComoTransferir({
        alias: null,
        cbu: '0110001312345678901233',
        titular: null,
        cuit: null,
      }),
    ).toBe(true);
  });

  it('el titular y el CUIT solos no alcanzan: con eso no se transfiere', () => {
    expect(
      hayComoTransferir({
        alias: null,
        cbu: null,
        titular: 'Ana Gutiérrez',
        cuit: '27-30123456-4',
      }),
    ).toBe(false);
    expect(hayComoTransferir({ alias: null, cbu: null, titular: null, cuit: null })).toBe(false);
  });
});

describe('cómo puede pagar el cliente lo que le toca', () => {
  const CUENTA = {
    alias: 'maun.muebles',
    cbu: '0110001312345678901233',
    titular: 'Ana Gutiérrez',
    cuit: null,
  };

  it('con todo pagado no hay nada que ofrecer', () => {
    expect(comoPagar(trabajo())).toBeNull();
  });

  it('por transferencia arma el importe listo para pegar en el banco', () => {
    const como = comoPagar(
      trabajo({
        cobro: CUENTA,
        pago: {
          instancia: 'sena',
          formas: ['transferencia'],
          monto: centavos(150_000_000),
          siguiente: null,
        },
      }),
    );
    expect(como).toMatchObject({
      instancia: 'sena',
      transferencia: true,
      efectivo: false,
      faltanLosDatos: false,
      montoParaPegar: '1500000',
      etiquetaDelImporte: 'Ahora, la seña',
    });
    expect(como?.pasos).toBe(PASOS_PARA_TRANSFERIR);
  });

  it('en efectivo lo dice sin decir «también»: no hay otra forma', () => {
    const como = comoPagar(
      trabajo({
        cobro: CUENTA,
        pago: {
          instancia: 'saldo',
          formas: ['efectivo'],
          monto: centavos(44_000_000),
          siguiente: null,
        },
      }),
    );
    expect(como).toMatchObject({ transferencia: false, efectivo: true });
    expect(como?.enEfectivo).toBe('El saldo es en efectivo, en mano. Lo coordinás con el taller.');
  });

  it('con las dos, la línea del efectivo es la segunda opción', () => {
    const como = comoPagar(
      trabajo({
        cobro: CUENTA,
        pago: {
          instancia: 'saldo',
          formas: ['transferencia', 'efectivo'],
          monto: centavos(44_000_000),
          siguiente: null,
        },
      }),
    );
    expect(como).toMatchObject({ transferencia: true, efectivo: true });
    expect(como?.enEfectivo).toContain('también');
  });

  it('si pide transferencia y el taller no cargó la cuenta, lo dice en vez de mostrar un bloque vacío', () => {
    const como = comoPagar(
      trabajo({
        pago: {
          instancia: 'sena',
          formas: ['transferencia'],
          monto: centavos(100),
          siguiente: null,
        },
      }),
    );
    expect(como).toMatchObject({ transferencia: false, efectivo: false, faltanLosDatos: true });
  });

  it('sin importe todavía, no hay nada que copiar', () => {
    const como = comoPagar(
      trabajo({
        precio: null,
        cobro: CUENTA,
        pago: {
          instancia: 'sena',
          formas: ['transferencia', 'efectivo'],
          monto: null,
          siguiente: null,
        },
      }),
    );
    expect(como?.monto).toBeNull();
    expect(como?.montoParaPegar).toBeNull();
  });

  it('cuando hay otro pago después, lo nombra con su importe y con cómo se paga', () => {
    const como = comoPagar(
      trabajo({
        cobro: CUENTA,
        pago: {
          instancia: 'sena',
          formas: ['transferencia'],
          monto: centavos(50_000_000),
          siguiente: {
            instancia: 'saldo',
            formas: ['efectivo'],
            monto: centavos(80_000_000),
          },
        },
      }),
    );

    expect(como?.siguiente).toEqual({
      instancia: 'saldo',
      monto: centavos(80_000_000),
      nombre: 'el saldo',
      comoSePaga: 'en efectivo',
    });
  });

  it('el «cómo se paga» del que sigue nombra las dos formas cuando las hay', () => {
    const conLasDos = comoPagar(
      trabajo({
        cobro: CUENTA,
        pago: {
          instancia: 'sena',
          formas: ['transferencia'],
          monto: centavos(1),
          siguiente: { instancia: 'saldo', formas: ['transferencia', 'efectivo'], monto: null },
        },
      }),
    );
    expect(conLasDos?.siguiente?.comoSePaga).toBe('por transferencia o en efectivo');

    const soloTransferencia = comoPagar(
      trabajo({
        cobro: CUENTA,
        pago: {
          instancia: 'sena',
          formas: ['efectivo'],
          monto: centavos(1),
          siguiente: { instancia: 'saldo', formas: ['transferencia'], monto: centavos(2) },
        },
      }),
    );
    expect(soloTransferencia?.siguiente?.comoSePaga).toBe('por transferencia');
  });

  it('sin otro pago después, no hay nada que anticipar', () => {
    const como = comoPagar(
      trabajo({
        cobro: CUENTA,
        pago: {
          instancia: 'saldo',
          formas: ['efectivo'],
          monto: centavos(1),
          siguiente: null,
        },
      }),
    );

    expect(como?.siguiente).toBeNull();
  });

  it('ningún texto del cliente dice «arreglar»: acá se lee como reparar', () => {
    for (const instancia of ['sena', 'saldo'] as const) {
      for (const formas of [
        ['transferencia'],
        ['efectivo'],
        ['transferencia', 'efectivo'],
      ] as const) {
        const como = comoPagar(
          trabajo({
            cobro: CUENTA,
            pago: { instancia, formas, monto: centavos(1_000), siguiente: null },
          }),
        );
        expect(JSON.stringify(como)).not.toMatch(/arregl/i);
      }
    }
  });
});
