import { mensajeDeSincronizacion } from '@/shared/api';
import { describirEstadoSync, type EstadoSync } from '@/shared/lib';
import type { NombreDeIcono } from '@/shared/ui';

import type { DesenlaceDeLaSincronizacion } from '../api/sincronizarAhora';

export interface DescripcionDelDesenlace {
  icono: NombreDeIcono;
  texto: string;
}

const ICONO_DEL_ESTADO: Readonly<Record<EstadoSync['tipo'], NombreDeIcono>> = {
  'sin-conexion': 'cloud-off',
  pendiente: 'arrow-up-down',
  rechazado: 'triangle-alert',
  sincronizado: 'check',
};

export function describirDesenlace(
  desenlace: DesenlaceDeLaSincronizacion,
): DescripcionDelDesenlace {
  switch (desenlace.tipo) {
    case 'estado':
      return {
        icono: ICONO_DEL_ESTADO[desenlace.estado.tipo],
        texto: describirEstadoSync(desenlace.estado),
      };
    case 'fallo':
      return {
        icono: 'triangle-alert',
        texto: `No se pudo sincronizar. ${mensajeDeSincronizacion(desenlace.error)}`,
      };
    case 'sin-respuesta':
      return {
        icono: 'clock',
        texto: 'El servidor tarda en responder. Sigue intentando solo.',
      };
  }
}
