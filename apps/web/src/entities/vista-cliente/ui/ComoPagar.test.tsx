import {
  centavos,
  PASOS_PARA_TRANSFERIR,
  PEDILE_LOS_DATOS,
  vistaDelCliente,
  type CobroDelTaller,
  type FormaDeCobro,
  type InstanciaDePago,
  type TrabajoDelCliente,
} from '@maun/domain';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EL_PAGO_SE_COORDINA, LOS_PAGOS_LOS_ANOTA_EL_TALLER } from '../model/textos';
import { PAGAR_CON_MERCADO_PAGO } from './ComoPagar';
import { VistaDelCliente } from './VistaDelCliente';

vi.mock('@/shared/api', () => ({
  urlDelArchivo: (ruta: string) => `https://cdn.maun.test/${ruta}`,
}));

const HOY = '2026-09-18';

const CBU = '0110001312345678901233';
const CVU = '0000999109999999999990';

const CON_TODO: CobroDelTaller = {
  alias: 'maun.muebles',
  cbu: CBU,
  titular: 'Ana Gutiérrez',
  cuit: '27-30123456-4',
  link: null,
};

const SIN_NADA: CobroDelTaller = { alias: null, cbu: null, titular: null, cuit: null, link: null };

interface Pago {
  instancia?: InstanciaDePago | null;
  formas?: readonly FormaDeCobro[];
  monto?: number | null;
  siguiente?: { instancia: InstanciaDePago; formas: readonly FormaDeCobro[]; monto: number | null };
}

function trabajo(cambios: Partial<TrabajoDelCliente> = {}, pago: Pago = {}): TrabajoDelCliente {
  return {
    taller: 'Taller MAUN',
    cliente: 'Marcela Duarte',
    trabajo: 'Placard 3 puertas',
    direccion: 'Olazábal 1240',
    estado: 'en_curso',
    precio: centavos(124_000_000),
    sena: centavos(62_000_000),
    fechas: {
      estimativo: null,
      presupuesto: '2026-08-01',
      aprobado: '2026-08-04',
      inicio: '2026-08-24',
      entregaPautada: '2026-10-02',
      listo: null,
      entregado: null,
      cobro: null,
      valeHasta: null,
    },
    visita: { dia: null, hecha: false },
    entrega: { comprometida: null, propuesta: null, respuesta: null },
    pago: {
      instancia: pago.instancia === undefined ? 'sena' : pago.instancia,
      formas: pago.formas ?? ['transferencia', 'efectivo'],
      monto:
        pago.monto === undefined
          ? centavos(22_000_000)
          : pago.monto === null
            ? null
            : centavos(pago.monto),
      siguiente:
        pago.siguiente === undefined
          ? null
          : {
              instancia: pago.siguiente.instancia,
              formas: pago.siguiente.formas,
              monto: pago.siguiente.monto === null ? null : centavos(pago.siguiente.monto),
            },
    },
    cobro: CON_TODO,
    pagos: [{ id: 'p1', fecha: '2026-08-04', concepto: 'Seña', monto: centavos(40_000_000) }],
    archivos: [],
    ...cambios,
  };
}

function dibujar(datos: TrabajoDelCliente) {
  return render(<VistaDelCliente vista={vistaDelCliente(datos, HOY)} hoy={HOY} />);
}

function elBloque() {
  return screen.queryByRole('region', { name: 'Cómo pagar' });
}

function elBloqueSeguro() {
  const bloque = elBloque();
  if (bloque === null) throw new Error('falta el bloque de cómo pagar');
  return bloque;
}

beforeEach(() => {
  Object.assign(navigator, {
    clipboard: { writeText: () => Promise.resolve() },
  });
});

