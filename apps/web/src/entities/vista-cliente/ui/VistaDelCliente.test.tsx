import { centavos, vistaDelCliente, type TrabajoDelCliente } from '@maun/domain';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SIN_PAGOS_APROBADO } from '../model/textos';
import { VistaDelCliente } from './VistaDelCliente';

vi.mock('@/shared/api', () => ({
  urlDelArchivo: (ruta: string) => `https://cdn.maun.test/${ruta}`,
}));

const HOY = '2026-09-18';

const HACE_TANTOS_DIAS = /[Hh]ace \d/;

function fechas(cambios: Partial<TrabajoDelCliente['fechas']>): TrabajoDelCliente['fechas'] {
  return {
    estimativo: null,
    presupuesto: null,
    aprobado: null,
    inicio: null,
    entregaPautada: null,
    entregado: null,
    cobro: null,
    valeHasta: null,
    ...cambios,
  };
}

function trabajo(cambios: Partial<TrabajoDelCliente> = {}): TrabajoDelCliente {
  return {
    taller: 'Taller MAUN',
    cliente: 'Marcela Duarte',
    trabajo: 'Placard 3 puertas',
    direccion: 'Olazábal 1240, Ituzaingó',
    estado: 'en_curso',
    precio: centavos(124_000_000),
    sena: centavos(62_000_000),
    fechas: fechas({
      presupuesto: '2026-08-01',
      aprobado: '2026-08-04',
      inicio: '2026-08-24',
      entregaPautada: '2026-10-02',
    }),
    visita: { dia: null, hecha: false },
    pago: {
      instancia: 'saldo',
      formas: ['efectivo'],
      monto: centavos(44_000_000),
      siguiente: null,
    },
    cobro: { alias: null, cbu: null, titular: null, cuit: null, link: null },
    pagos: [
      { id: 'p1', fecha: '2026-08-04', concepto: 'Seña', monto: centavos(40_000_000) },
      { id: 'p2', fecha: '2026-09-16', concepto: 'Adelanto', monto: centavos(40_000_000) },
    ],
    archivos: [],
    ...cambios,
  };
}

function dibujar(datos: TrabajoDelCliente) {
  return render(<VistaDelCliente vista={vistaDelCliente(datos, HOY)} hoy={HOY} />);
}

