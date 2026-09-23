import { describe, expect, it } from 'vitest';

import type { ProximoContacto, Proyecto } from '@/entities/proyecto';

import {
  errorDeLaNota,
  errorDelDiaQueLeEscribiste,
  errorDelProximoContacto,
  guardadoDelRegistro,
  guardadoParaPonerEnSeguimiento,
} from './seguimiento';

const HOY = '2026-09-23';

function proyecto(extra: Partial<Proyecto> = {}): Proyecto {
  return {
    id: 'p',
    version: 4,
    cliente_id: 'c',
    titulo: 'Placard',
    descripcion: '',
    estado: 'presupuesto_enviado',
    presupuesto_centavos: 90_000_000,
    sena_bp: null,
    forma_pago: null,
    comprobante: 'sin_comprobante',
    fecha_visita: null,
    visita_hora: null,
    visita_hecha: false,
    ultimo_contacto: '2026-09-01',
    fecha_inicio: null,
    entrega_estimada: null,
    entrega_hora: null,
    fecha_entrega: null,
    direccion_entrega: '',
    notas: '',
    vencimiento_presupuesto: null,
    ...extra,
  } as Proyecto;
}

const PENDIENTE = {
  id: 'pendiente',
  proyecto_id: 'p',
  fecha: '2026-09-20',
  nota: 'Después de las vacaciones',
  etapa_previa: 'relevamiento',
  hecho_el: null,
  resultado: null,
  respuesta: '',
  importante: true,
} as ProximoContacto;

describe('pasar a seguimiento', () => {
  it('cambia el estado y deja el pendiente con el día, la nota y la etapa en que estaba', () => {
    const { pedido, previos } = guardadoParaPonerEnSeguimiento(
      proyecto(),
      { fecha: '2026-10-23', nota: '  Después de las vacaciones  ' },
      HOY,
      'nuevo',
    );
    expect(pedido.datos).toMatchObject({ estado: 'en_seguimiento', ultimo_contacto: HOY });
    expect(pedido.proximos).toEqual([
      {
        id: 'nuevo',
        fecha: '2026-10-23',
        nota: 'Después de las vacaciones',
        etapa_previa: 'presupuesto_enviado',
        hecho_el: null,
        resultado: null,
        respuesta: '',
      },
    ]);
    expect(previos.proximos).toEqual([]);
  });

  it('el día es obligatorio y no puede haber pasado; hoy sí vale', () => {
    expect(errorDelProximoContacto('', HOY)).toBe('Elegí el día en que le volvés a escribir.');
    expect(errorDelProximoContacto('2026-09-22', HOY)).toBe(
      'Ese día ya pasó: elegí hoy o más adelante.',
    );
    expect(errorDelProximoContacto(HOY, HOY)).toBeUndefined();
  });

  it('la nota es opcional pero no infinita', () => {
    expect(errorDeLaNota('')).toBeUndefined();
    expect(errorDeLaNota('x'.repeat(501))).toBe('No puede pasar de 500 caracteres.');
  });
});

describe('registrar el contacto', () => {
  const enSeguimiento = proyecto({ estado: 'en_seguimiento' });

  it('si vuelve, pasa a la etapa elegida y el pendiente queda registrado como reactivado', () => {
    const { pedido, previos } = guardadoDelRegistro(
      enSeguimiento,
      PENDIENTE,
      {
        dia: '2026-09-22',
        respuesta: ' Quiere el más barato ',
        salida: { que: 'vuelve', etapa: 'a_presupuestar' },
      },
      HOY,
      'siguiente',
    );
    expect(pedido.datos).toMatchObject({ estado: 'a_presupuestar', ultimo_contacto: '2026-09-22' });
    expect(pedido.proximos).toEqual([
      {
        id: 'pendiente',
        fecha: '2026-09-20',
        nota: 'Después de las vacaciones',
        etapa_previa: 'relevamiento',
        hecho_el: '2026-09-22',
        resultado: 'reactivado',
        respuesta: 'Quiere el más barato',
      },
    ]);
    expect(previos.proximos).toEqual([PENDIENTE]);
  });

  it('con otra fecha sigue en seguimiento: cierra el pendiente y abre el siguiente, con la misma etapa previa', () => {
    const { pedido } = guardadoDelRegistro(
      enSeguimiento,
      PENDIENTE,
      {
        dia: HOY,
        respuesta: 'Que le escriba en noviembre',
        salida: { que: 'otra_fecha', siguiente: { fecha: '2026-11-15', nota: 'Noviembre' } },
      },
      HOY,
      'siguiente',
    );
    expect(pedido.datos).toMatchObject({ estado: 'en_seguimiento', ultimo_contacto: HOY });
    expect(pedido.proximos).toEqual([
      expect.objectContaining({ id: 'pendiente', hecho_el: HOY, resultado: 'otra_fecha' }),
      {
        id: 'siguiente',
        fecha: '2026-11-15',
        nota: 'Noviembre',
        etapa_previa: 'relevamiento',
        hecho_el: null,
        resultado: null,
        respuesta: '',
      },
    ]);
  });

  it('si no va, guarda lo que contestó sin cerrar el pendiente: lo cierra el cierre como perdido', () => {
    const { pedido } = guardadoDelRegistro(
      enSeguimiento,
      PENDIENTE,
      { dia: HOY, respuesta: 'Se compró uno hecho', salida: { que: 'no_va' } },
      HOY,
      'siguiente',
    );
    expect(pedido.datos.estado).toBe('en_seguimiento');
    expect(pedido.proximos).toEqual([
      expect.objectContaining({
        id: 'pendiente',
        hecho_el: null,
        respuesta: 'Se compró uno hecho',
      }),
    ]);
  });

  it('el día en que le escribiste es hoy o antes', () => {
    expect(errorDelDiaQueLeEscribiste(HOY, HOY)).toBeUndefined();
    expect(errorDelDiaQueLeEscribiste('2026-09-24', HOY)).toBe(
      'Ese día todavía no llegó: tiene que ser hoy o antes.',
    );
    expect(errorDelDiaQueLeEscribiste('', HOY)).toBe('Poné el día en que le escribiste.');
  });
});
