import {
  ESTADOS_DE_SEGUIMIENTO,
  faseDe,
  puedeCambiarEstado,
  vencimientoDelPresupuesto,
  type EstadoProyecto,
} from '@maun/domain';

import { filasDe, type Replica } from '@/shared/api';
import { diasHasta, fechaLarga, hoyLocal, relativa } from '@/shared/lib';

import type { Proyecto } from './catalogos';
import type { ResumenDeProyecto } from './resumen';
import { presupuestoArmado, TAREAS_DEL_PRESUPUESTO, tareasHechas } from './tareas';

export type EtapaDeSeguimiento = (typeof ESTADOS_DE_SEGUIMIENTO)[number];

export const DIAS_PARA_ENFRIARSE = 7;

export type SugerenciaDelContacto =
  | 'agendar-la-visita'
  | 'poner-fecha-a-la-visita'
  | 'ir-a-relevar'
  | 'cargar-lo-relevado'
  | 'mandar-el-estimativo'
  | 'presupuestar'
  | 'mandar-el-presupuesto'
  | 'pasar-a-presupuestar'
  | 'llamar';

export interface SituacionDelContacto {
  sugerencia: SugerenciaDelContacto;
  proximoPaso: string;
  espera: string;
  dias: number;
  fria: boolean;
  agendada: boolean;
}

export interface ContactoEnLista {
  resumen: ResumenDeProyecto;
  situacion: SituacionDelContacto;
  ultimoContacto: string;
  ultimaActividad: string;
}

export function esEtapaDeSeguimiento(estado: EstadoProyecto): estado is EtapaDeSeguimiento {
  return faseDe(estado) === 'seguimiento';
}

export function diaDeLaMarca(marca: string): string {
  return hoyLocal(new Date(marca));
}

export function diaDelUltimoContacto(proyecto: Proyecto, ultimaActividad: string): string {
  return proyecto.ultimo_contacto ?? diaDeLaMarca(ultimaActividad);
}

export function ultimoContactoAlGuardar(
  actual: Proyecto | undefined,
  estado: EstadoProyecto,
  hoy: string,
  dia: string = hoy,
): string | null {
  if (actual === undefined || actual.estado !== estado) return dia < hoy ? dia : hoy;
  return actual.ultimo_contacto;
}

export function vencimientoPropuesto(
  actual: Proyecto | undefined,
  estado: EstadoProyecto,
  visita: string | null,
  hoy: string,
): string | null {
  const vigente = actual?.vencimiento_presupuesto ?? null;
  if (estado !== 'a_presupuestar' || actual?.estado === 'a_presupuestar') return vigente;
  const vieneDelEstimativo = actual?.estado === 'presupuesto_estimativo';
  if (vigente !== null && !vieneDelEstimativo) return vigente;
  const relevado = visita !== null && visita !== '' && visita <= hoy;
  return vencimientoDelPresupuesto(relevado && !vieneDelEstimativo ? visita : hoy);
}

export function yaSeRelevo(proyecto: Proyecto, hoy: string): boolean {
  return (
    proyecto.fecha_visita !== null &&
    proyecto.fecha_visita <= hoy &&
    (proyecto.estado === 'presupuesto_estimativo' ||
      proyecto.estado === 'a_presupuestar' ||
      proyecto.estado === 'presupuesto_enviado')
  );
}

export function ultimasActividades(replica: Replica): Map<string, string> {
  const ultimas = new Map<string, string>();
  const anotar = (id: string, marca: string) => {
    const previa = ultimas.get(id);
    if (previa === undefined || marca > previa) ultimas.set(id, marca);
  };

  for (const proyecto of filasDe(replica, 'proyectos')) anotar(proyecto.id, proyecto.updated_at);
  for (const pago of filasDe(replica, 'pagos')) anotar(pago.proyecto_id, pago.updated_at);
  for (const gasto of filasDe(replica, 'gastos')) anotar(gasto.proyecto_id, gasto.updated_at);
  return ultimas;
}

function desde(dias: number, dia: string, hoy: string): string {
  if (dias === 0) return 'desde hoy';
  if (dias === 1) return 'desde ayer';
  return `desde ${relativa(dia, hoy)}`;
}

function haceTanto(dias: number, dia: string, hoy: string): string {
  return dias === 0 ? 'hoy' : relativa(dia, hoy);
}