describe('la vista del cliente', () => {
  it('muestra el trabajo, el cliente y los tres importes', () => {
    dibujar(trabajo());

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Placard 3 puertas');
    expect(screen.getByText('Marcela Duarte')).toBeInTheDocument();
    const entrada = screen.getByRole('region', { name: 'Tu mueble' });
    expect(entrada).toHaveTextContent('$ 1.240.000');
    expect(entrada).toHaveTextContent('$ 800.000');
    expect(entrada).toHaveTextContent('$ 440.000');
  });

  it('antes de la entrega la cifra grande es la etapa, y el saldo queda en la fila de abajo', () => {
    dibujar(trabajo());

    const entrada = screen.getByRole('region', { name: 'Tu mueble' });
    expect(within(entrada).getByText('Lo estamos fabricando')).toBeInTheDocument();
    expect(within(entrada).getByText('Te falta pagar')).toBeInTheDocument();
  });

  it('desde la entrega, con saldo, la cifra grande pasa a ser lo que falta pagar', () => {
    dibujar(
      trabajo({
        estado: 'entregado',
        fechas: fechas({
          presupuesto: '2026-08-01',
          aprobado: '2026-08-04',
          inicio: '2026-08-24',
          entregaPautada: '2026-09-16',
          entregado: '2026-09-16',
        }),
      }),
    );

    const entrada = screen.getByRole('region', { name: 'Tu mueble' });
    const etiquetas = within(entrada).getAllByText(/Te falta pagar|Ya está instalado en tu casa/);
    expect(etiquetas.length).toBeGreaterThan(0);
    expect(entrada).toHaveTextContent('Te falta pagar');
    expect(entrada).toHaveTextContent('Ya está instalado en tu casa');
    expect(entrada).toHaveTextContent('Entregado el mié 16 sep');
  });

  it('el camino tiene los cinco hitos y los que faltan no muestran fecha', () => {
    dibujar(trabajo());

    const camino = screen.getByRole('region', { name: 'En qué anda' });
    expect(within(camino).getByText('Presupuesto enviado')).toBeInTheDocument();
    expect(within(camino).getByText('Lo estamos fabricando')).toBeInTheDocument();
    expect(within(camino).getByText('Lo llevamos y lo instalamos')).toBeInTheDocument();
    expect(within(camino).getByText('Cuando esté saldado')).toBeInTheDocument();
    expect(
      within(camino).getByText('Lo próximo que vas a ver acá es la entrega.'),
    ).toBeInTheDocument();
  });

  it('entregado y pagado, el camino queda completo: los cinco pasos tildados y ninguno en curso', () => {
    dibujar(
      trabajo({
        estado: 'cobrado',
        fechas: fechas({
          presupuesto: '2026-08-01',
          aprobado: '2026-08-04',
          inicio: '2026-08-24',
          entregaPautada: '2026-09-16',
          entregado: '2026-09-16',
          cobro: '2026-09-17',
        }),
        pagos: [
          { id: 'p1', fecha: '2026-08-04', concepto: 'Seña', monto: centavos(40_000_000) },
          { id: 'p2', fecha: '2026-09-17', concepto: 'Saldo final', monto: centavos(84_000_000) },
        ],
      }),
    );

    const camino = screen.getByRole('region', { name: 'En qué anda' });
    const pasos = within(camino).getAllByRole('listitem');
    expect(pasos).toHaveLength(5);
    expect(pasos.filter((paso) => paso.querySelector('svg.lucide-check') !== null)).toHaveLength(5);
    expect(pasos[4]).toHaveTextContent('Listo, está saldado');
    expect(pasos[4]).toHaveTextContent('jue 17 sep');
  });

  it('cuando hace días que no pasa nada, no se lo cuenta: dice qué sigue', () => {
    const dibujada = dibujar(
      trabajo({
        pagos: [],
        fechas: fechas({
          presupuesto: '2026-08-01',
          inicio: '2026-09-01',
          entregaPautada: '2026-10-02',
        }),
      }),
    );

    expect(screen.getByText('Lo próximo que vas a ver acá es la entrega.')).toBeInTheDocument();
    expect(dibujada.container).not.toHaveTextContent(HACE_TANTOS_DIAS);
  });

  it('lista los pagos con su concepto y su día', () => {
    dibujar(trabajo());

    const pagos = screen.getByRole('region', { name: 'Lo que pagaste' });
    expect(within(pagos).getByText('Seña')).toBeInTheDocument();
    expect(within(pagos).getByText('Adelanto')).toBeInTheDocument();
    expect(pagos).toHaveTextContent('$ 400.000');
  });

  it('aprobado y sin pagos, dice que lo primero es la seña', () => {
    dibujar(trabajo({ pagos: [] }));

    expect(screen.getByText(SIN_PAGOS_APROBADO)).toBeInTheDocument();
  });

  it('antes de aprobar no dice nada de pagos: no tenerlos es lo normal', () => {
    dibujar(trabajo({ estado: 'presupuesto_enviado', pagos: [] }));

    const pagos = screen.getByRole('region', { name: 'Lo que pagaste' });
    expect(pagos).not.toHaveTextContent(SIN_PAGOS_APROBADO);
    expect(pagos).not.toHaveTextContent(/registramos/);
  });

  it('muestra los archivos que llegaron, con su enlace al bucket', () => {
    dibujar(
      trabajo({
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
          {
            id: 'a2',
            nombre: 'Presupuesto 2026-041.pdf',
            tipo: 'application/pdf',
            ancho: null,
            alto: null,
            fecha: '2026-08-01T12:00:00+00:00',
            ruta: 'h/p/a2.pdf',
            rutaMini: 'h/p/a2.pdf',
          },
        ],
      }),
    );

    const galeria = screen.getByRole('region', { name: 'Fotos y planos' });
    expect(galeria).toHaveTextContent('2 archivos');
    expect(within(galeria).getByRole('img', { name: 'Plano de frente' })).toHaveAttribute(
      'src',
      'https://cdn.maun.test/h/p/a1.mini.webp',
    );
    expect(within(galeria).getByRole('link', { name: /Presupuesto 2026-041.pdf/ })).toHaveAttribute(
      'href',
      'https://cdn.maun.test/h/p/a2.pdf',
    );
  });

  it('sin archivos dice qué va a aparecer ahí, sin disculparse', () => {
    dibujar(trabajo());

    expect(screen.getByText('Todavía no hay fotos')).toBeInTheDocument();
  });

  it('un trabajo aprobado sin presupuesto no inventa un saldo', () => {
    dibujar(trabajo({ precio: null, sena: null, pagos: [] }));

    const entrada = screen.getByRole('region', { name: 'Tu mueble' });
    expect(entrada).toHaveTextContent('Falta el presupuesto');
    expect(entrada).toHaveTextContent('—');
  });
});

