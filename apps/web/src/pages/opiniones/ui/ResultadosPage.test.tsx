import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LecturaDeOpinion } from '@/entities/opinion';
import { ProveedorDeReplica } from '@/entities/replica';
import { TABLAS_REPLICADAS, type FilaDe, type Replica, type TablaReplicada } from '@/shared/api';

import { ResultadosPage } from './ResultadosPage';

const HOY = '2026-09-21';

type Filas = { [T in TablaReplicada]?: FilaDe<T>[] };

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
    obligatoria: false,
    opciones: null,
    cantidad_de_opciones: 0,
    archivada_at: null,
    created_at: '2024-01-01T12:00:00Z',
    updated_at: '2024-01-01T12:00:00Z',
    deleted_at: null,
    version: 1,
    ...extra,
  } satisfies FilaDe<'preguntas'>;
}

const CONFORME = pregunta('conforme', 10, {
  titular: true,
  texto: '¿Qué tan conforme quedaste con el mueble?',
});
const MEJOR = pregunta('mejor', 20, {
  tipo: 'texto',
  escala: null,
  texto: '¿Qué podríamos hacer mejor?',
});

interface Respondida {
  cliente: string;
  dia: string;
  valor: number;
  comentario?: string;
  leida?: boolean;
  telefono?: string;
}

function armar(respondidas: readonly Respondida[], sinContestar = 0): Filas {
  const filas: Required<
    Pick<
      Filas,
      'clientes' | 'proyectos' | 'encuestas_enviadas' | 'respuestas' | 'renglones_de_respuesta'
    >
  > = {
    clientes: [],
    proyectos: [],
    encuestas_enviadas: [],
    respuestas: [],
    renglones_de_respuesta: [],
  };
  const todas = [
    ...respondidas.map((respondida) => ({ respondida, enviada: respondida.dia })),
    ...Array.from({ length: sinContestar }, (_, indice) => ({
      respondida: null,
      enviada: `2026-09-${String(10 + (indice % 9)).padStart(2, '0')}`,
    })),
  ];
  todas.forEach(({ respondida, enviada }, indice) => {
    const clienteId = `c${String(indice)}`;
    const proyectoId = `p${String(indice)}`;
    const encuestaId = `e${String(indice)}`;
    filas.clientes.push({
      id: clienteId,
      nombre: respondida?.cliente ?? `Cliente ${String(indice)}`,
      telefono: respondida?.telefono ?? '',
    } as FilaDe<'clientes'>);
    filas.proyectos.push({
      id: proyectoId,
      cliente_id: clienteId,
      titulo: `Trabajo ${String(indice)}`,
      estado: 'entregado',
      fecha_entrega: enviada,
      updated_at: `${enviada}T12:00:00Z`,
    } as FilaDe<'proyectos'>);
    filas.encuestas_enviadas.push({
      id: encuestaId,
      household_id: 'h',
      proyecto_id: proyectoId,
      token: `token-${String(indice)}`,
      token_hash: `hash-${String(indice)}`,
      preguntas: [CONFORME, MEJOR].map((fila) => ({
        id: fila.id,
        texto: fila.texto,
        tipo: fila.tipo,
        escala: fila.escala,
        obligatoria: fila.obligatoria,
        opciones: fila.opciones,
        propia: false,
      })),
      enviada_at: `${enviada}T10:00:00Z`,
      recordada_at: null,
      revocada_at: null,
      created_at: `${enviada}T10:00:00Z`,
      updated_at: `${enviada}T10:00:00Z`,
      deleted_at: null,
      version: 1,
    });
    if (respondida === null) return;
    const respuestaId = `r${String(indice)}`;
    filas.respuestas.push({
      id: respuestaId,
      household_id: 'h',
      encuesta_id: encuestaId,
      contestada_at: `${respondida.dia}T15:00:00Z`,
      leida_at: respondida.leida === false ? null : `${respondida.dia}T20:00:00Z`,
      created_at: `${respondida.dia}T15:00:00Z`,
      updated_at: `${respondida.dia}T15:00:00Z`,
      deleted_at: null,
      version: 1,
    });
    const renglon = (id: string, preguntaFila: FilaDe<'preguntas'>, valor: number | string) => ({
      id,
      household_id: 'h',
      respuesta_id: respuestaId,
      pregunta_id: preguntaFila.id,
      pregunta_texto: preguntaFila.texto,
      tipo: preguntaFila.tipo,
      cantidad_de_opciones: 0,
      valor_numero: typeof valor === 'number' ? valor : null,
      valor_opciones: null,
      valor_texto: typeof valor === 'string' ? valor : null,
      created_at: `${respondida.dia}T15:00:00Z`,
      updated_at: `${respondida.dia}T15:00:00Z`,
      deleted_at: null,
      version: 1,
    });
    filas.renglones_de_respuesta.push(renglon(`g${String(indice)}`, CONFORME, respondida.valor));
    if (respondida.comentario !== undefined) {
      filas.renglones_de_respuesta.push(
        renglon(`t${String(indice)}`, MEJOR, respondida.comentario),
      );
    }
  });
  return filas;
}