function mandadoHace(que: string, dias: number, dia: string, hoy: string): string {
  return dias === 0 ? `${que} hoy` : `${que} ${haceTanto(dias, dia, hoy)}, sin respuesta`;
}

export function situacionDelContacto(
  proyecto: Proyecto,
  ultimaActividad: string,
  hoy: string,
  cobrado: number,
): SituacionDelContacto {
  const dia = diaDelUltimoContacto(proyecto, ultimaActividad);
  const dias = Math.max(0, -diasHasta(dia, hoy));
  const conEspera = (
    sugerencia: SugerenciaDelContacto,
    proximoPaso: string,
    espera: string,
  ): SituacionDelContacto => ({
    sugerencia,
    proximoPaso,
    espera,
    dias,
    fria: dias >= DIAS_PARA_ENFRIARSE,
    agendada: false,
  });

  const visita = proyecto.fecha_visita;

  const hastaLaVisita = (): SituacionDelContacto | undefined => {
    if (visita === null) return undefined;
    const faltan = diasHasta(visita, hoy);
    if (faltan > 0) {
      return {
        sugerencia: 'ir-a-relevar',
        proximoPaso: `Ir a relevar el ${fechaLarga(visita, hoy)}`,
        espera: `Visita ${relativa(visita, hoy)}`,
        dias,
        fria: false,
        agendada: true,
      };
    }
    if (faltan === 0) return conEspera('ir-a-relevar', 'Ir a relevar hoy', 'La visita es hoy');
    return undefined;
  };

  switch (proyecto.estado) {
    case 'presupuesto_estimativo': {
      const espera = mandadoHace('Estimativo enviado', dias, dia, hoy);
      if (visita === null) {
        return conEspera('agendar-la-visita', 'Si avanza, falta agendar la visita', espera);
      }
      return (
        hastaLaVisita() ??
        conEspera(
          'pasar-a-presupuestar',
          cobrado > 0
            ? 'Ya pagó la visita: falta presupuestar'
            : 'Falta que apruebe el estimativo y pague la visita',
          espera,
        )
      );
    }
    case 'relevamiento': {
      if (visita === null) {
        return conEspera(
          'poner-fecha-a-la-visita',
          'Falta ponerle fecha a la visita',
          `Relevamiento ${desde(dias, dia, hoy)}, sin fecha de visita`,
        );
      }
      return (
        hastaLaVisita() ??
        conEspera(
          'cargar-lo-relevado',
          'Falta pasar lo relevado a presupuestar',
          `La visita fue ${relativa(visita, hoy)}`,
        )
      );
    }
    case 'a_presupuestar': {
      const espera = `A presupuestar ${desde(dias, dia, hoy)}`;
      const hechas = tareasHechas(proyecto);
      if (presupuestoArmado(proyecto)) {
        return conEspera(
          'mandar-el-presupuesto',
          'Ya está armado: falta mandar el presupuesto',
          espera,
        );
      }
      if (hechas > 0) {
        return conEspera(
          'presupuestar',
          `Falta presupuestar: ${String(hechas)} de ${String(TAREAS_DEL_PRESUPUESTO.length)} tareas hechas`,
          espera,
        );
      }
      if (cobrado > 0) return conEspera('presupuestar', 'Falta presupuestar', espera);
      return conEspera(
        'mandar-el-estimativo',
        'Falta el estimativo: la visita no está cobrada',
        espera,
      );
    }
    case 'presupuesto_enviado':
      return conEspera(
        'llamar',
        'Falta llamar para saber',
        mandadoHace('Presupuesto enviado', dias, dia, hoy),
      );
    default:
      return conEspera(
        'agendar-la-visita',
        'Falta agendar la visita',
        `Contacto ${desde(dias, dia, hoy)}, sin visita agendada`,
      );
  }
}

function compararContactos(uno: ContactoEnLista, otro: ContactoEnLista): number {
  if (uno.situacion.agendada !== otro.situacion.agendada) return uno.situacion.agendada ? 1 : -1;

  if (uno.situacion.agendada) {
    const visitaUno = uno.resumen.proyecto.fecha_visita ?? '';
    const visitaOtro = otro.resumen.proyecto.fecha_visita ?? '';
    if (visitaUno !== visitaOtro) return visitaUno < visitaOtro ? -1 : 1;
  } else if (uno.ultimoContacto !== otro.ultimoContacto) {
    return uno.ultimoContacto < otro.ultimoContacto ? -1 : 1;
  } else if (uno.ultimaActividad !== otro.ultimaActividad) {
    return uno.ultimaActividad < otro.ultimaActividad ? -1 : 1;
  }

  return uno.resumen.proyecto.id < otro.resumen.proyecto.id ? -1 : 1;
}