describe('la tarjeta de datos, desde la aprobación', () => {
  it('trae la dirección, el inicio, la entrega pautada y la seña acordada', () => {
    dibujar(trabajo());

    const tarjeta = screen.getByRole('region', { name: 'Datos del trabajo' });
    expect(tarjeta).toHaveTextContent('DirecciónOlazábal 1240, Ituzaingó');
    expect(tarjeta).toHaveTextContent('Empezamoslun 24 ago');
    expect(tarjeta).toHaveTextContent('Entrega pautadavie 2 oct');
    expect(tarjeta).toHaveTextContent('Seña$ 620.000 · pagada');
  });

  it('la seña de la tarjeta es la del porcentaje, no el primer pago', () => {
    dibujar(
      trabajo({
        pagos: [
          { id: 'r', fecha: '2026-08-01', concepto: 'Relevamiento', monto: centavos(12_000_000) },
          { id: 's', fecha: '2026-08-04', concepto: 'Seña', monto: centavos(50_000_000) },
        ],
      }),
    );

    const tarjeta = screen.getByRole('region', { name: 'Datos del trabajo' });
    expect(tarjeta).toHaveTextContent('Seña$ 620.000 · pagada');
    expect(tarjeta).not.toHaveTextContent('$ 120.000');
  });

  it('aprobado sin la seña completa, la tarjeta dice cuánto falta de ella', () => {
    dibujar(
      trabajo({
        pagos: [],
        pago: {
          instancia: 'sena',
          formas: ['efectivo'],
          monto: centavos(62_000_000),
          siguiente: null,
        },
      }),
    );

    expect(screen.getByRole('region', { name: 'Datos del trabajo' })).toHaveTextContent(
      'Seña$ 620.000 · te faltan $ 620.000',
    );
  });

  it('sin dirección ni fechas cargadas, cada dato dice que falta confirmarlo', () => {
    dibujar(trabajo({ direccion: '', fechas: fechas({}), sena: null }));

    const tarjeta = screen.getByRole('region', { name: 'Datos del trabajo' });
    expect(tarjeta).toHaveTextContent('DirecciónA confirmar');
    expect(tarjeta).toHaveTextContent('EmpezamosTodavía no');
    expect(tarjeta).toHaveTextContent('Entrega pautadaA confirmar');
    expect(tarjeta).toHaveTextContent('SeñaA confirmar');
  });

  it('no hay proyección: desde la aprobación la entrega ya está pautada', () => {
    dibujar(trabajo());

    expect(screen.queryByRole('region', { name: 'Para cuándo' })).not.toBeInTheDocument();
  });
});