function replicaCon(filas: Filas): Replica {
  const tablas = {} as Record<TablaReplicada, Record<string, unknown>>;
  for (const tabla of TABLAS_REPLICADAS) {
    tablas[tabla] = Object.fromEntries(
      ((filas[tabla] ?? []) as { id: string }[]).map((fila) => [fila.id, fila]),
    );
  }
  tablas.households = { h: { id: 'h', nombre: 'MAUN' } };
  tablas.preguntas = { conforme: CONFORME, mejor: MEJOR };
  return { usuarioId: 'u', cursor: '', reconciliadoEn: '', tablas } as unknown as Replica;
}

function montar(filas: Filas, ruta = '/opiniones') {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <QueryClientProvider client={queryClient}>
        <ProveedorDeReplica replica={replicaCon(filas)}>
          <ResultadosPage />
        </ProveedorDeReplica>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return {
    lecturas: (): LecturaDeOpinion[] =>
      queryClient
        .getMutationCache()
        .getAll()
        .map((mutacion) => mutacion.state.variables as LecturaDeOpinion),
  };
}

function muchas(n: number, desde = '2026-09-01'): Respondida[] {
  return Array.from({ length: n }, (_, indice) => {
    const dia = new Date(`${desde}T12:00:00Z`);
    dia.setUTCDate(dia.getUTCDate() + indice);
    return {
      cliente: `Persona ${String(indice)}`,
      dia: dia.toISOString().slice(0, 10),
      valor: (indice % 5) + 1,
    };
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${HOY}T15:00:00`));
  onlineManager.setOnline(true);
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
});

describe('Resultados', () => {
  it('sin ninguna encuesta mandada invita a pedir la primera', () => {
    montar({
      proyectos: [
        {
          id: 'p',
          cliente_id: 'c',
          titulo: 'Placard',
          estado: 'entregado',
          fecha_entrega: '2026-09-01',
          updated_at: '2026-09-01T12:00:00Z',
        } as FilaDe<'proyectos'>,
      ],
    });

    expect(
      screen.getByRole('heading', { name: 'Todavía no le preguntaste a nadie' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Tenés 1 trabajo terminado\./)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Pedirle la opinión a un cliente' }),
    ).toBeInTheDocument();
  });

  it('mandadas y sin contestar dice cuántas y ofrece ver a quién', () => {
    montar(armar([], 3));

    expect(screen.getByText(/Les preguntaste a 3 clientes, el más viejo hace/)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Todavía no contestó ninguno' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver a quién le mandaste' }));
    expect(screen.getByRole('region', { name: 'Trabajo por trabajo' })).toBeInTheDocument();
  });

  it('con una sola respuesta muestra el promedio con su conteo y el punto de esa persona', () => {
    montar(
      armar(
        [{ cliente: 'Nadia Roldán', dia: '2026-09-18', valor: 5, comentario: 'Impecable.' }],
        2,
      ),
    );

    const titular = screen.getByRole('region', { name: 'El titular' });
    expect(within(titular).getByText('5')).toBeInTheDocument();
    expect(within(titular).getByText('Es el promedio de 1 respuesta')).toBeInTheDocument();
    expect(within(titular).getByText('Contestaron 33% (1 de 3)')).toBeInTheDocument();
    expect(
      within(titular).getByText(
        'Cada punto es un cliente al que le preguntaste. El lleno contestó.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Impecable.')).toBeInTheDocument();
    expect(screen.getByText('1 de 1 escribieron algo')).toBeInTheDocument();
  });

  it('con 11 respuestas se ve un punto por persona y ningún porcentaje suelto', () => {
    montar(armar(muchas(11)));

    expect(
      screen.getByText(/Cada punto es una persona\. Con menos de 12 respuestas/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Muy conforme \(\d+\)/)).not.toBeInTheDocument();
    expect(screen.queryByText(/%/, { selector: 'td' })).not.toBeInTheDocument();
  });

  it('con 12 respuestas pasa a la barra repartida, con la leyenda y sus conteos', () => {
    montar(armar(muchas(12)));

    expect(screen.getByText(/ya tiene sentido verlas repartidas/)).toBeInTheDocument();
    expect(screen.getByText('Muy conforme (2)')).toBeInTheDocument();
    expect(screen.getByText('Nada conforme (3)')).toBeInTheDocument();
  });

  it('los números se muestran siempre con el conteo al lado', () => {
    montar(armar(muchas(12)));

    fireEvent.click(screen.getByRole('button', { name: 'Ver los números' }));
    expect(screen.getByRole('row', { name: 'Nada conforme 25% (3 de 12)' })).toBeInTheDocument();
  });

  it('sin medio año de historia no promete una tendencia, aunque haya 12 respuestas', () => {
    montar(armar(muchas(12)));

    expect(
      screen.getByText(/Con 12 respuestas y medio año de historia vamos a poder mostrar/),
    ).toBeInTheDocument();
  });

  it('con 12 respuestas y medio año de historia la tira ya se lee como evolución', () => {
    const espaciadas = muchas(12, '2025-06-01').map((respondida, indice) => ({
      ...respondida,
      dia: `${String(2025 + Math.floor((5 + indice) / 12))}-${String(((5 + indice) % 12) + 1).padStart(2, '0')}-10`,
    }));
    montar(armar(espaciadas));

    expect(screen.getByText(/de la más vieja a la más nueva/)).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /12 respuestas, del 10 jun al 10 may/ }),
    ).toBeInTheDocument();
  });

  it('tocar el nombre de quien escribió abre su respuesta y la marca leída', () => {
    onlineManager.setOnline(false);
    const { lecturas } = montar(
      armar([
        {
          cliente: 'Nadia Roldán',
          dia: '2026-09-18',
          valor: 5,
          comentario: 'Impecable.',
          leida: false,
          telefono: '11 4088 2210',
        },
      ]),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Nadia Roldán' }));

    const ficha = screen.getByRole('dialog', { name: 'Nadia Roldán' });
    expect(within(ficha).getByText('Contestó el 18 de septiembre')).toBeInTheDocument();
    expect(within(ficha).getByText('Muy conforme')).toBeInTheDocument();
    expect(within(ficha).getByRole('link', { name: 'Abrir el trabajo' })).toHaveAttribute(
      'href',
      '/proyectos/p0',
    );
    expect(within(ficha).getByRole('link', { name: 'Escribirle' })).toHaveAttribute(
      'href',
      'https://wa.me/5491140882210',
    );
    expect(lecturas()).toHaveLength(1);
    expect(lecturas()[0]?.respuesta.id).toBe('r0');
  });

  it('una respuesta ya leída no se vuelve a marcar', () => {
    onlineManager.setOnline(false);
    const { lecturas } = montar(
      armar([{ cliente: 'Nadia Roldán', dia: '2026-09-18', valor: 5, comentario: 'Bien.' }]),
      '/opiniones?respuesta=r0',
    );

    expect(screen.getByRole('dialog', { name: 'Nadia Roldán' })).toBeInTheDocument();
    expect(lecturas()).toEqual([]);
  });

  it('una respuesta que ya no está no rompe la pantalla', () => {
    montar(
      armar([{ cliente: 'Nadia Roldán', dia: '2026-09-18', valor: 5 }]),
      '/opiniones?respuesta=otra',
    );

    expect(screen.getByRole('dialog', { name: 'Esta respuesta ya no está' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'El titular' })).toBeInTheDocument();
  });

  it('sin señal avisa que se ve lo último sincronizado, y los resultados siguen ahí', () => {
    onlineManager.setOnline(false);
    montar(armar([{ cliente: 'Nadia Roldán', dia: '2026-09-18', valor: 4 }]));

    expect(
      screen.getByText('Sin conexión. Estás viendo lo último que se sincronizó.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'El titular' })).toBeInTheDocument();
  });
});