describe('el bloque de cómo pagar, por transferencia', () => {
  it('muestra los cuatro datos, con el CBU agrupado para leerlo', () => {
    dibujar(trabajo({}, { formas: ['transferencia'] }));

    const bloque = elBloqueSeguro();
    expect(bloque).toHaveTextContent('maun.muebles');
    expect(bloque).toHaveTextContent('0110 0013 1234 5678 9012 33');
    expect(bloque).toHaveTextContent('Ana Gutiérrez');
    expect(bloque).toHaveTextContent('27-30123456-4');
  });

  it('el CVU se llama CVU: empieza con 000', () => {
    dibujar(trabajo({ cobro: { ...CON_TODO, cbu: CVU } }, { formas: ['transferencia'] }));

    expect(within(elBloqueSeguro()).getByText('CVU')).toBeInTheDocument();
  });

  it('el importe que toca está a la vista y se copia sin signo pesos ni puntos de miles', () => {
    dibujar(trabajo({}, { formas: ['transferencia'], monto: 150_000_000 }));

    const bloque = elBloqueSeguro();
    expect(bloque).toHaveTextContent('Ahora, la seña');
    expect(bloque).toHaveTextContent('$ 1.500.000');

    const copiar = vi.spyOn(navigator.clipboard, 'writeText');
    fireEvent.click(within(bloque).getByRole('button', { name: 'Copiar el monto' }));
    expect(copiar).toHaveBeenCalledWith('1500000');
  });

  it('con el saldo pendiente, el importe se llama saldo', () => {
    dibujar(trabajo({}, { instancia: 'saldo', formas: ['transferencia'], monto: 44_000_000 }));

    expect(elBloqueSeguro()).toHaveTextContent('Ahora, el saldo');
  });

  it('trae la línea de pasos, para el que llega por el QR sin nadie que le explique', () => {
    dibujar(trabajo({}, { formas: ['transferencia'] }));

    expect(elBloqueSeguro()).toHaveTextContent(PASOS_PARA_TRANSFERIR);
  });

  it('el CBU se copia pelado, que es lo que el cliente pega en su banco', () => {
    dibujar(trabajo({}, { formas: ['transferencia'] }));

    const copiar = vi.spyOn(navigator.clipboard, 'writeText');
    fireEvent.click(within(elBloqueSeguro()).getByRole('button', { name: 'Copiar el CBU' }));

    expect(copiar).toHaveBeenCalledWith(CBU);
  });

  it('lo que el dueño no cargó no aparece', () => {
    dibujar(
      trabajo(
        { cobro: { alias: 'maun.muebles', cbu: null, titular: null, cuit: null, link: null } },
        { formas: ['transferencia'] },
      ),
    );

    const bloque = elBloqueSeguro();
    expect(within(bloque).queryByRole('button', { name: 'Copiar el CBU' })).toBeNull();
    expect(within(bloque).queryByRole('button', { name: 'Copiar el titular' })).toBeNull();
  });
});

describe('el bloque de cómo pagar, en efectivo', () => {
  it('dice que ese pago es en efectivo y no muestra ningún dato de la cuenta', () => {
    dibujar(trabajo({ cobro: SIN_NADA }, { instancia: 'saldo', formas: ['efectivo'] }));

    const bloque = elBloqueSeguro();
    expect(bloque).toHaveTextContent('El saldo es en efectivo, en mano.');
    for (const dato of [
      'Copiar el alias',
      'Copiar el CBU',
      'Copiar el titular',
      'Copiar el CUIT',
    ]) {
      expect(within(bloque).queryByRole('button', { name: dato })).toBeNull();
    }
  });

  it('el importe se ve igual, aunque el pago sea en efectivo: es lo que tiene que juntar', () => {
    dibujar(
      trabajo({ cobro: SIN_NADA }, { instancia: 'saldo', formas: ['efectivo'], monto: 44_000_000 }),
    );

    const bloque = elBloqueSeguro();
    expect(bloque).toHaveTextContent('Ahora, el saldo');
    expect(bloque).toHaveTextContent('$ 440.000');
  });

  it('con las dos formas, el efectivo queda como la segunda opción', () => {
    dibujar(trabajo({}, { formas: ['transferencia', 'efectivo'] }));

    const bloque = elBloqueSeguro();
    expect(within(bloque).getByRole('button', { name: 'Copiar el alias' })).toBeInTheDocument();
    expect(bloque).toHaveTextContent('La seña también la podés dejar en efectivo');
  });

  it('con solo transferencia no menciona el efectivo', () => {
    dibujar(trabajo({}, { formas: ['transferencia'] }));

    expect(elBloqueSeguro()).not.toHaveTextContent('efectivo');
  });
});