describe('un trabajo con el presupuesto mandado y sin aprobar, con todo cargado', () => {
  function sinAprobar(cambios: Partial<TrabajoDelCliente> = {}): TrabajoDelCliente {
    return trabajo({
      trabajo: 'Escritorio',
      cliente: 'Lucía Ferreyra',
      estado: 'presupuesto_enviado',
      precio: centavos(124_800_000),
      sena: centavos(62_400_000),
      direccion: 'Belgrano 455, Haedo',
      fechas: fechas({ inicio: '2026-08-13', entregaPautada: '2026-10-10' }),
      pago: {
        instancia: 'sena',
        formas: ['efectivo'],
        monto: centavos(50_400_000),
        siguiente: { instancia: 'saldo', formas: ['efectivo'], monto: centavos(62_400_000) },
      },
      pagos: [
        {
          id: 'relevamiento',
          fecha: '2026-08-13',
          concepto: 'Relevamiento Tecnico',
          monto: centavos(12_000_000),
        },
      ],
      ...cambios,
    });
  }

  it('no promete una entrega, no dice que empezó y no muestra la tarjeta de datos', () => {
    const dibujada = dibujar(sinAprobar());

    expect(dibujada.container).not.toHaveTextContent('Entrega pautada');
    expect(dibujada.container).not.toHaveTextContent('Empezamos');
    expect(dibujada.container).not.toHaveTextContent('Belgrano 455');
    expect(screen.queryByRole('region', { name: 'Datos del trabajo' })).not.toBeInTheDocument();
  });

  it('en lo que fue pasando, el pago es un pago: ni la seña, ni la aprobación, ni la fabricación', () => {
    dibujar(sinAprobar());

    const historia = screen.getByRole('region', { name: 'Lo que fue pasando' });
    expect(historia).not.toHaveTextContent('Recibimos tu seña y quedó aprobado');
    expect(historia).not.toHaveTextContent('Empezamos a fabricarlo en el taller');
    expect(within(historia).getByText('Recibimos tu pago')).toBeInTheDocument();
    expect(historia).toHaveTextContent('$ 120.000');
    expect(within(historia).getAllByRole('listitem')).toHaveLength(1);
  });

  it('no le cobra una deuda: «Te falta pagar» no aparece', () => {
    const dibujada = dibujar(sinAprobar());

    expect(dibujada.container).not.toHaveTextContent('Te falta pagar');
  });

  it('lo que marcó en verde queda igual: lo próximo, y el relevamiento con su nombre en lo que pagaste', () => {
    dibujar(sinAprobar());

    expect(screen.getByText('Lo próximo es que lo apruebes y dejes la seña.')).toBeInTheDocument();
    const pagos = screen.getByRole('region', { name: 'Lo que pagaste' });
    expect(within(pagos).getByText('Relevamiento Tecnico')).toBeInTheDocument();
    expect(pagos).toHaveTextContent('$ 120.000');
  });

  it('arriba van el presupuesto, la seña para arrancar, lo que pagó y cuánto le queda', () => {
    dibujar(sinAprobar());

    const entrada = screen.getByRole('region', { name: 'Tu mueble' });
    expect(entrada).toHaveTextContent('Te pasamos el presupuesto');
    expect(entrada).toHaveTextContent('Presupuesto$ 1.248.000');
    expect(entrada).toHaveTextContent('Seña para arrancar$ 624.000');
    expect(entrada).toHaveTextContent('Pagaste$ 120.000');
    expect(entrada).toHaveTextContent(
      'Lo que pagaste queda a cuenta de la seña: te quedan $ 504.000 para completarla.',
    );
  });

  it('lo que le queda de la seña es el mismo número que le pide «Cómo pagar»', () => {
    dibujar(sinAprobar());

    const entrada = screen.getByRole('region', { name: 'Tu mueble' });
    const como = screen.getByRole('region', { name: 'Cómo pagar' });
    expect(entrada).toHaveTextContent('te quedan $ 504.000');
    expect(como).toHaveTextContent('Ahora, la seña');
    expect(como).toHaveTextContent('$ 504.000');
  });

  it('lo que pagó se cierra como a cuenta de la seña, no como una deuda', () => {
    dibujar(sinAprobar());

    const pagos = screen.getByRole('region', { name: 'Lo que pagaste' });
    expect(pagos).toHaveTextContent('A cuenta de la seña$ 120.000');
  });

  it('con la fecha límite cargada, en lugar de la tarjeta va la proyección', () => {
    dibujar(sinAprobar({ fechas: fechas({ valeHasta: '2026-10-02' }) }));

    const cuando = screen.getByRole('region', { name: 'Para cuándo' });
    expect(cuando).toHaveTextContent(
      'Si dejás la seña antes del vie 2 de octubre, podríamos tenerlo listo para el lun 2 de noviembre.',
    );
    expect(cuando).toHaveTextContent('Vamos tomando los trabajos a medida que entran las señas.');
  });

  it('sin fecha límite, no hay promesa: una línea y ninguna fecha', () => {
    dibujar(sinAprobar());

    const cuando = screen.getByRole('region', { name: 'Para cuándo' });
    expect(cuando).toHaveTextContent(
      'Cuando lo apruebes y dejes la seña, coordinamos la fecha de entrega.',
    );
    expect(cuando.textContent).not.toMatch(/\d/);
  });

  it('con la fecha límite ya pasada, dice que venció y no promete nada', () => {
    dibujar(sinAprobar({ fechas: fechas({ valeHasta: '2026-09-17' }) }));

    const cuando = screen.getByRole('region', { name: 'Para cuándo' });
    expect(cuando).toHaveTextContent(
      'Este presupuesto venció el jue 17 de septiembre. Hablá con el taller para actualizarlo.',
    );
    expect(cuando).not.toHaveTextContent('podríamos');
  });

  it('si lo que pagó ya cubre la seña, lo dice y no le pide nada', () => {
    dibujar(
      sinAprobar({
        pagos: [
          { id: 'grande', fecha: '2026-08-13', concepto: 'Adelanto', monto: centavos(70_000_000) },
        ],
        pago: { instancia: null, formas: [], monto: null, siguiente: null },
      }),
    );

    expect(screen.getByRole('region', { name: 'Tu mueble' })).toHaveTextContent(
      'Con lo que pagaste ya está cubierta la seña.',
    );
    expect(screen.queryByRole('region', { name: 'Cómo pagar' })).not.toBeInTheDocument();
  });
});

