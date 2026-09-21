import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { GuardadoDePregunta } from '@/entities/opinion';
import { ProveedorDeReplica } from '@/entities/replica';
import { TABLAS_REPLICADAS, type FilaDe, type Replica, type TablaReplicada } from '@/shared/api';

import { EditorDeLaEncuesta } from './EditorDeLaEncuesta';

const AHORA = '2026-09-01T12:00:00Z';

function pregunta(id: string, extra: Partial<FilaDe<'preguntas'>> = {}): FilaDe<'preguntas'> {
  return {
    id,
    household_id: 'h',
    serie: id,
    numero: 1,
    proyecto_id: null,
    titular: false,
    orden: 10,
    texto: `Pregunta ${id}`,
    tipo: 'escala5',
    escala: 'conformidad',
    obligatoria: false,
    opciones: null,
    cantidad_de_opciones: 0,
    archivada_at: null,
    created_at: AHORA,
    updated_at: AHORA,
    deleted_at: null,
    version: 1,
    ...extra,
  };
}

const BASE = [
  pregunta('conforme', {
    orden: 10,
    titular: true,
    obligatoria: true,
    texto: '¿Qué tan conforme quedaste con el mueble?',
  }),
  pregunta('recomienda', {
    orden: 20,
    tipo: 'sitalvezno',
    escala: null,
    obligatoria: true,
    texto: '¿Se lo recomendarías a alguien?',
  }),
  pregunta('mejor', {
    orden: 30,
    tipo: 'texto',
    escala: null,
    texto: '¿Qué podríamos hacer mejor?',
  }),
];

function foto(filas: readonly FilaDe<'preguntas'>[]) {
  return filas.map((fila) => ({
    id: fila.id,
    texto: fila.texto,
    tipo: fila.tipo,
    escala: fila.escala,
    obligatoria: fila.obligatoria,
    opciones: fila.opciones,
    propia: false,
  }));
}

function conRespuestas(preguntas: readonly FilaDe<'preguntas'>[], contestadas: readonly string[]) {
  return {
    encuestas_enviadas: [
      {
        id: 'e1',
        household_id: 'h',
        proyecto_id: 'p1',
        token: 'token',
        token_hash: 'hash',
        preguntas: foto(preguntas),
        enviada_at: AHORA,
        recordada_at: null,
        revocada_at: null,
        created_at: AHORA,
        updated_at: AHORA,
        deleted_at: null,
        version: 1,
      },
    ],
    respuestas: [
      {
        id: 'r1',
        household_id: 'h',
        encuesta_id: 'e1',
        contestada_at: AHORA,
        leida_at: null,
        created_at: AHORA,
        updated_at: AHORA,
        deleted_at: null,
        version: 1,
      },
    ],
    renglones_de_respuesta: contestadas.map((id) => ({
      id: `g-${id}`,
      household_id: 'h',
      respuesta_id: 'r1',
      pregunta_id: id,
      pregunta_texto: 'lo que vio',
      tipo: 'escala5' as const,
      cantidad_de_opciones: 0,
      valor_numero: 5,
      valor_opciones: null,
      valor_texto: null,
      created_at: AHORA,
      updated_at: AHORA,
      deleted_at: null,
      version: 1,
    })),
  };
}

function replicaCon(filas: { [T in TablaReplicada]?: readonly FilaDe<T>[] }): Replica {
  const tablas = {} as Record<TablaReplicada, Record<string, unknown>>;
  for (const tabla of TABLAS_REPLICADAS) {
    tablas[tabla] = Object.fromEntries((filas[tabla] ?? []).map((fila) => [fila.id, fila]));
  }
  tablas.households = { h: { id: 'h', nombre: 'MAUN', created_at: AHORA } };
  return { usuarioId: 'u', cursor: '', reconciliadoEn: '', tablas } as unknown as Replica;
}

function montar(replica: Replica) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <ProveedorDeReplica replica={replica}>
          <EditorDeLaEncuesta />
        </ProveedorDeReplica>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return {
    guardadas: (): GuardadoDePregunta[] =>
      queryClient
        .getMutationCache()
        .getAll()
        .map((mutacion) => mutacion.state.variables as GuardadoDePregunta),
  };
}

function fila(texto: string): HTMLElement {
  const item = screen
    .getAllByRole('listitem')
    .find((candidato) => within(candidato).queryByText(texto) !== null);
  if (!item) throw new Error(`No está la pregunta «${texto}»`);
  return item;
}

function abrir(texto: string): void {
  fireEvent.click(within(fila(texto)).getByRole('button', { name: 'Editar' }));
}

function escribir(texto: string): void {
  fireEvent.change(screen.getByRole('textbox', { name: 'Qué se pregunta' }), {
    target: { value: texto },
  });
}

beforeEach(() => {
  onlineManager.setOnline(false);
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
});

afterEach(() => {
  onlineManager.setOnline(true);
  vi.unstubAllGlobals();
});

