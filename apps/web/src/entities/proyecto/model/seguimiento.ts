import {
  esEstadoDeConsulta,
  RESULTADOS_DEL_CONTACTO,
  type EstadoDeConsulta,
  type ResultadoDelContacto,
} from '@maun/domain';

import { filasDe, type FilaDe, type Replica } from '@/shared/api';

import type { ResumenDeProyecto } from './resumen';

export type ProximoContacto = FilaDe<'proximos_contactos'>;

export const RESULTADO_DEL_CONTACTO: Readonly<Record<ResultadoDelContacto, string>> = {
  reactivado: 'Volvió a las consultas',
  perdido: 'Se dio por perdido',
  otra_fecha: 'Siguió en seguimiento con otra fecha',
};

export function textoDelResultado(resultado: string | null): string {
  const conocido = RESULTADOS_DEL_CONTACTO.find((uno) => uno === resultado);
  return conocido === undefined ? '' : RESULTADO_DEL_CONTACTO[conocido];
}

export function contactosDelSeguimiento(replica: Replica, proyectoId: string): ProximoContacto[] {
  return filasDe(replica, 'proximos_contactos').filter(
    (contacto) => contacto.proyecto_id === proyectoId && contacto.deleted_at === null,
  );
}

export function pendienteDelSeguimiento(
  replica: Replica,
  proyectoId: string,
): ProximoContacto | undefined {
  return contactosDelSeguimiento(replica, proyectoId).find(
    (contacto) => contacto.hecho_el === null,
  );
}

export function historiaDelSeguimiento(replica: Replica, proyectoId: string): ProximoContacto[] {
  return contactosDelSeguimiento(replica, proyectoId)
    .filter((contacto) => contacto.hecho_el !== null)
    .sort(
      (uno, otro) =>
        (otro.hecho_el ?? '').localeCompare(uno.hecho_el ?? '') ||
        otro.created_at.localeCompare(uno.created_at),
    );
}

export function etapaAlVolver(pendiente: ProximoContacto | undefined): EstadoDeConsulta {
  const etapa = pendiente?.etapa_previa;
  return etapa !== undefined && esEstadoDeConsulta(etapa) ? etapa : 'presupuesto_enviado';
}

export interface EnSeguimiento {
  resumen: ResumenDeProyecto;
  pendiente: ProximoContacto | undefined;
  atrasado: boolean;
  esHoy: boolean;
}

export function seguimientosEnOrden(
  resumenes: readonly ResumenDeProyecto[],
  replica: Replica,
  hoy: string,
): EnSeguimiento[] {
  return resumenes
    .filter((resumen) => resumen.fase === 'seguimiento')
    .map((resumen) => {
      const pendiente = pendienteDelSeguimiento(replica, resumen.proyecto.id);
      return {
        resumen,
        pendiente,
        atrasado: pendiente !== undefined && pendiente.fecha < hoy,
        esHoy: pendiente?.fecha === hoy,
      };
    })
    .sort((uno, otro) => {
      const fechaUno = uno.pendiente?.fecha ?? '9999-12-31';
      const fechaOtro = otro.pendiente?.fecha ?? '9999-12-31';
      if (fechaUno !== fechaOtro) return fechaUno < fechaOtro ? -1 : 1;
      return uno.resumen.proyecto.id < otro.resumen.proyecto.id ? -1 : 1;
    });
}
