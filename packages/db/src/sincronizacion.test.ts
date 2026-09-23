import { describe, expect, it, vi } from 'vitest';

import type { ClienteMaun } from './cliente.ts';
import { RespuestaInvalidaError } from './replica.ts';
import {
  guardarProyecto,
  leerProyectoGuardado,
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