describe('el editor de la encuesta', () => {
  it('muestra cada pregunta con cómo se contesta, si es obligatoria y cuántos la contestaron', () => {
    montar(replicaCon({ preguntas: BASE, ...conRespuestas(BASE, ['conforme']) }));

    const lista = screen.getByRole('list', { name: 'Lo que se pregunta' });
    expect(within(lista).getAllByRole('listitem')).toHaveLength(3);
    const conforme = fila('¿Qué tan conforme quedaste con el mueble?');
    expect(within(conforme).getByText('Escala de cinco')).toBeInTheDocument();
    expect(within(conforme).getByText('Obligatoria')).toBeInTheDocument();
    expect(within(conforme).getByText('1 respuesta')).toBeInTheDocument();
    expect(
      within(fila('¿Qué podríamos hacer mejor?')).getByText('Texto libre'),
    ).toBeInTheDocument();
    expect(screen.getByText('3 de 8')).toBeInTheDocument();
    expect(screen.getByText('1:02')).toBeInTheDocument();
  });

  it('la primera no sube y la última no baja', () => {
    montar(replicaCon({ preguntas: BASE }));

    expect(
      within(fila('¿Qué tan conforme quedaste con el mueble?')).getByRole('button', {
        name: 'Subir',
      }),
    ).toBeDisabled();
    expect(
      within(fila('¿Qué podríamos hacer mejor?')).getByRole('button', { name: 'Bajar' }),
    ).toBeDisabled();
  });

  it('bajar una pregunta le cambia el lugar con la de abajo', () => {
    const { guardadas } = montar(replicaCon({ preguntas: BASE }));

    fireEvent.click(
      within(fila('¿Qué tan conforme quedaste con el mueble?')).getByRole('button', {
        name: 'Bajar',
      }),
    );

    expect(guardadas().map(({ fila: guardada }) => [guardada.id, guardada.orden])).toEqual([
      ['conforme', 20],
      ['recomienda', 10],
    ]);
  });

  it('cambiar el texto de una pregunta que ya contestaron pregunta qué hacer con lo de antes', () => {
    const { guardadas } = montar(
      replicaCon({ preguntas: BASE, ...conRespuestas(BASE, ['conforme']) }),
    );

    abrir('¿Qué tan conforme quedaste con el mueble?');
    escribir('¿Te gustó cómo quedó el mueble?');

    expect(screen.getByText('Esta pregunta ya la contestó 1 persona')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Empezar a contar de cero/ })).toBeChecked();
    expect(
      screen.getByRole('radio', { name: /Es la misma pregunta, solo la redacté mejor/ }),
    ).not.toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: 'Guardar la pregunta' }));

    const [guardada] = guardadas();
    expect(guardada?.fila).toMatchObject({
      serie: 'conforme',
      numero: 2,
      texto: '¿Te gustó cómo quedó el mueble?',
    });
    expect(guardada?.fila.id).not.toBe('conforme');
    expect(guardada?.previa).toBeNull();
  });

  it('si solo la redactó mejor, la guarda en el mismo lugar y las respuestas se siguen sumando', () => {
    const { guardadas } = montar(
      replicaCon({ preguntas: BASE, ...conRespuestas(BASE, ['conforme']) }),
    );

    abrir('¿Qué tan conforme quedaste con el mueble?');
    escribir('¿Qué tan conforme quedaste con tu mueble?');
    fireEvent.click(screen.getByRole('radio', { name: /Es la misma pregunta/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar la pregunta' }));

    expect(guardadas()[0]?.fila).toMatchObject({
      id: 'conforme',
      numero: 1,
      texto: '¿Qué tan conforme quedaste con tu mueble?',
    });
  });

  it('cambiar cómo se contesta una pregunta que ya salió la guarda como versión nueva sin ofrecer la otra salida', () => {
    const { guardadas } = montar(
      replicaCon({ preguntas: BASE, ...conRespuestas(BASE, ['conforme']) }),
    );

    abrir('¿Qué tan conforme quedaste con el mueble?');
    fireEvent.click(screen.getByRole('radio', { name: /Sí \/ tal vez \/ no/ }));

    expect(
      screen.getByText(/esas respuestas no se pueden sumar con las nuevas/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /Es la misma pregunta/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Guardar la pregunta' }));
    expect(guardadas()[0]?.fila).toMatchObject({
      serie: 'conforme',
      numero: 2,
      tipo: 'sitalvezno',
    });
  });

  it('sin texto no guarda y dice qué falta', () => {
    const { guardadas } = montar(replicaCon({ preguntas: BASE }));

    abrir('¿Qué podríamos hacer mejor?');
    escribir('   ');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar la pregunta' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Escribí la pregunta.');
    expect(screen.getByRole('textbox', { name: 'Qué se pregunta' })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(guardadas()).toEqual([]);
  });

  it('una pregunta de opciones pide al menos dos, sin vacías ni repetidas', () => {
    const { guardadas } = montar(replicaCon({ preguntas: BASE }));

    abrir('¿Qué podríamos hacer mejor?');
    fireEvent.click(screen.getByRole('radio', { name: /Una sola opción/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Opción 1' }), {
      target: { value: 'Por el precio' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar la pregunta' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Hay una opción vacía: escribila o sacala.',
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'Opción 2' }), {
      target: { value: 'Por el precio' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar la pregunta' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Hay dos opciones iguales.');

    fireEvent.change(screen.getByRole('textbox', { name: 'Opción 2' }), {
      target: { value: 'Por una recomendación' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar la pregunta' }));
    expect(guardadas()[0]?.fila).toMatchObject({
      id: 'mejor',
      tipo: 'una',
      opciones: ['Por el precio', 'Por una recomendación'],
    });
  });

  it('agregar una pregunta la suma al final, sin respuestas y como primera versión', () => {
    const { guardadas } = montar(replicaCon({ preguntas: BASE }));

    fireEvent.click(screen.getByRole('button', { name: 'Agregar una pregunta' }));
    expect(screen.getByRole('textbox', { name: 'Qué se pregunta' })).toHaveFocus();
    escribir('¿Cómo nos conociste?');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar la pregunta' }));

    const [guardada] = guardadas();
    expect(guardada?.fila).toMatchObject({
      numero: 1,
      orden: 40,
      proyecto_id: null,
      tipo: 'escala5',
      escala: 'conformidad',
      texto: '¿Cómo nos conociste?',
    });
    expect(guardada?.fila.serie).toBe(guardada?.fila.id);
  });

  it('con ocho preguntas no deja agregar otra y explica por qué', () => {
    const ocho = Array.from({ length: 8 }, (_, indice) =>
      pregunta(`q${String(indice)}`, { orden: (indice + 1) * 10 }),
    );
    montar(replicaCon({ preguntas: ocho }));

    expect(screen.getByRole('button', { name: 'Agregar una pregunta' })).toBeDisabled();
    expect(screen.getByText(/Llegaste a 8 preguntas/)).toBeInTheDocument();
  });

  it('dejar de preguntar una que ya salió la archiva, y una que nadie vio se borra', () => {
    const preguntas = [...BASE, pregunta('nueva', { orden: 40, texto: '¿Cómo nos conociste?' })];
    const { guardadas } = montar(replicaCon({ preguntas, ...conRespuestas(BASE, ['conforme']) }));

    fireEvent.click(
      within(fila('¿Qué podríamos hacer mejor?')).getByRole('button', {
        name: 'Dejar de preguntarla',
      }),
    );
    fireEvent.click(
      within(fila('¿Cómo nos conociste?')).getByRole('button', { name: 'Dejar de preguntarla' }),
    );

    const [archivada, borrada] = guardadas();
    expect(archivada?.fila).toMatchObject({ id: 'mejor', deleted_at: null });
    expect(archivada?.fila.archivada_at).not.toBeNull();
    expect(borrada?.fila).toMatchObject({ id: 'nueva', archivada_at: null });
    expect(borrada?.fila.deleted_at).not.toBeNull();
  });

  it('las archivadas quedan abajo con lo que contestaron, y se pueden volver a preguntar', () => {
    const preguntas = [
      ...BASE,
      pregunta('vieja', {
        orden: 40,
        tipo: 'una',
        escala: null,
        opciones: ['Sí', 'No'],
        cantidad_de_opciones: 2,
        texto: '¿Te cobramos el flete aparte?',
        archivada_at: '2026-06-01T12:00:00Z',
      }),
    ];
    const { guardadas } = montar(replicaCon({ preguntas, ...conRespuestas(preguntas, ['vieja']) }));

    const seccion = screen.getByRole('region', { name: 'Las que ya no preguntás' });
    expect(within(seccion).getByText('¿Te cobramos el flete aparte?')).toBeInTheDocument();
    expect(
      within(seccion).getByText(/Una sola opción · 1 respuesta · dejaste de preguntarla/),
    ).toBeInTheDocument();
    expect(within(seccion).getByRole('link', { name: 'Ver respuestas' })).toHaveAttribute(
      'href',
      '/opiniones#pregunta-vieja',
    );

    fireEvent.click(within(seccion).getByRole('button', { name: 'Volver a preguntarla' }));
    expect(guardadas()[0]?.fila).toMatchObject({ id: 'vieja', archivada_at: null });
  });

  it('la vista previa muestra la encuesta como la ve el cliente y no guarda nada', async () => {
    const { guardadas } = montar(replicaCon({ preguntas: BASE }));

    fireEvent.click(screen.getByRole('button', { name: 'Verla como la ve el cliente' }));
    const previa = screen.getByRole('dialog', { name: 'Así la ve tu cliente' });
    expect(within(previa).getByText('No se guarda nada de lo que toques acá')).toBeInTheDocument();
    expect(
      within(previa).getByRole('heading', { name: '¿Cómo te fue con tu mueble?' }),
    ).toBeInTheDocument();

    fireEvent.click(within(previa).getByRole('radio', { name: 'Muy conforme' }));
    fireEvent.click(within(previa).getByRole('radio', { name: 'Sí, sin dudarlo' }));
    fireEvent.click(within(previa).getByRole('button', { name: 'Mandar mi opinión' }));

    expect(await screen.findByRole('heading', { name: 'Gracias' })).toBeInTheDocument();
    expect(guardadas()).toEqual([]);
  });
});
