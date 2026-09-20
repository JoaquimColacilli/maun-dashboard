import { centavos, vistaDelCliente, type TrabajoDelCliente } from '@maun/domain';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EL_SALDO_SE_COORDINA, LOS_PAGOS_LOS_ANOTA_EL_TALLER } from '../model/textos';
import { VistaDelCliente } from './VistaDelCliente';

vi.mock('@/shared/api', () => ({
  urlDelArchivo: (ruta: string) => `https://cdn.maun.test/${ruta}`,
}));

const HOY = '2026-09-18';

const CBU = '0110001312345678901233';
const CVU = '0000999109999999999990';

const CON_TODO = {
  alias: 'maun.muebles',
  cbu: CBU,
  titular: 'Ana Gutiérrez',
  cuit: '27-30123456-4',
};

const SIN_NADA = { alias: null, cbu: null, titular: null, cuit: null };

function trabajo(cambios: Partial<TrabajoDelCliente> = {}): TrabajoDelCliente {
  return {
    taller: 'Taller MAUN',
    cliente: 'Marcela Duarte',
    trabajo: 'Placard 3 puertas',
    direccion: 'Olazábal 1240',
    estado: 'en_curso',
    precio: centavos(124_000_000),
    fechas: {
      presupuesto: '2026-08-01',
      aprobado: '2026-08-04',
      inicio: '2026-08-24',
      entregaPautada: '2026-10-02',
      entregado: null,
      cobro: null,
    },
    pago: {
      instancia: 'sena',
      formas: ['transferencia', 'efectivo'],
      monto: centavos(22_000_000),
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
  return screen.queryByRole('region', { name: 'Cómo transferir' });
}

describe('el bloque para transferir', () => {
  it('muestra los cuatro datos, con el CBU agrupado para leerlo', () => {
    dibujar(trabajo());

    const bloque = elBloque();
    expect(bloque).not.toBeNull();
    if (!bloque) return;
    expect(within(bloque).getByText('maun.muebles')).toBeInTheDocument();
    expect(within(bloque).getByText('0110 0013 1234 5678 9012 33')).toBeInTheDocument();
    expect(within(bloque).getByText('Ana Gutiérrez')).toBeInTheDocument();
    expect(within(bloque).getByText('27-30123456-4')).toBeInTheDocument();
  });

  it('lo que el taller no cargó, no aparece', () => {
    dibujar(trabajo({ cobro: { ...SIN_NADA, alias: 'maun.muebles' } }));

    const bloque = elBloque();
    expect(bloque).not.toBeNull();
    if (!bloque) return;
    expect(within(bloque).getByText('maun.muebles')).toBeInTheDocument();
    expect(within(bloque).queryByText('CBU')).toBeNull();
    expect(within(bloque).queryByText('Titular de la cuenta')).toBeNull();
    expect(within(bloque).queryByText('CUIT del titular')).toBeNull();
  });

  it('con un CVU la etiqueta lo dice', () => {
    dibujar(trabajo({ cobro: { ...SIN_NADA, cbu: CVU } }));

    const bloque = elBloque();
    expect(bloque).not.toBeNull();
    if (!bloque) return;
    expect(within(bloque).getByText('CVU')).toBeInTheDocument();
    expect(within(bloque).getByRole('button', { name: 'Copiar el CVU' })).toBeInTheDocument();
  });

  it('sin ningún dato cargado no hay bloque, y el saldo se coordina con el taller', () => {
    dibujar(trabajo({ cobro: SIN_NADA }));

    expect(elBloque()).toBeNull();
    const pagos = screen.getByRole('region', { name: 'Lo que pagaste' });
    expect(pagos).toHaveTextContent(EL_SALDO_SE_COORDINA);
  });

  it('con el titular y el CUIT solos tampoco: con eso no se transfiere', () => {
    dibujar(trabajo({ cobro: { ...SIN_NADA, titular: 'Ana Gutiérrez', cuit: '27-30123456-4' } }));

    expect(elBloque()).toBeNull();
  });

  it('aparece antes de aprobar, que es justo cuando el cliente manda la seña', () => {
    dibujar(trabajo({ estado: 'presupuesto_enviado', precio: null, pagos: [] }));

    expect(elBloque()).not.toBeNull();
  });

  it('desaparece cuando ya está todo pagado', () => {
    dibujar(
      trabajo({
        estado: 'cobrado',
        pagos: [{ id: 'p1', fecha: '2026-09-17', concepto: 'Saldo', monto: centavos(124_000_000) }],
      }),
    );

    expect(elBloque()).toBeNull();
  });

  it('con datos cargados, el pie recuerda que los pagos los anota el taller', () => {
    dibujar(trabajo());

    const pagos = screen.getByRole('region', { name: 'Lo que pagaste' });
    expect(pagos).toHaveTextContent(LOS_PAGOS_LOS_ANOTA_EL_TALLER);
    expect(pagos).not.toHaveTextContent('Esta página no cobra nada');
  });
});

describe('el botón de copiar', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('cada botón dice qué copia', () => {
    dibujar(trabajo());

    for (const nombre of [
      'Copiar el alias',
      'Copiar el CBU',
      'Copiar el titular',
      'Copiar el CUIT',
    ]) {
      expect(screen.getByRole('button', { name: nombre })).toBeInTheDocument();
    }
  });

  it('copia el CBU sin espacios, aunque en pantalla esté agrupado', async () => {
    const copiado: string[] = [];
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      get: () => ({
        writeText: (texto: string) => {
          copiado.push(texto);
          return Promise.resolve();
        },
      }),
    });

    dibujar(trabajo());
    fireEvent.click(screen.getByRole('button', { name: 'Copiar el CBU' }));

    expect(copiado).toEqual([CBU]);
    expect(await screen.findByRole('button', { name: 'Copiar el CBU' })).toHaveTextContent(
      'Copiado',
    );
  });

  it('lo anuncia para el lector de pantalla, no solo con el color', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      get: () => ({ writeText: () => Promise.resolve() }),
    });

    dibujar(trabajo());
    fireEvent.click(screen.getByRole('button', { name: 'Copiar el alias' }));

    const avisos = await screen.findAllByRole('status');
    expect(avisos.some((aviso) => aviso.textContent === 'Copiado')).toBe(true);
  });

  it('si el portapapeles falla y el camino de atrás tampoco copia, no dice «Copiado»', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      get: () => ({
        writeText: () => Promise.reject(new DOMException('Document is not focused.')),
      }),
    });
    Object.defineProperty(document, 'execCommand', { configurable: true, value: () => false });

    dibujar(trabajo());
    fireEvent.click(screen.getByRole('button', { name: 'Copiar el alias' }));

    const boton = await screen.findByRole('button', { name: 'Copiar el alias' });
    expect(boton).not.toHaveTextContent('Copiado');
    // El mismo texto sale a la vista y al lector de pantalla: el fracaso no se calla.
    const dichos = screen.getAllByText(/mantené apretado|Marcalo con el dedo/);
    expect(dichos.length).toBeGreaterThan(1);
    expect(dichos.some((dicho) => dicho.getAttribute('role') === 'status')).toBe(true);
  });
});
