import { describe, expect, it } from 'vitest';

import {
  AVISO_DE_LA_CATEGORIA,
  CATEGORIAS_DE_AGENDA,
  eventosDeLaAgenda,
  eventosParaAvisar,
  PREFERENCIAS_INICIALES,
  type AnotacionDeLaAgenda,
  type DatosDeLaAgenda,
  type EventoDeLaAgenda,
  type PreferenciasDeAvisos,
  type ProyectoDeLaAgenda,
} from './agenda.ts';
import { ESTADOS, ESTADOS_DE_SEGUIMIENTO } from './estados.ts';

const SEPTIEMBRE = { desde: '2026-09-01', hasta: '2026-09-30' };

const SIN_MARCAS = { presupuesto: false, visita: false, entrega: false };

function proyecto(cambios: Partial<ProyectoDeLaAgenda> = {}): ProyectoDeLaAgenda {
  return {
    id: 'p1',
    clienteId: 'c1',
    titulo: 'Cocina en L',
    estado: 'en_curso',
    fechaVisita: null,
    visitaHecha: false,
    entregaEstimada: null,
    vencimientoPresupuesto: null,
    direccionEntrega: '',
    importante: SIN_MARCAS,
    ...cambios,
  };
}

function anotacion(cambios: Partial<AnotacionDeLaAgenda> = {}): AnotacionDeLaAgenda {
  return {
    id: 'a1',
    fecha: '2026-09-10',
    hora: null,
    texto: 'Comprar melamina',
    categoria: 'materiales',
    proyectoId: null,
    hecha: false,
    importante: false,
    ...cambios,
  };
}

function datos(cambios: Partial<DatosDeLaAgenda> = {}): DatosDeLaAgenda {
  return {
    proyectos: [],
    clientes: [
      { id: 'c1', nombre: 'Victor', zona: 'Morón' },
      { id: 'c2', nombre: 'UTN', zona: 'Haedo' },
    ],
    anotaciones: [],
    ...cambios,
  };
}

function dias(eventos: readonly EventoDeLaAgenda[]): string[] {
  return eventos.map((evento) => `${evento.fecha} ${evento.id}`);
}

function hechas(eventos: readonly EventoDeLaAgenda[]): [string, boolean][] {
  return eventos.map((evento) => [evento.id, evento.hecha]);
}

