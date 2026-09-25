import { describe, expect, it, vi } from 'vitest';

import type { ClienteMaun } from './cliente.ts';
import { RespuestaInvalidaError } from './replica.ts';
import {
  COLUMNAS_DE_LA_ENTREGA,
  COLUMNAS_DE_PROYECTO,
  guardarProyecto,
  leerProyectoGuardado,
  proponerLaEntrega,
  type ProyectoParaGuardar,
} from './sincronizacion.ts';

const DATOS = {
  cliente_id: 'c',
  titulo: 'Placard',
  descripcion: '',
  estado: 'en_seguimiento',
  presupuesto_centavos: 90_000_000,
  sena_bp: null,
  forma_pago: null,
  comprobante: 'sin_comprobante',
  fecha_visita: null,
  visita_hora: null,
  ultimo_contacto: '2026-09-23',
  fecha_inicio: null,
  entrega_estimada: null,
  entrega_hora: null,
  fecha_entrega: null,
  direccion_entrega: '',
  notas: '',
  vencimiento_presupuesto: null,
  visita_hecha: false,
  presupuesto_vale_hasta: null,
  tipo_de_proyecto: null,
} satisfies ProyectoParaGuardar['datos'];

const GUARDADO = {
  proyecto: { id: 'p' },
  pagos: [],
  gastos: [],
  opciones_de_presupuesto: [],
  necesidades: [],
  proximos_contactos: [{ id: 'contacto', fecha: '2026-10-23' }],
};

function clienteFalso(data: unknown) {
  const rpc = vi.fn(() => Promise.resolve({ data, error: null }));
  return { cliente: { rpc } as unknown as ClienteMaun, rpc };
}

describe('el próximo contacto en el agregado del trabajo', () => {
  it('viaja en p_proximos junto con el estado, y sin la clave va en null para no tocarlo', async () => {
    const { cliente, rpc } = clienteFalso(GUARDADO);
    const proximos = [
      {
        id: 'contacto',
        fecha: '2026-10-23',
        nota: 'Después de las vacaciones',
        etapa_previa: 'presupuesto_enviado',
        hecho_el: null,
        resultado: null,
        respuesta: '',
      },
    ] as const;

    await guardarProyecto(cliente, {
      id: 'p',
      version: 3,
      datos: DATOS,
      pagos: [],
      gastos: [],
      proximos,
    });
    expect(rpc).toHaveBeenLastCalledWith(
      'guardar_proyecto',
      expect.objectContaining({ p_proximos: proximos }),
    );

    await guardarProyecto(cliente, { id: 'p', version: 3, datos: DATOS, pagos: [], gastos: [] });
    expect(rpc).toHaveBeenLastCalledWith(
      'guardar_proyecto',
      expect.objectContaining({ p_proximos: null }),
    );
  });

  it('vuelve con las filas del seguimiento, y sin la lista la respuesta no sirve', () => {
    expect(leerProyectoGuardado(GUARDADO).proximos).toEqual([
      { id: 'contacto', fecha: '2026-10-23' },
    ]);
    expect(() => leerProyectoGuardado({ ...GUARDADO, proximos_contactos: undefined })).toThrow(
      RespuestaInvalidaError,
    );
  });
});

describe('hasta cuándo vale el presupuesto', () => {
  it('viaja con los datos del trabajo, que es de donde guardar_proyecto la lee', async () => {
    const { cliente, rpc } = clienteFalso(GUARDADO);

    await guardarProyecto(cliente, {
      id: 'p',
      version: 3,
      datos: { ...DATOS, estado: 'presupuesto_enviado', presupuesto_vale_hasta: '2026-10-09' },
      pagos: [],
      gastos: [],
    });

    expect(rpc).toHaveBeenLastCalledWith(
      'guardar_proyecto',
      expect.objectContaining({
        p_proyecto: expect.objectContaining({ presupuesto_vale_hasta: '2026-10-09' }) as unknown,
      }),
    );
  });
});

describe('la entrega del trabajo', () => {
  it('el tipo de proyecto viaja con los datos, y listo y la comprometida no', async () => {
    const { cliente, rpc } = clienteFalso(GUARDADO);

    await guardarProyecto(cliente, {
      id: 'p',
      version: 3,
      datos: { ...DATOS, tipo_de_proyecto: 'Placard' },
      pagos: [],
      gastos: [],
    });

    const [, argumentos] = rpc.mock.lastCall as unknown as [string, { p_proyecto: object }];
    expect(argumentos.p_proyecto).toMatchObject({ tipo_de_proyecto: 'Placard' });
    expect(Object.keys(argumentos.p_proyecto)).not.toContain('listo_el');
    expect(Object.keys(argumentos.p_proyecto)).not.toContain('entrega_comprometida');
  });

  it('proponer manda el trabajo y la propuesta, o null para solo cerrar la abierta', async () => {
    const { cliente, rpc } = clienteFalso({ propuestas: [{ id: 'nueva' }] });
    const propuesta = { id: 'nueva', forma: 'un_dia', fecha: '2026-10-08', franja: null } as const;

    expect(await proponerLaEntrega(cliente, 'p', propuesta)).toEqual([{ id: 'nueva' }]);
    expect(rpc).toHaveBeenLastCalledWith('proponer_la_entrega', {
      p_proyecto_id: 'p',
      p_propuesta: propuesta,
    });

    await proponerLaEntrega(cliente, 'p', null);
    expect(rpc).toHaveBeenLastCalledWith('proponer_la_entrega', {
      p_proyecto_id: 'p',
      p_propuesta: null,
    });
  });

  it('un rechazo de la base sale como error', async () => {
    const rechazo = { code: 'MN021', details: 'sin_listo', message: 'x' };
    const cliente = {
      rpc: vi.fn(() => Promise.resolve({ data: null, error: rechazo })),
    } as unknown as ClienteMaun;

    await expect(proponerLaEntrega(cliente, 'p', null)).rejects.toBe(rechazo);
  });

  it('solo las tres columnas de la entrega van por su lado', () => {
    expect(COLUMNAS_DE_LA_ENTREGA).toEqual([
      'listo_el',
      'entrega_comprometida',
      'entrega_comprometida_franja',
    ]);
    for (const columna of COLUMNAS_DE_LA_ENTREGA) {
      expect(COLUMNAS_DE_PROYECTO).not.toContain(columna);
    }
  });
});
