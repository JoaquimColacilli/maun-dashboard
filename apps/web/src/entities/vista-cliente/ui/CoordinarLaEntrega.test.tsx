import {
  centavos,
  vistaDelCliente,
  type EntregaQueSeCoordina,
  type RespuestaDeEntregaParaMandar,
  type TrabajoDelCliente,
} from '@maun/domain';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { MandarLaEntrega, ResultadoDeMandar } from '../model/mandar';
import { ACA_NO_SE_GUARDA_NADA, CAMBIO_EL_PEDIDO, YA_ESTABA_CONFIRMADA } from '../model/textos';
import { VistaDelCliente } from './VistaDelCliente';

vi.mock('@/shared/api', () => ({
  urlDelArchivo: (ruta: string) => `https://cdn.maun.test/${ruta}`,
}));

const HOY = '2026-09-25';

const UN_DIA = {
  id: '0192a3b4-0000-7000-8000-000000000001',
  forma: 'un_dia',
  fecha: '2026-10-08',
  franja: 'manana',
} as const;

const SUS_DIAS = {
  id: '0192a3b4-0000-7000-8000-000000000002',
  forma: 'sus_dias',
  fecha: null,
  franja: null,
} as const;

function trabajo(entrega: Partial<EntregaQueSeCoordina>): TrabajoDelCliente {
  return {
    taller: 'Taller MAUN',
    cliente: 'Cintia Paz',
    trabajo: 'Placard de pasillo',
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
      listo: '2026-09-24',
      entregado: null,
      cobro: null,
      valeHasta: null,
    },
    visita: { dia: null, hecha: false },
    entrega: { comprometida: null, propuesta: null, respuesta: null, ...entrega },
    pago: { instancia: 'saldo', formas: ['efectivo'], monto: null, siguiente: null },
    cobro: { alias: null, cbu: null, titular: null, cuit: null, link: null },
    pagos: [],
    archivos: [],
  };
}

function dibujar(entrega: Partial<EntregaQueSeCoordina>, alMandar?: MandarLaEntrega) {
  return render(
    <VistaDelCliente
      vista={vistaDelCliente(trabajo(entrega), HOY)}
      hoy={HOY}
      alMandar={alMandar}
    />,
  );
}

function seccion() {
  return screen.getByRole('region', { name: 'Coordinemos la entrega' });
}

function mandador(resultado: ResultadoDeMandar = { tipo: 'guardada' }) {
  return vi.fn<MandarLaEntrega>(() => Promise.resolve(resultado));
}

function lo(mandar: ReturnType<typeof mandador>): RespuestaDeEntregaParaMandar {
  const [respuesta] = mandar.mock.lastCall ?? [];
  if (respuesta === undefined) throw new Error('no se mandó nada');
  return respuesta;
}

function anunciado(texto: string): boolean {
  return screen.getAllByRole('status').some((aviso) => aviso.textContent.includes(texto));
}

async function tocar(nombre: string | RegExp, dentro: HTMLElement = seccion()) {
  await act(async () => {
    fireEvent.click(within(dentro).getByRole('button', { name: nombre }));
    await Promise.resolve();
  });
}

