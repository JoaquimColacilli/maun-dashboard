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

function trabajo(cambios: Partial<TrabajoDelCliente> = {}): TrabajoDelCliente {
  return {
    taller: 'Taller MAUN',
    cliente: 'Marcela Duarte',
    trabajo: 'Placard 3 puertas',
    direccion: 'Olazábal 1240, Ituzaingó',
    estado: 'en_curso',
    precio: centavos(124_000_000),
    fechas: {
      estimativo: null,
      presupuesto: '2026-08-01',
      aprobado: '2026-08-04',
      inicio: '2026-08-24',
      entregaPautada: '2026-10-02',
      entregado: null,
      cobro: null,
    },
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
        fechas: {
          estimativo: null,
          presupuesto: '2026-08-01',
          aprobado: '2026-08-04',
          inicio: '2026-08-24',
          entregaPautada: '2026-09-16',
          entregado: '2026-09-16',
          cobro: null,
        },
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

  it('cuando hace días que no pasa nada, no se lo cuenta: dice qué sigue', () => {
    const dibujada = dibujar(
      trabajo({
        pagos: [],
        fechas: {
          estimativo: null,
          presupuesto: '2026-08-01',
          aprobado: null,
          inicio: '2026-09-01',
          entregaPautada: '2026-10-02',
          entregado: null,
          cobro: null,
        },
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

  it('un trabajo sin presupuesto no inventa un saldo', () => {
    dibujar(trabajo({ precio: null, pagos: [] }));

    const entrada = screen.getByRole('region', { name: 'Tu mueble' });
    expect(entrada).toHaveTextContent('Falta el presupuesto');
    expect(entrada).toHaveTextContent('—');
  });
});

function fechas(cambios: Partial<TrabajoDelCliente['fechas']>): TrabajoDelCliente['fechas'] {
  return {
    estimativo: null,
    presupuesto: null,
    aprobado: null,
    inicio: null,
    entregaPautada: null,
    entregado: null,
    cobro: null,
    ...cambios,
  };
}

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
        pagos: [],
        fechas: fechas({ estimativo: '2026-09-15' }),
      }),
    );

    const entrada = screen.getByRole('region', { name: 'Tu mueble' });
    expect(within(entrada).getByText('Te pasamos un número estimado')).toBeInTheDocument();
    expect(entrada).toHaveTextContent('Falta el presupuesto');
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

  it('en ningún lado aparece un importe del estimativo: lo único en pesos es lo que pagó, cero', () => {
    const dibujada = dibujar(
      trabajo({
        estado: 'presupuesto_estimativo',
        precio: null,
        pagos: [],
        pago: { instancia: 'sena', formas: ['efectivo'], monto: null, siguiente: null },
        fechas: fechas({ estimativo: '2026-09-15' }),
      }),
    );

    const texto = dibujada.container.textContent.replace(/\s+/g, ' ');
    const importes = texto.match(/\$ ?[\d.,]+/g) ?? [];
    expect(importes.length).toBeGreaterThan(0);
    expect(importes.every((importe) => importe.replace(' ', '') === '$0')).toBe(true);
  });

  function sinMedir(): TrabajoDelCliente {
    return trabajo({
      estado: 'presupuesto_estimativo',
      precio: null,
      pagos: [],
      fechas: fechas({ estimativo: '2026-09-15' }),
      visita: { dia: '2026-09-22', hecha: false },
    });
  }

  it('sin medir, una sola (i), pegada al rótulo del paso en curso, y el resumen abajo del titular', () => {
    dibujar(sinMedir());

    const camino = screen.getByRole('region', { name: 'En qué anda' });
    const [estimativo] = within(camino).getAllByRole('listitem');
    expect(screen.getAllByRole('button', { name: LA_NOTA })).toHaveLength(1);
    const boton = within(estimativo as HTMLElement).getByRole('button', { name: PUEDE_CAMBIAR });
    expect(boton).toHaveAttribute('aria-expanded', 'false');
    expect(boton.previousSibling?.textContent).toBe('Te pasamos un número estimado');
    expect(boton.nextSibling).toBeNull();
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
        pagos: [],
        fechas: fechas({ estimativo: '2026-09-02' }),
        visita: { dia: '2026-09-10', hecha: true },
      }),
    );

    const camino = screen.getByRole('region', { name: 'En qué anda' });
    const presupuesto = within(camino).getAllByRole('listitem')[1] as HTMLElement;
    fireEvent.click(within(presupuesto).getByRole('button', { name: DE_DONDE_SALE }));
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
    dibujar(trabajo({ estado: 'relevamiento', precio: null, pagos: [], fechas: fechas({}) }));

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