describe('el pago que viene después', () => {
  it('lo anticipa con su importe y con cómo se paga, más chico que el de ahora', () => {
    dibujar(
      trabajo(
        {},
        {
          instancia: 'sena',
          formas: ['transferencia'],
          monto: 50_000_000,
          siguiente: { instancia: 'saldo', formas: ['efectivo'], monto: 80_000_000 },
        },
      ),
    );

    expect(elBloqueSeguro()).toHaveTextContent('Después, el saldo: $ 800.000, en efectivo.');
  });

  it('el de ahora es el que se copia: el que viene después no tiene botón', () => {
    dibujar(
      trabajo(
        {},
        {
          instancia: 'sena',
          formas: ['transferencia'],
          monto: 50_000_000,
          siguiente: { instancia: 'saldo', formas: ['efectivo'], monto: 80_000_000 },
        },
      ),
    );

    expect(
      within(elBloqueSeguro()).getAllByRole('button', { name: 'Copiar el monto' }),
    ).toHaveLength(1);
  });

  it('sin importe todavía, lo nombra igual y dice cómo se va a pagar', () => {
    dibujar(
      trabajo(
        { precio: null, pagos: [] },
        {
          instancia: 'sena',
          formas: ['efectivo'],
          monto: null,
          siguiente: { instancia: 'saldo', formas: ['transferencia', 'efectivo'], monto: null },
        },
      ),
    );

    expect(elBloqueSeguro()).toHaveTextContent(
      'Después, el saldo, por transferencia o en efectivo.',
    );
  });

  it('cuando no viene ninguno más, no anticipa nada', () => {
    dibujar(trabajo({}, { instancia: 'saldo', formas: ['efectivo'], monto: 44_000_000 }));

    expect(elBloqueSeguro()).not.toHaveTextContent('Después');
  });

  it('el total que le falta sigue a la vista y no se confunde con el pago de ahora', () => {
    dibujar(
      trabajo(
        {},
        {
          instancia: 'sena',
          formas: ['transferencia'],
          monto: 50_000_000,
          siguiente: { instancia: 'saldo', formas: ['efectivo'], monto: 34_000_000 },
        },
      ),
    );

    // El trabajo vale $1.240.000 y pagó $400.000: le faltan $840.000 en total, de los que $500.000
    // son la seña de ahora. Los dos números están, con etiquetas distintas.
    const entrada = screen.getByRole('region', { name: 'Tu mueble' });
    expect(entrada).toHaveTextContent('Te falta pagar');
    expect(entrada).toHaveTextContent('$ 840.000');
    expect(elBloqueSeguro()).toHaveTextContent('Ahora, la seña');
    expect(elBloqueSeguro()).toHaveTextContent('$ 500.000');
  });
});

describe('los bordes del bloque', () => {
  it('sin nada que pagar no hay bloque', () => {
    dibujar(trabajo({}, { instancia: null, formas: [], monto: null }));

    expect(elBloque()).toBeNull();
  });

  it('si pide transferencia y el taller no cargó la cuenta, lo dice en vez de quedar vacío', () => {
    dibujar(trabajo({ cobro: SIN_NADA }, { formas: ['transferencia'] }));

    expect(elBloqueSeguro()).toHaveTextContent(PEDILE_LOS_DATOS);
  });

  it('sin presupuesto todavía, el bloque está pero sin importe', () => {
    dibujar(trabajo({ precio: null, pagos: [] }, { formas: ['transferencia'], monto: null }));

    const bloque = elBloqueSeguro();
    expect(within(bloque).queryByRole('button', { name: 'Copiar el monto' })).toBeNull();
    expect(within(bloque).getByRole('button', { name: 'Copiar el alias' })).toBeInTheDocument();
  });

  it('con algo que pagar, el pie no manda a coordinar nada: ya está dicho arriba', () => {
    dibujar(trabajo({}, { formas: ['efectivo'] }));

    const pagos = screen.getByRole('region', { name: 'Lo que pagaste' });
    expect(pagos).toHaveTextContent(LOS_PAGOS_LOS_ANOTA_EL_TALLER);
    expect(pagos).not.toHaveTextContent(EL_PAGO_SE_COORDINA);
  });

  it('sin ninguna forma concreta, el pie manda a hablar con el taller, sin decir «arreglar»', () => {
    dibujar(trabajo({ cobro: SIN_NADA }, { formas: ['transferencia'] }));

    const pagos = screen.getByRole('region', { name: 'Lo que pagaste' });
    expect(pagos).toHaveTextContent(EL_PAGO_SE_COORDINA);
    expect(pagos).not.toHaveTextContent(/arregl/i);
  });

  it('en ningún estado la página le dice al cliente que «arregle» nada', () => {
    for (const formas of [
      ['transferencia'],
      ['efectivo'],
      ['transferencia', 'efectivo'],
    ] as const) {
      const { unmount, container } = dibujar(trabajo({}, { formas }));
      expect(container.textContent).not.toMatch(/arregl/i);
      unmount();
    }
  });
});