describe('antes de mandar el presupuesto', () => {
  it('con un pago, dice lo que pagó y que queda a cuenta de la seña; sin tarjeta ni proyección', () => {
    dibujar(
      trabajo({
        estado: 'a_presupuestar',
        precio: null,
        sena: null,
        direccion: 'Olazábal 1240',
        fechas: fechas({ inicio: '2026-08-13', entregaPautada: '2026-10-10' }),
        pago: { instancia: 'sena', formas: ['efectivo'], monto: null, siguiente: null },
        pagos: [
          { id: 'visita', fecha: '2026-08-13', concepto: 'Visita', monto: centavos(12_000_000) },
        ],
      }),
    );

    const entrada = screen.getByRole('region', { name: 'Tu mueble' });
    expect(entrada).toHaveTextContent('Estamos preparando tu presupuesto');
    expect(entrada).toHaveTextContent('Pagaste$ 120.000');
    expect(entrada).toHaveTextContent('Lo que pagaste queda a cuenta de la seña.');
    expect(entrada).not.toHaveTextContent('Te falta pagar');
    expect(screen.queryByRole('region', { name: 'Datos del trabajo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Para cuándo' })).not.toBeInTheDocument();
  });

  it('sin pagos, no muestra ningún importe', () => {
    const dibujada = dibujar(
      trabajo({
        estado: 'contacto',
        precio: null,
        sena: null,
        pagos: [],
        pago: { instancia: 'sena', formas: ['efectivo'], monto: null, siguiente: null },
      }),
    );

    expect(dibujada.container.textContent).not.toMatch(/\$/);
  });
});