describe('eventosDeLaAgenda', () => {
  it('pone la entrega estimada de un proyecto en curso en su día', () => {
    const eventos = eventosDeLaAgenda(
      datos({
        proyectos: [
          proyecto({ entregaEstimada: '2026-09-16', direccionEntrega: 'Rivadavia 1200' }),
        ],
      }),
      SEPTIEMBRE,
    );

    expect(eventos).toEqual([
      {
        clase: 'derivada',
        id: 'entrega:p1',
        categoria: 'entrega',
        fecha: '2026-09-16',
        proyectoId: 'p1',
        clienteId: 'c1',
        titulo: 'Cocina en L',
        cliente: 'Victor',
        lugar: 'Rivadavia 1200',
        hecha: false,
        importante: false,
      },
    ]);
  });

  it('pone la visita de un contacto en su día, con la zona del cliente', () => {
    const eventos = eventosDeLaAgenda(
      datos({
        proyectos: [
          proyecto({
            id: 'p2',
            clienteId: 'c2',
            titulo: 'Relevamiento UTN',
            estado: 'relevamiento',
            fechaVisita: '2026-09-11',
          }),
        ],
      }),
      SEPTIEMBRE,
    );

    expect(eventos).toEqual([
      {
        clase: 'derivada',
        id: 'visita:p2',
        categoria: 'visita',
        fecha: '2026-09-11',
        proyectoId: 'p2',
        clienteId: 'c2',
        titulo: 'Relevamiento UTN',
        cliente: 'UTN',
        lugar: 'Haedo',
        hecha: false,
        importante: false,
      },
    ]);
  });

  it('pone el vencimiento del presupuesto de un contacto a presupuestar en su día', () => {
    const eventos = eventosDeLaAgenda(
      datos({
        proyectos: [
          proyecto({
            estado: 'a_presupuestar',
            fechaVisita: '2026-09-07',
            vencimientoPresupuesto: '2026-09-10',
          }),
        ],
      }),
      SEPTIEMBRE,
    );

    expect(dias(eventos)).toEqual(['2026-09-07 visita:p1', '2026-09-10 presupuesto:p1']);
    expect(eventos[1]).toMatchObject({ categoria: 'presupuesto', lugar: 'Morón', hecha: false });
  });

  it('cambiar la fecha en el proyecto mueve el evento, y nada más cambia', () => {
    const otro = proyecto({ id: 'p9', estado: 'relevamiento', fechaVisita: '2026-09-14' });
    const nota = anotacion({ id: 'a9', fecha: '2026-09-16', proyectoId: 'p1' });
    const antes = datos({
      proyectos: [proyecto({ entregaEstimada: '2026-09-16' }), otro],
      anotaciones: [nota],
    });
    const despues = datos({
      proyectos: [proyecto({ entregaEstimada: '2026-09-23' }), otro],
      anotaciones: [nota],
    });

    const eventosAntes = eventosDeLaAgenda(antes, SEPTIEMBRE);
    const eventosDespues = eventosDeLaAgenda(despues, SEPTIEMBRE);

    expect(dias(eventosAntes)).toEqual([
      '2026-09-14 visita:p9',
      '2026-09-16 entrega:p1',
      '2026-09-16 a9',
    ]);
    expect(dias(eventosDespues)).toEqual([
      '2026-09-14 visita:p9',
      '2026-09-16 a9',
      '2026-09-23 entrega:p1',
    ]);
    const sinLaEntrega = (eventos: EventoDeLaAgenda[]) =>
      eventos.filter((evento) => evento.id !== 'entrega:p1');
    expect(sinLaEntrega(eventosDespues)).toEqual(sinLaEntrega(eventosAntes));
  });

  it('la entrega sale pendiente con la obra en curso, hecha con la obra entregada o cobrada, y de ningún otro estado', () => {
    const conFecha = ESTADOS.map((estado) =>
      proyecto({ id: estado, estado, entregaEstimada: '2026-09-16' }),
    );
    const eventos = eventosDeLaAgenda(
      datos({ proyectos: [...conFecha, proyecto({ id: 'sin', entregaEstimada: null })] }),
      SEPTIEMBRE,
    );

    expect(hechas(eventos)).toEqual([
      ['entrega:cobrado', true],
      ['entrega:en_curso', false],
      ['entrega:entregado', true],
    ]);
  });

  it('entregar deja la entrega hecha en el mismo día, y volver al taller la devuelve a pendiente', () => {
    const agenda = (estado: ProyectoDeLaAgenda['estado']) =>
      eventosDeLaAgenda(
        datos({ proyectos: [proyecto({ estado, entregaEstimada: '2026-09-16' })] }),
        SEPTIEMBRE,
      );

    expect(agenda('en_curso')).toMatchObject([{ fecha: '2026-09-16', hecha: false }]);
    expect(agenda('entregado')).toMatchObject([{ fecha: '2026-09-16', hecha: true }]);
    expect(agenda('cobrado')).toMatchObject([{ fecha: '2026-09-16', hecha: true }]);
    expect(agenda('en_curso')).toMatchObject([{ fecha: '2026-09-16', hecha: false }]);
  });

  it('una entrega perdida o vuelta a presupuesto no sale: no se hizo', () => {
    for (const estado of ['perdido', 'presupuesto_enviado'] as const) {
      expect(
        eventosDeLaAgenda(
          datos({ proyectos: [proyecto({ estado, entregaEstimada: '2026-09-16' })] }),
          SEPTIEMBRE,
        ),
      ).toEqual([]);
    }
  });

  it('la visita sin hacer sale mientras el trabajo está en seguimiento', () => {
    const conVisita = ESTADOS.map((estado) =>
      proyecto({ id: estado, estado, fechaVisita: '2026-09-11' }),
    );
    const eventos = eventosDeLaAgenda(datos({ proyectos: conVisita }), SEPTIEMBRE);

    expect(eventos.map((evento) => evento.id).sort()).toEqual([
      'visita:a_presupuestar',
      'visita:contacto',
      'visita:presupuesto_enviado',
      'visita:presupuesto_estimativo',
      'visita:relevamiento',
    ]);
    expect(eventos.every((evento) => !evento.hecha)).toBe(true);
  });

  it('la visita hecha se queda tachada en su día en cualquier estado: ir y volver de etapa, aprobar o perder no la des-completan', () => {
    const hecha = ESTADOS.map((estado) =>
      proyecto({ id: estado, estado, fechaVisita: '2026-09-11', visitaHecha: true }),
    );
    const eventos = eventosDeLaAgenda(datos({ proyectos: hecha }), SEPTIEMBRE);

    expect(eventos).toHaveLength(ESTADOS.length);
    expect(eventos.every((evento) => evento.hecha && evento.fecha === '2026-09-11')).toBe(true);

    for (const etapa of ESTADOS_DE_SEGUIMIENTO) {
      const [visita] = eventosDeLaAgenda(
        datos({
          proyectos: [proyecto({ estado: etapa, fechaVisita: '2026-09-11', visitaHecha: true })],
        }),
        SEPTIEMBRE,
      );
      expect(visita, etapa).toMatchObject({ categoria: 'visita', hecha: true });
    }
  });

  it('una visita hecha sin fecha no tiene día donde ir', () => {
    expect(
      eventosDeLaAgenda(
        datos({ proyectos: [proyecto({ estado: 'en_curso', visitaHecha: true })] }),
        SEPTIEMBRE,
      ),
    ).toEqual([]);
  });

  it('el vencimiento sale mientras el presupuesto no se mandó, y deja de salir al mandarlo o al mandar un estimativo', () => {
    const conVencimiento = ESTADOS.map((estado) =>
      proyecto({ id: estado, estado, vencimientoPresupuesto: '2026-09-10' }),
    );
    const eventos = eventosDeLaAgenda(datos({ proyectos: conVencimiento }), SEPTIEMBRE);

    expect(eventos.map((evento) => evento.id).sort()).toEqual([
      'presupuesto:a_presupuestar',
      'presupuesto:contacto',
      'presupuesto:relevamiento',
    ]);
  });

  it('cada evento que sale de un trabajo lleva su propia marca de importante', () => {
    const eventos = eventosDeLaAgenda(
      datos({
        proyectos: [
          proyecto({
            id: 'contacto',
            estado: 'a_presupuestar',
            fechaVisita: '2026-09-07',
            vencimientoPresupuesto: '2026-09-10',
            importante: { ...SIN_MARCAS, visita: true },
          }),
          proyecto({
            id: 'obra',
            estado: 'entregado',
            entregaEstimada: '2026-09-16',
            importante: { presupuesto: true, visita: true, entrega: true },
          }),
          proyecto({
            id: 'otro',
            estado: 'relevamiento',
            vencimientoPresupuesto: '2026-09-12',
            importante: { ...SIN_MARCAS, presupuesto: true },
          }),
        ],
      }),
      SEPTIEMBRE,
    );

    expect(eventos.map((evento) => [evento.id, evento.importante])).toEqual([
      ['visita:contacto', true],
      ['presupuesto:contacto', false],
      ['presupuesto:otro', true],
      ['entrega:obra', true],
    ]);
  });

  it('una entrega sin dirección se ubica por la zona del cliente', () => {
    const [evento] = eventosDeLaAgenda(
      datos({ proyectos: [proyecto({ entregaEstimada: '2026-09-16', direccionEntrega: '  ' })] }),
      SEPTIEMBRE,
    );

    expect(evento).toMatchObject({ lugar: 'Morón' });
  });

  it('un proyecto sin su cliente en la réplica sale igual, sin nombre ni lugar', () => {
    const [entrega, visita] = eventosDeLaAgenda(
      datos({
        proyectos: [
          proyecto({ clienteId: 'borrado', entregaEstimada: '2026-09-16' }),
          proyecto({
            id: 'p2',
            clienteId: 'borrado',
            estado: 'contacto',
            fechaVisita: '2026-09-17',
          }),
        ],
      }),
      SEPTIEMBRE,
    );

    expect(entrega).toMatchObject({ cliente: '', lugar: '' });
    expect(visita).toMatchObject({ cliente: '', lugar: '' });
  });

  it('las anotaciones salen con el título de su proyecto, o sin proyecto si no lo tienen o ya no está', () => {
    const eventos = eventosDeLaAgenda(
      datos({
        proyectos: [proyecto()],
        anotaciones: [
          anotacion({ id: 'a1', texto: 'Pintar la cajonera', proyectoId: 'p1', importante: true }),
          anotacion({ id: 'a2', texto: 'Pagar el alquiler', categoria: 'taller' }),
          anotacion({
            id: 'a3',
            texto: 'Retirar el pulpo',
            categoria: 'taller',
            proyectoId: 'viejo',
          }),
        ],
      }),
      SEPTIEMBRE,
    );

    expect(eventos).toEqual([
      {
        clase: 'propia',
        id: 'a1',
        categoria: 'materiales',
        fecha: '2026-09-10',
        hora: null,
        texto: 'Pintar la cajonera',
        proyectoId: 'p1',
        proyecto: 'Cocina en L',
        hecha: false,
        importante: true,
      },
      expect.objectContaining({ id: 'a2', proyectoId: null, proyecto: null }),
      expect.objectContaining({ id: 'a3', proyectoId: 'viejo', proyecto: null }),
    ]);
  });

  it('el rango es inclusivo en los dos bordes y deja afuera lo demás', () => {
    const eventos = eventosDeLaAgenda(
      datos({
        proyectos: [
          proyecto({ id: 'antes', entregaEstimada: '2026-08-31' }),
          proyecto({ id: 'primero', entregaEstimada: '2026-09-01' }),
          proyecto({ id: 'ultimo', entregaEstimada: '2026-09-30' }),
          proyecto({ id: 'despues', entregaEstimada: '2026-10-01' }),
        ],
        anotaciones: [
          anotacion({ id: 'nota-antes', fecha: '2026-08-31' }),
          anotacion({ id: 'nota-adentro', fecha: '2026-09-30' }),
        ],
      }),
      SEPTIEMBRE,
    );

    expect(dias(eventos)).toEqual([
      '2026-09-01 entrega:primero',
      '2026-09-30 entrega:ultimo',
      '2026-09-30 nota-adentro',
    ]);
  });

  it('un rango de un solo día trae ese día', () => {
    const eventos = eventosDeLaAgenda(
      datos({ anotaciones: [anotacion(), anotacion({ id: 'a2', fecha: '2026-09-11' })] }),
      { desde: '2026-09-10', hasta: '2026-09-10' },
    );

    expect(eventos.map((evento) => evento.id)).toEqual(['a1']);
  });

  it('rechaza un rango al revés o con una fecha que no existe', () => {
    expect(() => eventosDeLaAgenda(datos(), { desde: '2026-09-30', hasta: '2026-09-01' })).toThrow(
      RangeError,
    );
    expect(() => eventosDeLaAgenda(datos(), { desde: '2026-02-30', hasta: '2026-03-01' })).toThrow(
      RangeError,
    );
  });

  it('lo que tiene hora va antes que lo que no, venga en el orden que venga de la réplica', () => {
    const conHora = anotacion({ id: 'con', hora: '15:00:00', texto: 'Zócalo' });
    const sinHora = anotacion({ id: 'sin', texto: 'Aserrín' });

    for (const anotaciones of [
      [conHora, sinHora],
      [sinHora, conHora],
    ]) {
      expect(eventosDeLaAgenda(datos({ anotaciones }), SEPTIEMBRE).map((e) => e.id)).toEqual([
        'con',
        'sin',
      ]);
    }
  });

  it('dentro del día: con hora primero y en orden, después por categoría, por texto y por id', () => {
    const eventos = eventosDeLaAgenda(
      datos({
        proyectos: [
          proyecto({ id: 'p1', entregaEstimada: '2026-09-16' }),
          proyecto({
            id: 'p2',
            titulo: 'Vestidor',
            estado: 'relevamiento',
            fechaVisita: '2026-09-16',
            vencimientoPresupuesto: '2026-09-16',
          }),
        ],
        anotaciones: [
          anotacion({
            id: 'z',
            fecha: '2026-09-16',
            texto: 'Emitir la factura',
            categoria: 'taller',
          }),
          anotacion({
            id: 'y',
            fecha: '2026-09-16',
            texto: 'Cargar la camioneta',
            hora: '07:30:00',
            categoria: 'taller',
          }),
          anotacion({ id: 'x', fecha: '2026-09-16', texto: 'Llevar tornillos' }),
          anotacion({
            id: 'w',
            fecha: '2026-09-16',
            texto: 'Coordinar el corte',
            hora: '06:00:00',
            categoria: 'taller',
          }),
          anotacion({
            id: 'b',
            fecha: '2026-09-16',
            texto: 'Emitir la factura',
            categoria: 'taller',
          }),
          anotacion({
            id: 'v',
            fecha: '2026-09-16',
            texto: 'Atender a Villalba',
            hora: '07:30:00',
          }),
          anotacion({ id: 'u', fecha: '2026-09-15', texto: 'Día anterior' }),
        ],
      }),
      SEPTIEMBRE,
    );

    expect(eventos.map((evento) => evento.id)).toEqual([
      'u',
      'w',
      'v',
      'y',
      'presupuesto:p2',
      'visita:p2',
      'entrega:p1',
      'x',
      'b',
      'z',
    ]);
  });
});