describe('con el link de Mercado Pago cargado', () => {
  const LINK = 'https://mpago.la/2vXyZ1';
  const CON_LINK: CobroDelTaller = { ...CON_TODO, link: LINK };

  it('el alias va primero y el botón después: la transferencia no cuesta comisión', () => {
    dibujar(trabajo({ cobro: CON_LINK }, { formas: ['transferencia'], monto: 45_000_000 }));

    const bloque = elBloqueSeguro();
    expect(bloque).toHaveTextContent('maun.muebles');
    expect(bloque).toHaveTextContent('0110 0013 1234 5678 9012 33');

    const texto = bloque.textContent;
    expect(texto.indexOf('maun.muebles')).toBeLessThan(texto.indexOf(PAGAR_CON_MERCADO_PAGO));
  });

  it('el botón lleva al link y se abre afuera, sin filtrar la página', () => {
    dibujar(trabajo({ cobro: CON_LINK }, { formas: ['transferencia'] }));

    const boton = within(elBloqueSeguro()).getByRole('link', { name: PAGAR_CON_MERCADO_PAGO });
    expect(boton).toHaveAttribute('href', LINK);
    expect(boton).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('no hay ningún código QR en la página del cliente', () => {
    dibujar(trabajo({ cobro: CON_LINK }, { formas: ['transferencia'] }));

    expect(screen.queryByRole('img', { name: /Código QR/ })).toBeNull();
    expect(document.querySelector('svg[role="img"]')).toBeNull();
  });

  it('los pasos son siempre los de copiar el alias', () => {
    dibujar(trabajo({ cobro: CON_LINK }, { formas: ['transferencia'] }));
    expect(elBloqueSeguro()).toHaveTextContent(PASOS_PARA_TRANSFERIR);
  });

  it('si ese pago es en efectivo no hay botón ni link en la página', () => {
    dibujar(trabajo({ cobro: CON_LINK }, { formas: ['efectivo'] }));

    expect(
      within(elBloqueSeguro()).queryByRole('link', { name: PAGAR_CON_MERCADO_PAGO }),
    ).toBeNull();
    expect(document.body.innerHTML).not.toContain(LINK);
  });
});

describe('el logo de Mercado Pago', () => {
  const CVU_DE_MERCADO_PAGO = '0000003100012345678907';
  const CBU_DE_BANCO = '0110001312345678901233';
  const LINK_DE_COBRO = 'https://mpago.la/2vXyZ1';

  function conCuenta(
    cbu: string | null,
    link: string | null = null,
    formas: FormaDeCobro[] = ['transferencia'],
  ) {
    return trabajo({ cobro: { ...CON_TODO, cbu, link } }, { formas, monto: 45_000_000 });
  }

  function logos() {
    return elBloqueSeguro().querySelectorAll('[data-logo="mercado-pago"]');
  }

  it('va con transferencia sin link, y el lector de pantalla lo nombra', () => {
    dibujar(conCuenta(CBU_DE_BANCO));
    expect(logos()).toHaveLength(1);
    expect(within(elBloqueSeguro()).getByAltText('Mercado Pago')).toBeInTheDocument();
  });

  it('no depende de la entidad de la cuenta: también con un CVU de Mercado Pago', () => {
    dibujar(conCuenta(CVU_DE_MERCADO_PAGO));
    expect(logos()).toHaveLength(1);
  });

  it('con link va uno solo, y como el recuadro ya dice «Mercado Pago» la imagen es decorativa', () => {
    dibujar(conCuenta(CBU_DE_BANCO, LINK_DE_COBRO));
    expect(logos()).toHaveLength(1);
    expect(within(elBloqueSeguro()).queryByAltText('Mercado Pago')).toBeNull();
    expect(logos()[0]?.querySelector('img')).toHaveAttribute('alt', '');
    expect(
      within(elBloqueSeguro()).getByRole('link', { name: PAGAR_CON_MERCADO_PAGO }),
    ).toBeInTheDocument();
  });

  it('con transferencia y efectivo a elegir, también va', () => {
    dibujar(conCuenta(CBU_DE_BANCO, null, ['transferencia', 'efectivo']));
    expect(logos()).toHaveLength(1);
  });

  it('en efectivo no va, aunque la cuenta sea de Mercado Pago', () => {
    dibujar(conCuenta(CVU_DE_MERCADO_PAGO, LINK_DE_COBRO, ['efectivo']));
    expect(logos()).toHaveLength(0);
  });

  it('por transferencia sin ningún dato cargado no hay datos para transferir, y no hay logo suelto', () => {
    dibujar(trabajo({ cobro: SIN_NADA }, { formas: ['transferencia'] }));
    expect(within(elBloqueSeguro()).queryByText('Alias')).toBeNull();
    expect(logos()).toHaveLength(0);
  });

  it('no es un enlace ni un botón, y no suma ningún texto', () => {
    dibujar(conCuenta(CBU_DE_BANCO));
    const logo = logos()[0];
    expect(logo?.closest('a, button')).toBeNull();
    expect(logo?.textContent).toBe('');
  });

  it('va sobre un fondo claro fijo, el mismo en los dos temas, sin filtro que lo invierta', () => {
    dibujar(conCuenta(CBU_DE_BANCO));
    const logo = logos()[0];
    expect(logo).toHaveClass('bg-paper-fijo');
    expect(logo?.innerHTML).not.toMatch(/invert|filter|dark:/);
  });
});