function pasosDelCamino(): string[] {
  const camino = screen.getByRole('region', { name: 'En qué anda' });
  return within(camino)
    .getAllByRole('listitem')
    .map((paso) => paso.textContent);
}

function conPantalla(ancho: 'celular' | 'escritorio'): void {
  vi.stubGlobal('matchMedia', () => ({
    matches: ancho === 'escritorio',
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

const PUEDE_CAMBIAR = 'Por qué el número todavía puede cambiar';
const DE_DONDE_SALE = 'De dónde sale este número';
const LA_NOTA = /Por qué el número|De dónde sale/;

describe('el estimativo y el relevamiento en el camino', () => {
  beforeEach(() => {
    conPantalla('celular');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('con el estimativo mandado, es el paso actual y va antes de los otros cinco', () => {
    dibujar(
      trabajo({
        estado: 'presupuesto_estimativo',
        precio: null,
        sena: null,
        pagos: [],
        fechas: fechas({ estimativo: '2026-09-15' }),
      }),
    );

    const entrada = screen.getByRole('region', { name: 'Tu mueble' });
    expect(within(entrada).getByText('Te pasamos un número estimado')).toBeInTheDocument();
    expect(entrada).not.toHaveTextContent('Te falta pagar');
    const pasos = pasosDelCamino();
    expect(pasos).toHaveLength(6);
    expect(pasos[0]).toContain('Te pasamos un número estimado');
    expect(pasos[0]).toContain('mar 15 sep');
    expect(pasos[1]).toContain('Te vamos a pasar el presupuesto');
  });

  it('sin estimativo el camino sigue siendo de cinco pasos', () => {
    dibujar(trabajo());

    expect(pasosDelCamino()).toHaveLength(5);
    expect(screen.queryByText('Te pasamos un número estimado')).not.toBeInTheDocument();
  });

  it('en ningún lado aparece un importe del estimativo', () => {
    const dibujada = dibujar(
      trabajo({
        estado: 'presupuesto_estimativo',
        precio: null,
        sena: null,
        pagos: [],
        pago: { instancia: 'sena', formas: ['efectivo'], monto: null, siguiente: null },
        fechas: fechas({ estimativo: '2026-09-15' }),
      }),
    );

    const texto = dibujada.container.textContent.replace(/\s+/g, ' ');
    expect(texto.match(/\$ ?[\d.,]+/g) ?? []).toEqual([]);
  });

  function sinMedir(): TrabajoDelCliente {
    return trabajo({
      estado: 'presupuesto_estimativo',
      precio: null,
      sena: null,
      pagos: [],
      fechas: fechas({ estimativo: '2026-09-15' }),
      visita: { dia: '2026-09-22', hecha: false },
    });
  }

  it('sin medir, una sola (i), al lado de la fecha del paso en curso, y el resumen abajo del titular', () => {
    dibujar(sinMedir());

    const camino = screen.getByRole('region', { name: 'En qué anda' });
    const estimativo = within(camino).getAllByRole('listitem')[0] as HTMLElement;
    expect(screen.getAllByRole('button', { name: LA_NOTA })).toHaveLength(1);
    const boton = within(estimativo).getByRole('button', { name: PUEDE_CAMBIAR });
    expect(boton).toHaveAttribute('aria-expanded', 'false');
    expect(boton.previousSibling?.textContent).toBe('mar 15 sep');
    expect(boton.nextSibling).toBeNull();
    expect(within(estimativo).getByText('Te pasamos un número estimado')).not.toContainElement(
      boton,
    );
    expect(screen.getByRole('region', { name: 'Tu mueble' })).toHaveTextContent(
      'Número estimado, falta ir a medir',
    );
    expect(pasosDelCamino().join(' ')).not.toContain('Relevamiento técnico');
    expect(
      screen.getByText(
        'Si seguimos adelante, lo próximo es ir a medir para pasarte el presupuesto.',
      ),
    ).toBeInTheDocument();
  });

  it('en el celular abre una hoja con el día que quedamos, y «Entendido» la cierra', () => {
    dibujar(sinMedir());

    const boton = screen.getByRole('button', { name: PUEDE_CAMBIAR });
    fireEvent.click(boton);

    const hoja = screen.getByRole('dialog', { name: 'El número todavía puede cambiar' });
    expect(boton).toHaveAttribute('aria-expanded', 'true');
    expect(hoja).toHaveTextContent('Lo que te pasamos es un estimado, sacado de lo que hablamos.');
    expect(hoja).toHaveTextContent('Quedamos en ir el mar 22 sep.');
    fireEvent.click(within(hoja).getByRole('button', { name: 'Entendido' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(boton).toHaveAttribute('aria-expanded', 'false');
  });

  it('en la PC abre al pasar el mouse, queda anclada al paso y cierra con Escape', () => {
    conPantalla('escritorio');
    dibujar(sinMedir());

    const boton = screen.getByRole('button', { name: PUEDE_CAMBIAR });
    const paso = boton.closest('li');
    fireEvent.mouseEnter(boton);
    expect(boton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const nota = document.getElementById(boton.getAttribute('aria-controls') ?? '');
    expect(nota?.closest('li')).toBe(paso);
    expect(nota).toHaveTextContent('Para cerrarlo tenemos que ir a tu casa a tomar las medidas.');

    fireEvent.click(boton);
    expect(boton).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(boton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(boton);
    expect(boton).toHaveAttribute('aria-expanded', 'true');
    fireEvent.mouseLeave(paso as HTMLElement);
    expect(boton).toHaveAttribute('aria-expanded', 'false');
  });

  it('ya medido, la (i) dice de dónde sale el número y el resumen dice el día', () => {
    dibujar(
      trabajo({
        estado: 'a_presupuestar',
        precio: null,
        sena: null,
        pagos: [],
        fechas: fechas({ estimativo: '2026-09-02' }),
        visita: { dia: '2026-09-10', hecha: true },
      }),
    );

    const camino = screen.getByRole('region', { name: 'En qué anda' });
    const presupuesto = within(camino).getAllByRole('listitem')[1] as HTMLElement;
    const boton = within(presupuesto).getByRole('button', { name: DE_DONDE_SALE });
    expect(boton.previousSibling).toBeNull();
    expect(boton.parentElement?.previousElementSibling).toHaveTextContent(
      'Estamos preparando tu presupuesto',
    );
    fireEvent.click(boton);
    const hoja = screen.getByRole('dialog', {
      name: 'El número ya está tomado de las medidas reales',
    });
    expect(hoja).toHaveTextContent('Fuimos a medir el jue 10 sep.');
    expect(screen.getByRole('region', { name: 'Tu mueble' })).toHaveTextContent('Medido el 10 sep');
    const historia = screen.getByRole('region', { name: 'Lo que fue pasando' });
    expect(within(historia).getByText('Fuimos a medir')).toBeInTheDocument();
    expect(within(historia).getByText('Te pasamos un número estimado')).toBeInTheDocument();
  });

  it('sin estimativo no hay número que pueda cambiar, y sin medir tampoco hay (i)', () => {
    dibujar(
      trabajo({ estado: 'relevamiento', precio: null, sena: null, pagos: [], fechas: fechas({}) }),
    );

    expect(screen.queryByRole('button', { name: LA_NOTA })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Tu mueble' })).not.toHaveTextContent('Número');
  });

  it('desde que se aprueba, la (i) no está', () => {
    dibujar(
      trabajo({
        fechas: fechas({ estimativo: '2026-08-01', presupuesto: '2026-08-05' }),
        visita: { dia: '2026-08-03', hecha: true },
      }),
    );

    expect(screen.queryByRole('button', { name: LA_NOTA })).not.toBeInTheDocument();
  });
});