describe('eventosParaAvisar', () => {
  const agenda = datos({
    proyectos: [
      proyecto({ id: 'hoy', entregaEstimada: '2026-09-14' }),
      proyecto({ id: 'pasado', entregaEstimada: '2026-09-16' }),
      proyecto({ id: 'tres', entregaEstimada: '2026-09-17' }),
      proyecto({ id: 'atrasada', entregaEstimada: '2026-09-13' }),
      proyecto({
        id: 'visita',
        estado: 'relevamiento',
        fechaVisita: '2026-09-15',
        vencimientoPresupuesto: '2026-09-16',
      }),
    ],
    anotaciones: [
      anotacion({ id: 'nota', fecha: '2026-09-14' }),
      anotacion({ id: 'hecha', fecha: '2026-09-14', hecha: true }),
      anotacion({ id: 'manana', fecha: '2026-09-15' }),
    ],
  });

  it('con las preferencias iniciales avisa entregas, visitas y presupuestos dentro de su anticipación', () => {
    const avisos = eventosParaAvisar(agenda, '2026-09-14', PREFERENCIAS_INICIALES);

    expect(dias(avisos)).toEqual([
      '2026-09-14 entrega:hoy',
      '2026-09-15 visita:visita',
      '2026-09-16 entrega:pasado',
    ]);
  });

  it('la anticipación es una ventana: lo avisa desde tantos días antes hasta el mismo día', () => {
    const soloEntregas: PreferenciasDeAvisos = {
      ...PREFERENCIAS_INICIALES,
      visitas: { activo: false, anticipacion: 1 },
      presupuestos: { activo: false, anticipacion: 1 },
      entregas: { activo: true, anticipacion: 2 },
    };

    const porDia = ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17'].map((hoy) =>
      eventosParaAvisar(agenda, hoy, soloEntregas)
        .filter((evento) => evento.id === 'entrega:pasado')
        .map(() => hoy),
    );

    expect(porDia.flat()).toEqual(['2026-09-14', '2026-09-15', '2026-09-16']);
  });

  it('no avisa lo que ya pasó ni lo que está fuera de la ventana', () => {
    const avisos = eventosParaAvisar(agenda, '2026-09-14', PREFERENCIAS_INICIALES);

    expect(avisos.map((evento) => evento.id)).not.toContain('entrega:atrasada');
    expect(avisos.map((evento) => evento.id)).not.toContain('entrega:tres');
  });

  it('las anotaciones se avisan solo si están activas, y nunca las tildadas', () => {
    const conAnotaciones: PreferenciasDeAvisos = {
      ...PREFERENCIAS_INICIALES,
      anotaciones: { activo: true, anticipacion: 1 },
    };

    const avisos = eventosParaAvisar(agenda, '2026-09-14', conAnotaciones);

    expect(avisos.map((evento) => evento.id)).toContain('nota');
    expect(avisos.map((evento) => evento.id)).toContain('manana');
    expect(avisos.map((evento) => evento.id)).not.toContain('hecha');
  });

  it('no avisa lo que sale de un trabajo y ya está hecho: la visita relevada ni la entrega entregada', () => {
    const conLoHecho = datos({
      proyectos: [
        proyecto({
          id: 'relevada',
          estado: 'a_presupuestar',
          fechaVisita: '2026-09-14',
          visitaHecha: true,
        }),
        proyecto({ id: 'entregada', estado: 'entregado', entregaEstimada: '2026-09-15' }),
        proyecto({ id: 'por-entregar', entregaEstimada: '2026-09-15' }),
      ],
    });

    const avisos = eventosParaAvisar(conLoHecho, '2026-09-14', PREFERENCIAS_INICIALES);

    expect(dias(avisos)).toEqual(['2026-09-15 entrega:por-entregar']);
    expect(
      eventosDeLaAgenda(conLoHecho, { desde: '2026-09-14', hasta: '2026-09-15' }).filter(
        (evento) => evento.hecha,
      ),
    ).toHaveLength(2);
  });

  it('con todo apagado no hay nada que avisar', () => {
    const apagado: PreferenciasDeAvisos = {
      entregas: { activo: false, anticipacion: 3 },
      visitas: { activo: false, anticipacion: 3 },
      presupuestos: { activo: false, anticipacion: 3 },
      anotaciones: { activo: false, anticipacion: 3 },
    };

    expect(eventosParaAvisar(agenda, '2026-09-14', apagado)).toEqual([]);
  });

  it('lo que avisa es exactamente lo que muestra la agenda para esos días, sin lo hecho: la misma función', () => {
    const todo: PreferenciasDeAvisos = {
      entregas: { activo: true, anticipacion: 3 },
      visitas: { activo: true, anticipacion: 3 },
      presupuestos: { activo: true, anticipacion: 3 },
      anotaciones: { activo: true, anticipacion: 3 },
    };

    const avisos = eventosParaAvisar(agenda, '2026-09-14', todo);
    const enLaAgenda = eventosDeLaAgenda(agenda, { desde: '2026-09-14', hasta: '2026-09-17' });

    expect(avisos).toEqual(enLaAgenda.filter((evento) => !evento.hecha));
  });

  it('cada categoría de la agenda tiene su aviso, y las preferencias iniciales son las del diseño', () => {
    expect(CATEGORIAS_DE_AGENDA.map((categoria) => AVISO_DE_LA_CATEGORIA[categoria])).toEqual([
      'presupuestos',
      'visitas',
      'entregas',
      'anotaciones',
      'anotaciones',
    ]);
    expect(PREFERENCIAS_INICIALES).toEqual({
      entregas: { activo: true, anticipacion: 2 },
      visitas: { activo: true, anticipacion: 1 },
      presupuestos: { activo: true, anticipacion: 1 },
      anotaciones: { activo: false, anticipacion: 0 },
    });
  });
});
