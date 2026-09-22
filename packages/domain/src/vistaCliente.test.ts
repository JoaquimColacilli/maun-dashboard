import { describe, expect, it } from 'vitest';

import { centavos, type Money } from './money.ts';
import type { FormaDeCobro } from './pagos.ts';
import {
  ARMAMOS_EL_PRESUPUESTO,
  CERRANDO_EL_PRESUPUESTO,
  comoPagar,
  FALTA_MEDIR_DEL_ESTIMADO,
  FUIMOS_A_MEDIR,
  HITO_DEL_ESTIMATIVO,
  HITOS,
  llegoAl,
  NOTA_DEL_RELEVAMIENTO,
  notaDelRelevamiento,
  PASOS_PARA_TRANSFERIR,
  PRESUPUESTO_MANDADO,
  RESUMEN_FALTA_MEDIR,
  SIGUE,
  SIGUE_CON_EL_PRESUPUESTO_MANDADO,
  SIGUE_FALTA_MEDIR,
  SIN_FECHA_PARA_LA_VISITA,
  TE_PASAMOS_EL_ESTIMATIVO,
  tuvoEstimativo,
  vistaDelCliente,
  hayComoTransferir,
  type CobroDelTaller,
  type EstadoDelHito,
  type EstadoDelRelevamiento,
  type FechasDelTrabajo,
  type FormatosDeFecha,
  type HitoDelTrabajo,
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
      estimativo: null,
      presupuesto: null,
      aprobado: null,
      inicio: null,
      entregaPautada: null,
      entregado: null,
      cobro: null,
    },
    visita: { dia: null, hecha: false },
    pago: { instancia: null, formas: [], monto: null, siguiente: null },
    cobro: { alias: null, cbu: null, titular: null, cuit: null, link: null },
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
  it('sin estimativo son los cinco hitos, en orden', () => {
    const vista = vistaDelCliente(trabajo(), HOY);
    expect(vista.hitos.map((hito) => hito.id)).toEqual(HITOS.map((hito) => hito.id));
  });

  it('con estimativo, el estimativo va primero y los otros cinco siguen igual', () => {
    const vista = vistaDelCliente(
      trabajo({ fechas: { ...trabajo().fechas, estimativo: '2026-08-20' } }),
      HOY,
    );
    expect(vista.hitos.map((hito) => hito.id)).toEqual([
      HITO_DEL_ESTIMATIVO.id,
      ...HITOS.map((hito) => hito.id),
    ]);
    expect(vista.hitos[0]).toMatchObject({
      estado: 'pasado',
      fecha: '2026-08-20',
      texto: 'Te pasamos un número estimado',
    });
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
    expect(
      hayComoTransferir({
        alias: 'maun.muebles',
        cbu: null,
        titular: null,
        cuit: null,
        link: null,
      }),
    ).toBe(true);
    expect(
      hayComoTransferir({
        alias: null,
        cbu: '0110001312345678901233',
        titular: null,
        cuit: null,
        link: null,
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
        link: null,
      }),
    ).toBe(false);
    expect(
      hayComoTransferir({ alias: null, cbu: null, titular: null, cuit: null, link: null }),
    ).toBe(false);
  });
});

