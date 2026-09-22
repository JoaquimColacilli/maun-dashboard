import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { GuardadoDePregunta, RecordatorioDeEncuesta } from '@/entities/opinion';
import { ProveedorDeReplica } from '@/entities/replica';
import { TABLAS_REPLICADAS, type FilaDe, type Replica, type TablaReplicada } from '@/shared/api';

import { PedirLaOpinion } from './PedirLaOpinion';

const HOY = '2026-09-21';

function pregunta(id: string, orden: number, extra: Partial<FilaDe<'preguntas'>> = {}) {
  return {
    id,
    household_id: 'h',
    serie: id,
    numero: 1,
    proyecto_id: null,
    titular: false,
    orden,
    texto: `Pregunta ${id}`,
    tipo: 'escala5',
    escala: 'conformidad',
    obligatoria: true,
    opciones: null,
    cantidad_de_opciones: 0,
    archivada_at: null,
    created_at: '2026-01-01T12:00:00Z',
    updated_at: '2026-01-01T12:00:00Z',
    deleted_at: null,
    version: 1,
    ...extra,
  } satisfies FilaDe<'preguntas'>;
}

const BASE = [
  pregunta('conforme', 10, { titular: true, texto: '¿Qué tan conforme quedaste con el mueble?' }),
  pregunta('tiempos', 20, { escala: 'tiempos' }),
  pregunta('trato', 30, { escala: 'trato' }),
  pregunta('recomienda', 40, { tipo: 'sitalvezno', escala: null }),
  pregunta('mejor', 50, { tipo: 'texto', escala: null, obligatoria: false }),
];

const PROYECTO = {
  id: 'p1',
  household_id: 'h',
  cliente_id: 'c1',
  titulo: 'Placard 3 puertas con interior en melamina',
  estado: 'entregado',
  fecha_entrega: '2026-08-27',
} as FilaDe<'proyectos'>;

const CLIENTE = { nombre: 'Marcela Duarte', telefono: '11 5523 4410' };

function encuesta(extra: Partial<FilaDe<'encuestas_enviadas'>> = {}) {
  return {
    id: 'e1',
    household_id: 'h',
    proyecto_id: 'p1',
    token: 'token-de-prueba-0001',
    token_hash: 'hash',
    preguntas: BASE.map((fila) => ({
      id: fila.id,
      texto: fila.texto,
      tipo: fila.tipo,
      escala: fila.escala,
      obligatoria: fila.obligatoria,
      opciones: fila.opciones,
      propia: false,
    })),
    enviada_at: '2026-09-16T12:00:00Z',
    recordada_at: null,
    revocada_at: null,
    created_at: '2026-09-16T12:00:00Z',
    updated_at: '2026-09-16T12:00:00Z',
    deleted_at: null,
    version: 1,
    ...extra,
  } satisfies FilaDe<'encuestas_enviadas'>;
}

function replicaCon(filas: { [T in TablaReplicada]?: readonly FilaDe<T>[] }): Replica {
  const tablas = {} as Record<TablaReplicada, Record<string, unknown>>;
  for (const tabla of TABLAS_REPLICADAS) {
    tablas[tabla] = Object.fromEntries(
      ((filas[tabla] ?? []) as readonly { id: string }[]).map((fila) => [fila.id, fila]),
    );
  }
  tablas.proyectos = { p1: PROYECTO };
  tablas.clientes = { c1: { id: 'c1', nombre: CLIENTE.nombre, telefono: CLIENTE.telefono } };
  return { usuarioId: 'u', cursor: '', reconciliadoEn: '', tablas } as unknown as Replica;
}