describe('coordinar la entrega desde la página del cliente', () => {
  it('sin nada pedido no hay sección: solo lee que lo próximo es acordar el día', () => {
    dibujar({});
    expect(screen.queryByRole('region', { name: 'Coordinemos la entrega' })).toBeNull();
    expect(screen.getByText('Lo próximo es acordar el día de la entrega.')).toBeInTheDocument();
  });

  it('con un día propuesto lo acepta con un botón y lo anuncia', async () => {
    const mandar = mandador();
    dibujar({ propuesta: UN_DIA }, mandar);

    expect(within(seccion()).getByText('jue 8 oct, a la mañana')).toBeInTheDocument();
    await tocar('Me queda bien');

    expect(lo(mandar)).toMatchObject({
      propuesta_id: UN_DIA.id,
      respuesta: 'me_queda_bien',
      dias: [],
      nota: '',
    });
    expect(anunciado('Listo: te esperamos el jue 8 oct, a la mañana.')).toBe(true);
  });

  it('si no puede ese día, abre el calendario y manda sus días con la nota', async () => {
    const mandar = mandador();
    dibujar({ propuesta: UN_DIA }, mandar);

    await tocar('No puedo ese día');
    await tocar('jueves 1 de octubre');
    await tocar('lunes 28 de septiembre');
    expect(
      within(seccion()).getByRole('button', { name: 'lunes 28 de septiembre' }),
    ).toHaveAttribute('aria-pressed', 'true');

    const horario = within(seccion()).getByRole('group', {
      name: 'Horario del jueves 1 de octubre',
    });
    await tocar('A la mañana', horario);
    expect(within(horario).getByRole('button', { name: 'A la mañana' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    fireEvent.change(within(seccion()).getByLabelText('¿Algo que tengamos que saber?'), {
      target: { value: '  Tercer piso, sin ascensor ' },
    });
    await tocar('Mandar mis días');

    expect(lo(mandar)).toMatchObject({
      propuesta_id: UN_DIA.id,
      respuesta: 'mis_dias',
      dias: [
        { fecha: '2026-09-28', franjas: ['manana', 'tarde'] },
        { fecha: '2026-10-01', franjas: ['tarde'] },
      ],
      nota: 'Tercer piso, sin ascensor',
    });
  });

  it('los domingos y los días fuera del rango no son botones', async () => {
    dibujar({ propuesta: SUS_DIAS }, mandador());
    const botones = within(seccion())
      .getAllByRole('button', { pressed: false })
      .map((boton) => boton.getAttribute('aria-label'));
    expect(botones).not.toContain('domingo 27 de septiembre');
    expect(botones).not.toContain('sábado 26 de septiembre');
    expect(botones).not.toContain('domingo 25 de octubre');
    expect(botones).toContain('sábado 24 de octubre');
    await tocar('Mandar mis días');
    expect(within(seccion()).getByRole('alert')).toHaveTextContent(
      'Marcá al menos un día, o escribinos cuándo te queda bien.',
    );
  });

  it('con sus días pedidos el calendario ya está abierto y una nota sola alcanza', async () => {
    const mandar = mandador();
    dibujar({ propuesta: SUS_DIAS }, mandar);

    expect(within(seccion()).queryByRole('button', { name: 'Me queda bien' })).toBeNull();
    fireEvent.change(within(seccion()).getByLabelText('¿Algo que tengamos que saber?'), {
      target: { value: 'Cualquier tarde de la semana que viene' },
    });
    await tocar('Mandar mis días');
    expect(lo(mandar)).toMatchObject({ respuesta: 'mis_dias', dias: [] });
    expect(anunciado('Listo: le pasamos tus días al taller. Te va a confirmar uno.')).toBe(true);
  });

  it('lo que ya mandó se ve, y cambiarlo abre el calendario con esos días', async () => {
    dibujar(
      {
        propuesta: SUS_DIAS,
        respuesta: {
          respuesta: 'mis_dias',
          dias: [{ fecha: '2026-09-29', franjas: ['tarde'] }],
          nota: 'Portero hasta las 18',
        },
      },
      mandador(),
    );

    expect(within(seccion()).getByText('mar 29 sep, a la tarde')).toBeInTheDocument();
    expect(within(seccion()).getByText('Portero hasta las 18')).toBeInTheDocument();
    await tocar('Cambiar mis días');
    expect(
      within(seccion()).getByRole('button', { name: 'martes 29 de septiembre' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(within(seccion()).getByLabelText('¿Algo que tengamos que saber?')).toHaveValue(
      'Portero hasta las 18',
    );
  });

  it('un error queda a la vista y no pierde lo marcado', async () => {
    dibujar({ propuesta: SUS_DIAS }, mandador({ tipo: 'error', texto: 'Se cortó la conexión.' }));
    await tocar('miércoles 30 de septiembre');
    await tocar('Mandar mis días');
    expect(within(seccion()).getByRole('alert')).toHaveTextContent('Se cortó la conexión.');
    expect(
      within(seccion()).getByRole('button', { name: 'miércoles 30 de septiembre' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('si ya estaba confirmada o el taller cambió el pedido, lo dice', async () => {
    const { unmount } = dibujar({ propuesta: UN_DIA }, mandador({ tipo: 'ya-confirmada' }));
    await tocar('Me queda bien');
    expect(anunciado(YA_ESTABA_CONFIRMADA)).toBe(true);
    unmount();

    dibujar({ propuesta: UN_DIA }, mandador({ tipo: 'cambio' }));
    await tocar('Me queda bien');
    expect(anunciado(CAMBIO_EL_PEDIDO)).toBe(true);
  });

  it('en la vista previa del taller no se guarda nada', async () => {
    dibujar({ propuesta: UN_DIA });
    expect(within(seccion()).getByText(ACA_NO_SE_GUARDA_NADA)).toBeInTheDocument();
    await tocar('Me queda bien');
    expect(anunciado(ACA_NO_SE_GUARDA_NADA)).toBe(true);
  });

  it('con la entrega comprometida la sección se va y el titular da la buena noticia', () => {
    dibujar({ propuesta: UN_DIA, comprometida: { fecha: '2026-10-08', franja: 'manana' } });
    expect(screen.queryByRole('region', { name: 'Coordinemos la entrega' })).toBeNull();
    expect(
      screen.getByText('¡Buenas noticias! Lo estamos entregando el jue 8 oct, a la mañana.'),
    ).toBeInTheDocument();
  });
});