export function contactosEnOrden(
  resumenes: readonly ResumenDeProyecto[],
  replica: Replica,
  hoy: string,
): ContactoEnLista[] {
  const ultimas = ultimasActividades(replica);
  return resumenes
    .filter((resumen) => resumen.fase === 'seguimiento')
    .map((resumen) => {
      const ultimaActividad = ultimas.get(resumen.proyecto.id) ?? resumen.proyecto.updated_at;
      return {
        resumen,
        ultimoContacto: diaDelUltimoContacto(resumen.proyecto, ultimaActividad),
        ultimaActividad,
        situacion: situacionDelContacto(resumen.proyecto, ultimaActividad, hoy, resumen.cobrado),
      };
    })
    .sort(compararContactos);
}

export function etapaAlGuardarElContacto(
  actual: Proyecto | undefined,
  visita: string,
  hoy: string,
): EstadoProyecto {
  const fecha = visita.trim();
  if (actual !== undefined && actual.estado === 'presupuesto_estimativo') {
    const agendaLaVisita = actual.fecha_visita === null && fecha !== '' && fecha >= hoy;
    return agendaLaVisita ? 'relevamiento' : actual.estado;
  }
  if (actual !== undefined && actual.estado !== 'contacto') return actual.estado;
  if (fecha === '') return 'contacto';
  return fecha >= hoy ? 'relevamiento' : 'a_presupuestar';
}

export type CaminoDelPaso =
  'agendar' | 'relevar' | 'presupuesto' | 'pasar-a-presupuestar' | 'guardar' | 'pasaje';

export interface PasoDelContacto {
  hacia: EstadoProyecto;
  etiqueta: string;
  camino: CaminoDelPaso;
}

const APROBAR: PasoDelContacto = { hacia: 'en_curso', etiqueta: 'Ya lo aprobó', camino: 'pasaje' };

function pasosDeLaSugerencia(
  etapa: EtapaDeSeguimiento,
  sugerencia: SugerenciaDelContacto,
): PasoDelContacto[] {
  const relevar: PasoDelContacto = {
    hacia: 'a_presupuestar',
    etiqueta: 'Ya fui a relevar',
    camino: 'relevar',
  };
  const presupuesto: PasoDelContacto = {
    hacia: 'presupuesto_enviado',
    etiqueta: 'Mandé el presupuesto',
    camino: 'presupuesto',
  };

  switch (sugerencia) {
    case 'agendar-la-visita': {
      const agendar: PasoDelContacto = {
        hacia: 'relevamiento',
        etiqueta: 'Agendar la visita',
        camino: 'agendar',
      };
      return etapa === 'contacto'
        ? [
            agendar,
            {
              hacia: 'presupuesto_estimativo',
              etiqueta: 'Mandé un estimativo',
              camino: 'guardar',
            } satisfies PasoDelContacto,
            APROBAR,
          ]
        : [agendar, APROBAR];
    }
    case 'poner-fecha-a-la-visita':
    case 'ir-a-relevar':
    case 'cargar-lo-relevado':
      return [relevar, APROBAR];
    case 'mandar-el-estimativo':
      return [
        {
          hacia: 'presupuesto_estimativo',
          etiqueta: 'Mandé el estimativo',
          camino: 'guardar',
        } satisfies PasoDelContacto,
        presupuesto,
        APROBAR,
      ];
    case 'presupuestar':
    case 'mandar-el-presupuesto':
      return [presupuesto, APROBAR];
    case 'pasar-a-presupuestar':
      return [
        {
          hacia: 'a_presupuestar',
          etiqueta: 'Pasar a presupuestar',
          camino: 'pasar-a-presupuestar',
        } satisfies PasoDelContacto,
        APROBAR,
      ];
    case 'llamar':
      return [{ ...APROBAR, etiqueta: 'Lo aprobó: pasar a Proyectos' }];
  }
}

export function pasosDelContacto(
  etapa: EtapaDeSeguimiento,
  situacion: SituacionDelContacto,
): PasoDelContacto[] {
  return pasosDeLaSugerencia(etapa, situacion.sugerencia).filter((paso) =>
    puedeCambiarEstado(etapa, paso.hacia),
  );
}