function montar(filas: { [T in TablaReplicada]?: readonly FilaDe<T>[] }) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <ProveedorDeReplica replica={replicaCon({ preguntas: BASE, ...filas })}>
          <PedirLaOpinion proyecto={PROYECTO} cliente={CLIENTE} />
        </ProveedorDeReplica>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return {
    variables: () =>
      queryClient
        .getMutationCache()
        .getAll()
        .map((mutacion) => mutacion.state.variables),
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${HOY}T15:00:00`));
  onlineManager.setOnline(false);
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  onlineManager.setOnline(true);
  localStorage.clear();
});

describe('pedir la opinión desde el trabajo terminado', () => {
  it('sin mandar, ofrece pedirla por WhatsApp con un mensaje corto y el enlace de la encuesta', () => {
    montar({});

    const bloque = screen.getByRole('region', { name: 'Pedile la opinión a Marcela' });
    expect(
      within(bloque).getByText(
        'Son cuatro preguntas y un comentario. Le llega un enlace, lo abre sin cuenta y te contesta en menos de dos minutos.',
      ),
    ).toBeInTheDocument();
    const whatsapp = within(bloque).getByRole('link', { name: 'Pedírsela por WhatsApp' });
    const destino = new URL(whatsapp.getAttribute('href') ?? '');
    expect(destino.origin + destino.pathname).toBe('https://wa.me/5491155234410');
    expect(destino.searchParams.get('text')).toMatch(
      /^Hola Marcela, ya terminamos tu placard\. ¿Nos contás en un minuto cómo te fue\? http:\/\/localhost(:\d+)?\/o\/[A-Za-z0-9_-]{32}$/,
    );
  });

  it('sin señal no manda nada y dice por qué', () => {
    const { variables } = montar({});

    fireEvent.click(screen.getByRole('link', { name: 'Pedírsela por WhatsApp' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Para crear el enlace de la encuesta hace falta señal.',
    );
    expect(variables()).toEqual([]);
  });

  it('mandada, dice cuándo le llegó y deja recordársela una sola vez', () => {
    const { variables } = montar({ encuestas_enviadas: [encuesta()] });

    const bloque = screen.getByRole('region', { name: 'Le pediste la opinión' });
    expect(within(bloque).getByText('sin contestar')).toBeInTheDocument();
    expect(
      within(bloque).getByText('Le llegó hace 5 días, todavía no contestó'),
    ).toBeInTheDocument();
    const recordar = within(bloque).getByRole('link', { name: 'Recordárselo una vez' });
    expect(new URL(recordar.getAttribute('href') ?? '').searchParams.get('text')).toContain(
      'te escribo de nuevo por si se te pasó',
    );

    fireEvent.click(recordar);
    expect((variables()[0] as RecordatorioDeEncuesta).encuesta.id).toBe('e1');
  });

  it('ya recordada, no hay un segundo recordatorio y lo explica', () => {
    montar({ encuestas_enviadas: [encuesta({ recordada_at: '2026-09-19T12:00:00Z' })] });

    expect(screen.queryByRole('link', { name: 'Recordárselo una vez' })).not.toBeInTheDocument();
    expect(
      screen.getByText(
        /Ya le recordaste una vez, el 19 de septiembre\. No hay un segundo recordatorio/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dar de baja este enlace' })).toBeInTheDocument();
  });

  it('contestada, muestra lo que dijo y lleva a su respuesta', () => {
    montar({
      encuestas_enviadas: [encuesta()],
      respuestas: [
        {
          id: 'r1',
          household_id: 'h',
          encuesta_id: 'e1',
          contestada_at: '2026-09-02T15:00:00Z',
          leida_at: null,
          created_at: '2026-09-02T15:00:00Z',
          updated_at: '2026-09-02T15:00:00Z',
          deleted_at: null,
          version: 1,
        },
      ],
      renglones_de_respuesta: [
        {
          id: 'g1',
          household_id: 'h',
          respuesta_id: 'r1',
          pregunta_id: 'conforme',
          pregunta_texto: '¿Qué tan conforme quedaste con el mueble?',
          tipo: 'escala5',
          cantidad_de_opciones: 0,
          valor_numero: 5,
          valor_opciones: null,
          valor_texto: null,
          created_at: '2026-09-02T15:00:00Z',
          updated_at: '2026-09-02T15:00:00Z',
          deleted_at: null,
          version: 1,
        },
        {
          id: 'g2',
          household_id: 'h',
          respuesta_id: 'r1',
          pregunta_id: 'mejor',
          pregunta_texto: 'Pregunta mejor',
          tipo: 'texto',
          cantidad_de_opciones: 0,
          valor_numero: null,
          valor_opciones: null,
          valor_texto: 'Es la segunda vez que les compro.',
          created_at: '2026-09-02T15:00:00Z',
          updated_at: '2026-09-02T15:00:00Z',
          deleted_at: null,
          version: 1,
        },
      ],
    });

    const bloque = screen.getByRole('region', { name: 'Marcela ya te contestó' });
    expect(
      within(bloque).getByText('Contestó el 2 de septiembre, seis días después de la entrega.'),
    ).toBeInTheDocument();
    const respuesta = within(bloque).getByRole('link', { name: /Muy conforme/ });
    expect(respuesta).toHaveAttribute('href', '/opiniones?respuesta=r1');
    expect(within(respuesta).getByText('«Es la segunda vez que les compro.»')).toBeInTheDocument();
    expect(
      screen.getByText(/Marcela ya contestó, así que estas preguntas quedan como están/),
    ).toBeInTheDocument();
  });
});

describe('las preguntas de este trabajo', () => {
  it('antes de mandarla se puede sumar una, que va solo a esta encuesta', () => {
    const { variables } = montar({});

    fireEvent.click(screen.getByRole('button', { name: 'Agregar una pregunta para este trabajo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregarla a esta encuesta' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Escribí la pregunta.');

    fireEvent.change(screen.getByRole('textbox', { name: 'Qué le querés preguntar a Marcela' }), {
      target: { value: '  ¿El montaje molestó al resto de la obra?  ' },
    });
    fireEvent.click(screen.getByRole('radio', { name: 'Sí / tal vez / no' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregarla a esta encuesta' }));

    expect((variables()[0] as GuardadoDePregunta).fila).toMatchObject({
      proyecto_id: 'p1',
      tipo: 'sitalvezno',
      escala: null,
      obligatoria: false,
      numero: 1,
      texto: '¿El montaje molestó al resto de la obra?',
    });
  });

  it('con tres ya no se ofrece otra', () => {
    const propias = [1, 2, 3].map((n) =>
      pregunta(`propia-${String(n)}`, n * 10, { proyecto_id: 'p1', obligatoria: false }),
    );
    montar({ preguntas: [...BASE, ...propias] });

    expect(screen.getByText('3 de 3')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Agregar una pregunta para este trabajo' }),
    ).not.toBeInTheDocument();
  });

  it('mandada y sin contestar, las de este trabajo todavía se suman y se sacan', () => {
    montar({
      preguntas: [...BASE, pregunta('propia', 10, { proyecto_id: 'p1', obligatoria: false })],
      encuestas_enviadas: [encuesta()],
    });

    expect(screen.getByRole('region', { name: 'Le pediste la opinión' })).toBeInTheDocument();
    expect(screen.getByText('1 de 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Sacar la pregunta/ })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Agregar una pregunta para este trabajo' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/quedan como están/)).not.toBeInTheDocument();
  });
});
