import {
  ESTADOS_DE_SEGUIMIENTO,
  faseDe,
  vencimientoDelPresupuesto,
  type EstadoProyecto,
} from '@maun/domain';

import { filasDe, type Replica } from '@/shared/api';
import { diasHasta, fechaLarga, hoyLocal, relativa } from '@/shared/lib';

import type { Proyecto } from './catalogos';
import type { ResumenDeProyecto } from './resumen';

export type EtapaDeSeguimiento = (typeof ESTADOS_DE_SEGUIMIENTO)[number];

export const DIAS_PARA_ENFRIARSE = 7;

export interface SituacionDelContacto {
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
  if (vigente !== null || estado !== 'a_presupuestar' || actual?.estado === 'a_presupuestar') {
    return vigente;
  }
  const relevamiento = visita !== null && visita !== '' && visita <= hoy ? visita : hoy;
  return vencimientoDelPresupuesto(relevamiento);
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

export function situacionDelContacto(
  proyecto: Proyecto,
  ultimaActividad: string,
  hoy: string,
): SituacionDelContacto {
  const dia = diaDelUltimoContacto(proyecto, ultimaActividad);
  const dias = Math.max(0, -diasHasta(dia, hoy));
  const conEspera = (proximoPaso: string, espera: string): SituacionDelContacto => ({
    proximoPaso,
    espera,
    dias,
    fria: dias >= DIAS_PARA_ENFRIARSE,
    agendada: false,
  });

  const visita = proyecto.fecha_visita;

  switch (proyecto.estado) {
    case 'relevamiento': {
      if (visita === null) {
        return conEspera(
          'Falta ponerle fecha a la visita',
          `Relevamiento ${desde(dias, dia, hoy)}, sin fecha de visita`,
        );
      }
      const hastaLaVisita = diasHasta(visita, hoy);
      if (hastaLaVisita > 0) {
        return {
          proximoPaso: `Ir a relevar el ${fechaLarga(visita, hoy)}`,
          espera: `Visita ${relativa(visita, hoy)}`,
          dias,
          fria: false,
          agendada: true,
        };
      }
      if (hastaLaVisita === 0) return conEspera('Ir a relevar hoy', 'La visita es hoy');
      return conEspera(
        'Falta pasar lo relevado a presupuestar',
        `La visita fue ${relativa(visita, hoy)}`,
      );
    }
    case 'a_presupuestar':
      return conEspera('Falta presupuestar', `A presupuestar ${desde(dias, dia, hoy)}`);
    case 'presupuesto_enviado':
      return conEspera(
        'Falta llamar para saber',
        dias === 0
          ? 'Presupuesto enviado hoy'
          : `Presupuesto enviado ${haceTanto(dias, dia, hoy)}, sin respuesta`,
      );
    default:
      return conEspera(
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
        situacion: situacionDelContacto(resumen.proyecto, ultimaActividad, hoy),
      };
    })
    .sort(compararContactos);
}

export function etapaAlGuardarElContacto(
  actual: EstadoProyecto | undefined,
  visita: string,
  hoy: string,
): EstadoProyecto {
  if (actual !== undefined && actual !== 'contacto') return actual;
  if (visita.trim() === '') return 'contacto';
  return visita >= hoy ? 'relevamiento' : 'a_presupuestar';
}

export interface PasoDelContacto {
  hacia: EstadoProyecto;
  etiqueta: string;
}

export function pasoSiguiente(estado: EtapaDeSeguimiento): PasoDelContacto {
  switch (estado) {
    case 'contacto':
      return { hacia: 'relevamiento', etiqueta: 'Agendar la visita' };
    case 'relevamiento':
      return { hacia: 'a_presupuestar', etiqueta: 'Ya fui a relevar' };
    case 'a_presupuestar':
      return { hacia: 'presupuesto_enviado', etiqueta: 'Mandé el presupuesto' };
    case 'presupuesto_enviado':
      return { hacia: 'en_curso', etiqueta: 'Lo aprobó: pasar a Proyectos' };
  }
}