describe('cómo puede pagar el cliente lo que le toca', () => {
  const CUENTA = {
    alias: 'maun.muebles',
    cbu: '0110001312345678901233',
    titular: 'Ana Gutiérrez',
    cuit: null,
    link: null,
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

describe('el link de Mercado Pago del taller', () => {
  const CON_LINK: CobroDelTaller = {
    alias: 'maun.muebles',
    cbu: '0110001312345678901233',
    titular: 'Ana Gutiérrez',
    cuit: null,
    link: 'https://mpago.la/2vXyZ1',
  };

  const SOLO_EL_LINK: CobroDelTaller = {
    alias: null,
    cbu: null,
    titular: null,
    cuit: null,
    link: 'https://mpago.la/2vXyZ1',
  };

  function conCobro(cobro: CobroDelTaller, formas: readonly FormaDeCobro[]) {
    return comoPagar(
      trabajo({
        cobro,
        pago: { instancia: 'sena', formas, monto: centavos(45_000_000), siguiente: null },
      }),
    );
  }

  it('lo devuelve sin tocar los pasos: el alias sigue siendo la forma sin comisión', () => {
    const como = conCobro(CON_LINK, ['transferencia']);
    expect(como?.link).toBe('https://mpago.la/2vXyZ1');
    expect(como?.pasos).toBe(PASOS_PARA_TRANSFERIR);
  });

  it('sin link los pasos son los mismos', () => {
    const como = conCobro({ ...CON_LINK, link: null }, ['transferencia']);
    expect(como?.link).toBeNull();
    expect(como?.pasos).toBe(PASOS_PARA_TRANSFERIR);
  });

  it('con link, la cuenta es de Mercado Pago aunque el CBU sea de un banco', () => {
    expect(conCobro(CON_LINK, ['transferencia'])?.mercadoPago).toBe(true);
  });

  it('sin link y con un CBU de banco, no', () => {
    expect(conCobro({ ...CON_LINK, link: null }, ['transferencia'])?.mercadoPago).toBe(false);
  });

  it('sin link pero con un CVU de Mercado Pago, sí', () => {
    const cobro = { ...CON_LINK, link: null, cbu: '0000003100012345678907' };
    expect(conCobro(cobro, ['transferencia'])?.mercadoPago).toBe(true);
  });

  it('en efectivo no hay cuenta que mirar, así que tampoco es de Mercado Pago', () => {
    const cobro = { ...CON_LINK, link: null, cbu: '0000003100012345678907' };
    expect(conCobro(cobro, ['efectivo'])?.mercadoPago).toBe(false);
  });

  it('sin ningún dato cargado, tampoco', () => {
    const vacio = { alias: null, cbu: null, titular: null, cuit: null, link: null };
    expect(conCobro(vacio, ['transferencia'])?.mercadoPago).toBe(false);
  });

  it('no viaja si ese pago es en efectivo, igual que la cuenta', () => {
    const como = conCobro(CON_LINK, ['efectivo']);
    expect(como?.link).toBeNull();
    expect(como?.transferencia).toBe(false);
  });

  it('tener solo el link ya alcanza para poder cobrar sin efectivo', () => {
    expect(hayComoTransferir(SOLO_EL_LINK)).toBe(true);
    const como = conCobro(SOLO_EL_LINK, ['transferencia']);
    expect(como?.transferencia).toBe(true);
    expect(como?.faltanLosDatos).toBe(false);
    expect(como?.link).toBe('https://mpago.la/2vXyZ1');
  });
});

describe('un trabajo guardado por una versión vieja de la app', () => {
  it('no rompe: sin «pago» no hay nada que cobrar, y la página se dibuja igual', () => {
    const { pago: _pago, ...viejo } = trabajo();
    const comoLoGuardoLaVersionVieja = viejo as unknown as TrabajoDelCliente;

    expect(() => comoPagar(comoLoGuardoLaVersionVieja)).not.toThrow();
    expect(comoPagar(comoLoGuardoLaVersionVieja)).toBeNull();
    expect(() => vistaDelCliente(comoLoGuardoLaVersionVieja, HOY)).not.toThrow();
  });

  it('sin la fecha del estimativo ni la visita, dibuja el camino de siempre', () => {
    const base = trabajo({ estado: 'relevamiento' });
    const { visita: _visita, ...sinVisita } = base;
    const { estimativo: _estimativo, ...fechasViejas } = base.fechas;
    const comoLoGuardoLaVersionVieja = {
      ...sinVisita,
      fechas: fechasViejas,
    } as unknown as TrabajoDelCliente;

    const vista = vistaDelCliente(comoLoGuardoLaVersionVieja, HOY);
    expect(vista.hitos.map((hito) => hito.id)).toEqual(HITOS.map((hito) => hito.id));
    expect(vista.relevamiento).toMatchObject({ estado: 'pendiente', fecha: null });
    expect(vista.eventos).toEqual([]);
  });

  it('tampoco rompe si le falta la cuenta para transferir', () => {
    const { cobro: _cobro, ...viejo } = trabajo({
      pago: {
        instancia: 'sena',
        formas: ['transferencia'],
        monto: centavos(1_000),
        siguiente: null,
      },
    });
    expect(comoPagar(viejo as unknown as TrabajoDelCliente)).toBeNull();
  });
});

function fechas(cambios: Partial<FechasDelTrabajo>): FechasDelTrabajo {
  return { ...trabajo().fechas, ...cambios };
}

interface CasoDeEtapa {
  nombre: string;
  cambios: Partial<TrabajoDelCliente>;
  camino: readonly (readonly [HitoDelTrabajo, EstadoDelHito])[];
  titular: string;
  relevamiento: { estado: 'pendiente' | 'hecho'; fecha: string | null } | null;
  nota: EstadoDelRelevamiento | null;
  sigue: string;
}

const FORMATOS: FormatosDeFecha = {
  larga: (fecha) => `larga(${fecha})`,
  corta: (fecha) => `corta(${fecha})`,
};

const SIN_ESTIMATIVO = (
  actual: HitoDelTrabajo,
): readonly (readonly [HitoDelTrabajo, EstadoDelHito])[] => {
  const indice = HITOS.findIndex((hito) => hito.id === actual);
  return HITOS.map(
    (hito, cual) =>
      [hito.id, cual < indice ? 'pasado' : cual === indice ? 'actual' : 'futuro'] as const,
  );
};

const CON_ESTIMATIVO = (
  actual: HitoDelTrabajo,
): readonly (readonly [HitoDelTrabajo, EstadoDelHito])[] =>
  actual === 'estimativo'
    ? [['estimativo', 'actual'], ...HITOS.map((hito) => [hito.id, 'futuro'] as const)]
    : [['estimativo', 'pasado'], ...SIN_ESTIMATIVO(actual)];

const CASOS_POR_ETAPA: readonly CasoDeEtapa[] = [
  {
    nombre: 'contacto: se prepara el presupuesto y falta ir a medir, sin día todavía',
    cambios: { estado: 'contacto', precio: null },
    camino: SIN_ESTIMATIVO('presupuesto'),
    titular: 'Estamos preparando tu presupuesto',
    relevamiento: { estado: 'pendiente', fecha: null },
    nota: null,
    sigue: SIGUE_FALTA_MEDIR.presupuesto,
  },
  {
    nombre:
      'contacto con la visita agendada: el relevamiento guarda el día, y sin estimativo no hay nota',
    cambios: { estado: 'contacto', precio: null, visita: { dia: '2026-09-25', hecha: false } },
    camino: SIN_ESTIMATIVO('presupuesto'),
    titular: 'Estamos preparando tu presupuesto',
    relevamiento: { estado: 'pendiente', fecha: '2026-09-25' },
    nota: null,
    sigue: SIGUE_FALTA_MEDIR.presupuesto,
  },
  {
    nombre:
      'estimativo enviado antes de medir: es el paso actual y la nota dice que el número puede cambiar',
    cambios: {
      estado: 'presupuesto_estimativo',
      precio: null,
      fechas: fechas({ estimativo: '2026-09-15' }),
    },
    camino: CON_ESTIMATIVO('estimativo'),
    titular: 'Te pasamos un número estimado',
    relevamiento: { estado: 'pendiente', fecha: null },
    nota: 'pendiente',
    sigue: SIGUE_FALTA_MEDIR.estimativo,
  },
  {
    nombre: 'estimativo enviado después de medir: la nota dice de dónde sale el número',
    cambios: {
      estado: 'presupuesto_estimativo',
      precio: null,
      fechas: fechas({ estimativo: '2026-09-15' }),
      visita: { dia: '2026-09-12', hecha: false },
    },
    camino: CON_ESTIMATIVO('estimativo'),
    titular: 'Te pasamos un número estimado',
    relevamiento: { estado: 'hecho', fecha: '2026-09-12' },
    nota: 'hecho',
    sigue: SIGUE.estimativo,
  },
  {
    nombre: 'relevamiento sin día: falta ir a medir y no se inventa una fecha',
    cambios: { estado: 'relevamiento', precio: null },
    camino: SIN_ESTIMATIVO('presupuesto'),
    titular: 'Estamos preparando tu presupuesto',
    relevamiento: { estado: 'pendiente', fecha: null },
    nota: null,
    sigue: SIGUE_FALTA_MEDIR.presupuesto,
  },
  {
    nombre: 'relevamiento con el día acordado',
    cambios: { estado: 'relevamiento', precio: null, visita: { dia: '2026-09-22', hecha: false } },
    camino: SIN_ESTIMATIVO('presupuesto'),
    titular: 'Estamos preparando tu presupuesto',
    relevamiento: { estado: 'pendiente', fecha: '2026-09-22' },
    nota: null,
    sigue: SIGUE_FALTA_MEDIR.presupuesto,
  },
  {
    nombre: 'relevamiento con el día ya pasado y sin marcar: sigue pendiente y no promete ese día',
    cambios: { estado: 'relevamiento', precio: null, visita: { dia: '2026-09-16', hecha: false } },
    camino: SIN_ESTIMATIVO('presupuesto'),
    titular: 'Estamos preparando tu presupuesto',
    relevamiento: { estado: 'pendiente', fecha: null },
    nota: null,
    sigue: SIGUE_FALTA_MEDIR.presupuesto,
  },
  {
    nombre: 'relevamiento tildado en la hoja del contacto: hecho, con su día',
    cambios: { estado: 'relevamiento', precio: null, visita: { dia: '2026-09-16', hecha: true } },
    camino: SIN_ESTIMATIVO('presupuesto'),
    titular: 'Estamos preparando tu presupuesto',
    relevamiento: { estado: 'hecho', fecha: '2026-09-16' },
    nota: 'hecho',
    sigue: SIGUE.presupuesto,
  },
  {
    nombre: 'a presupuestar después de medir, con un estimativo antes',
    cambios: {
      estado: 'a_presupuestar',
      precio: null,
      fechas: fechas({ estimativo: '2026-09-02' }),
      visita: { dia: '2026-09-10', hecha: true },
    },
    camino: CON_ESTIMATIVO('presupuesto'),
    titular: 'Estamos preparando tu presupuesto',
    relevamiento: { estado: 'hecho', fecha: '2026-09-10' },
    nota: 'hecho',
    sigue: SIGUE.presupuesto,
  },
  {
    nombre: 'a presupuestar sin visita: no hizo falta medir y no hay nota',
    cambios: { estado: 'a_presupuestar', precio: null },
    camino: SIN_ESTIMATIVO('presupuesto'),
    titular: 'Estamos preparando tu presupuesto',
    relevamiento: null,
    nota: null,
    sigue: SIGUE.presupuesto,
  },
  {
    nombre: 'presupuesto enviado: lo dice en pasado y lo que sigue es aprobarlo',
    cambios: {
      estado: 'presupuesto_enviado',
      fechas: fechas({ presupuesto: '2026-09-14' }),
      visita: { dia: '2026-09-10', hecha: true },
    },
    camino: SIN_ESTIMATIVO('presupuesto'),
    titular: PRESUPUESTO_MANDADO,
    relevamiento: { estado: 'hecho', fecha: '2026-09-10' },
    nota: 'hecho',
    sigue: SIGUE_CON_EL_PRESUPUESTO_MANDADO,
  },
  {
    nombre: 'presupuesto enviado sin haber ido a medir: tampoco hay nota',
    cambios: { estado: 'presupuesto_enviado', fechas: fechas({ presupuesto: '2026-09-14' }) },
    camino: SIN_ESTIMATIVO('presupuesto'),
    titular: PRESUPUESTO_MANDADO,
    relevamiento: null,
    nota: null,
    sigue: SIGUE_CON_EL_PRESUPUESTO_MANDADO,
  },
  {
    nombre: 'aprobado y sin empezar: la visita de antes cuenta como hecha y la nota ya no está',
    cambios: {
      estado: 'en_curso',
      fechas: fechas({ presupuesto: '2026-09-01', aprobado: '2026-09-05' }),
      visita: { dia: '2026-08-28', hecha: false },
    },
    camino: SIN_ESTIMATIVO('aprobado'),
    titular: 'Recibimos la seña y ya estás en la cola del taller',
    relevamiento: { estado: 'hecho', fecha: '2026-08-28' },
    nota: null,
    sigue: SIGUE.aprobado,
  },
  {
    nombre: 'en fabricación',
    cambios: { estado: 'en_curso', fechas: fechas({ inicio: '2026-09-10' }) },
    camino: SIN_ESTIMATIVO('fabricacion'),
    titular: 'Lo estamos fabricando',
    relevamiento: null,
    nota: null,
    sigue: SIGUE.fabricacion,
  },
  {
    nombre: 'entregado con saldo',
    cambios: {
      estado: 'entregado',
      fechas: fechas({ entregado: '2026-09-16' }),
      pagos: [pago('p1', '2026-08-04', 40_000_000)],
    },
    camino: SIN_ESTIMATIVO('entregado'),
    titular: 'Ya está instalado en tu casa',
    relevamiento: null,
    nota: null,
    sigue: SIGUE.entregado,
  },
  {
    nombre: 'entregado y saldado',
    cambios: { estado: 'entregado', pagos: [pago('p1', '2026-09-16', 124_000_000)] },
    camino: SIN_ESTIMATIVO('pagado'),
    titular: 'Listo, está saldado',
    relevamiento: null,
    nota: null,
    sigue: '',
  },
  {
    nombre: 'cobrado',
    cambios: {
      estado: 'cobrado',
      fechas: fechas({ cobro: '2026-09-17' }),
      pagos: [pago('p1', '2026-09-17', 124_000_000)],
    },
    camino: SIN_ESTIMATIVO('pagado'),
    titular: 'Listo, está saldado',
    relevamiento: null,
    nota: null,
    sigue: '',
  },
];

describe('qué ve el cliente en cada etapa del trabajo', () => {
  for (const caso of CASOS_POR_ETAPA) {
    it(caso.nombre, () => {
      const vista = vistaDelCliente(trabajo(caso.cambios), HOY);

      expect(vista.hitos.map((hito) => [hito.id, hito.estado])).toEqual(caso.camino);
      expect(vista.hitos[vista.hitoIndex]?.texto).toBe(caso.titular);
      if (caso.relevamiento === null) expect(vista.relevamiento).toBeNull();
      else expect(vista.relevamiento).toEqual(caso.relevamiento);
      expect(notaDelRelevamiento(vista, FORMATOS)?.estado ?? null).toBe(caso.nota);
      expect(vista.sigue).toBe(caso.sigue);
      expect(vista.sigue).not.toMatch(/\d/);
    });
  }

  it('un estimativo de antes de que se guardaran los cambios de etapa igual aparece, sin fecha', () => {
    const vista = vistaDelCliente(trabajo({ estado: 'presupuesto_estimativo', precio: null }), HOY);
    expect(vista.hitos[0]).toMatchObject({ id: 'estimativo', estado: 'actual', fecha: null });
    expect(vista.eventos).toEqual([]);
  });

  it('el estimativo nunca lleva un importe: ni en el camino ni en lo que fue pasando', () => {
    const vista = vistaDelCliente(
      trabajo({
        estado: 'presupuesto_estimativo',
        precio: null,
        fechas: fechas({ estimativo: '2026-09-15' }),
      }),
      HOY,
    );
    const delEstimativo = vista.eventos.find((evento) => evento.id === 'estimativo');
    expect(delEstimativo).toMatchObject({ texto: TE_PASAMOS_EL_ESTIMATIVO, monto: null });
    expect(JSON.stringify(vista.hitos)).not.toMatch(/\$|\d{4,}(?!-)/);
  });
});

describe('el relevamiento', () => {
  it('mientras falta ir a medir, sin día acordado, queda pendiente y sin fecha', () => {
    const vista = vistaDelCliente(trabajo({ estado: 'relevamiento', precio: null }), HOY);
    expect(vista.relevamiento).toEqual({ estado: 'pendiente', fecha: null });
  });

  it('hecho sin día cargado queda hecho sin fecha, y no entra en lo que fue pasando', () => {
    const vista = vistaDelCliente(
      trabajo({ estado: 'a_presupuestar', precio: null, visita: { dia: null, hecha: true } }),
      HOY,
    );
    expect(vista.relevamiento).toEqual({ estado: 'hecho', fecha: null });
    expect(vista.eventos.map((evento) => evento.id)).not.toContain('relevamiento');
  });

  it('la visita de hoy, sin marcar, todavía no se da por hecha: dice que quedamos en ir hoy', () => {
    for (const estado of ['contacto', 'presupuesto_estimativo', 'a_presupuestar'] as const) {
      const vista = vistaDelCliente(
        trabajo({ estado, precio: null, visita: { dia: HOY, hecha: false } }),
        HOY,
      );
      expect(vista.relevamiento).toMatchObject({ estado: 'pendiente', fecha: HOY });
    }
  });

  it('marcada con «Ya fui a relevar», se tilda el mismo día', () => {
    const vista = vistaDelCliente(
      trabajo({ estado: 'a_presupuestar', precio: null, visita: { dia: HOY, hecha: true } }),
      HOY,
    );
    expect(vista.relevamiento).toMatchObject({ estado: 'hecho', fecha: HOY });
  });

  it('una visita agendada después de presupuestar vuelve a mostrar el pendiente con su día', () => {
    const vista = vistaDelCliente(
      trabajo({
        estado: 'presupuesto_enviado',
        fechas: fechas({ presupuesto: '2026-09-14' }),
        visita: { dia: '2026-09-24', hecha: false },
      }),
      HOY,
    );
    expect(vista.relevamiento).toMatchObject({ estado: 'pendiente', fecha: '2026-09-24' });
  });
});

describe('la nota del relevamiento', () => {
  const estimativo = fechas({ estimativo: '2026-09-15' });

  function notaDe(cambios: Partial<TrabajoDelCliente>) {
    return notaDelRelevamiento(
      vistaDelCliente(trabajo({ precio: null, ...cambios }), HOY),
      FORMATOS,
    );
  }

  it('con el estimativo y sin medir: el número puede cambiar, y dice el día que quedamos', () => {
    expect(
      notaDe({
        estado: 'presupuesto_estimativo',
        fechas: estimativo,
        visita: { dia: '2026-09-22', hecha: false },
      }),
    ).toEqual({
      estado: 'pendiente',
      ...NOTA_DEL_RELEVAMIENTO.pendiente,
      lineas: [...FALTA_MEDIR_DEL_ESTIMADO, 'Quedamos en ir el larga(2026-09-22).'],
      resumen: RESUMEN_FALTA_MEDIR,
    });
  });

  it('sin día acordado no promete ninguno', () => {
    expect(notaDe({ estado: 'presupuesto_estimativo', fechas: estimativo })?.lineas).toEqual([
      ...FALTA_MEDIR_DEL_ESTIMADO,
      SIN_FECHA_PARA_LA_VISITA,
    ]);
  });

  it('ya medido: dice cuándo fuimos y que con eso se cierra el presupuesto', () => {
    expect(
      notaDe({
        estado: 'a_presupuestar',
        fechas: estimativo,
        visita: { dia: '2026-09-16', hecha: true },
      }),
    ).toEqual({
      estado: 'hecho',
      ...NOTA_DEL_RELEVAMIENTO.hecho,
      lineas: [`${FUIMOS_A_MEDIR} el larga(2026-09-16).`, CERRANDO_EL_PRESUPUESTO],
      resumen: 'Medido el corta(2026-09-16)',
    });
  });

  it('con el presupuesto ya mandado, no dice que lo está cerrando', () => {
    expect(
      notaDe({
        estado: 'presupuesto_enviado',
        precio: centavos(10_000_000),
        fechas: fechas({ presupuesto: '2026-09-17' }),
        visita: { dia: '2026-09-16', hecha: true },
      })?.lineas,
    ).toEqual([`${FUIMOS_A_MEDIR} el larga(2026-09-16).`, ARMAMOS_EL_PRESUPUESTO]);
  });

  it('hecho sin día cargado no inventa uno', () => {
    const nota = notaDe({ estado: 'a_presupuestar', visita: { dia: null, hecha: true } });
    expect(nota?.lineas[0]).toBe('Ya fuimos a medir.');
    expect(nota?.resumen).toBe('Ya fuimos a medir');
  });

  it('sin estimativo no hay número que pueda cambiar: mientras falta medir, no hay nota', () => {
    expect(
      notaDe({ estado: 'relevamiento', visita: { dia: '2026-09-22', hecha: false } }),
    ).toBeNull();
  });

  it('con el presupuesto ya mandado, una visita nueva no vuelve a decir que es un estimado', () => {
    expect(
      notaDe({
        estado: 'presupuesto_enviado',
        fechas: fechas({ estimativo: '2026-09-02', presupuesto: '2026-09-14' }),
        visita: { dia: '2026-09-24', hecha: false },
      }),
    ).toBeNull();
  });

  it('desde que se aprueba, desaparece: ya no condiciona nada', () => {
    expect(
      notaDe({
        estado: 'en_curso',
        fechas: fechas({ estimativo: '2026-09-02', presupuesto: '2026-09-10' }),
        visita: { dia: '2026-09-08', hecha: true },
      }),
    ).toBeNull();
  });

  it('nunca cuenta cuánto hace de algo', () => {
    const nota = notaDe({
      estado: 'presupuesto_estimativo',
      fechas: estimativo,
      visita: { dia: '2026-09-12', hecha: true },
    });
    expect(JSON.stringify(nota)).not.toMatch(HACE_TANTOS_DIAS);
  });
});

describe('lo que fue pasando, con el estimativo y el día que se fue a medir', () => {
  it('los suma a la línea de tiempo, del más nuevo al más viejo', () => {
    const vista = vistaDelCliente(
      trabajo({
        estado: 'presupuesto_enviado',
        fechas: fechas({ estimativo: '2026-09-02', presupuesto: '2026-09-14' }),
        visita: { dia: '2026-09-10', hecha: true },
      }),
      HOY,
    );
    expect(vista.eventos.map((evento) => [evento.texto, evento.fecha, evento.monto])).toEqual([
      ['Te pasamos el presupuesto', '2026-09-14', null],
      [FUIMOS_A_MEDIR, '2026-09-10', null],
      [TE_PASAMOS_EL_ESTIMATIVO, '2026-09-02', null],
    ]);
  });

  it('el mismo día, ir a medir va antes que el presupuesto y después del estimativo', () => {
    const vista = vistaDelCliente(
      trabajo({
        estado: 'presupuesto_enviado',
        fechas: fechas({ estimativo: '2026-09-10', presupuesto: '2026-09-10' }),
        visita: { dia: '2026-09-10', hecha: true },
      }),
      HOY,
    );
    expect(vista.eventos.map((evento) => evento.id)).toEqual([
      'presupuesto',
      'relevamiento',
      'estimativo',
    ]);
  });
});

describe('hasta dónde llegó el trabajo', () => {
  it('compara por el paso, no por la posición: el estimativo no corre a los demás', () => {
    const conEstimativo = vistaDelCliente(
      trabajo({ estado: 'en_curso', fechas: fechas({ estimativo: '2026-08-01' }) }),
      HOY,
    );
    expect(llegoAl(conEstimativo, 'aprobado')).toBe(true);
    expect(llegoAl(conEstimativo, 'fabricacion')).toBe(false);

    const enElEstimativo = vistaDelCliente(
      trabajo({ estado: 'presupuesto_estimativo', precio: null }),
      HOY,
    );
    expect(llegoAl(enElEstimativo, 'estimativo')).toBe(true);
    expect(llegoAl(enElEstimativo, 'presupuesto')).toBe(false);
  });

  it('tuvo estimativo el que está en esa etapa o el que pasó por ella', () => {
    expect(tuvoEstimativo(trabajo({ estado: 'presupuesto_estimativo' }))).toBe(true);
    expect(tuvoEstimativo(trabajo({ fechas: fechas({ estimativo: '2026-08-01' }) }))).toBe(true);
    expect(tuvoEstimativo(trabajo({ estado: 'a_presupuestar' }))).toBe(false);
  });
});
