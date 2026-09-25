import {
  esDiaDeLaEntrega,
  esFranja,
  FRANJAS_DE_ENTREGA,
  type DiaElegido,
  type FranjaDeEntrega,
  type RespuestaDeEntrega,
} from '@maun/domain';

import { entregaComprometida, filaPorId, filasDe, type FilaDe, type Replica } from '@/shared/api';

export type FilaDePropuesta = FilaDe<'propuestas_de_entrega'>;
export type FilaDeRespuestaDeEntrega = FilaDe<'respuestas_de_entrega'>;
export type FilaDeCambioDeFecha = FilaDe<'cambios_de_fecha'>;

function diaDeLaFila(valor: unknown): DiaElegido[] {
  if (typeof valor !== 'object' || valor === null) return [];
  const { fecha, franjas } = valor as Record<string, unknown>;
  if (typeof fecha !== 'string' || !esDiaDeLaEntrega(fecha) || !Array.isArray(franjas)) return [];
  const marcadas: readonly unknown[] = franjas;
  const validas = FRANJAS_DE_ENTREGA.filter((franja) => marcadas.includes(franja));
  return validas.length === 0 ? [] : [{ fecha, franjas: validas }];
}

export function diasDeLaRespuesta(fila: FilaDeRespuestaDeEntrega): DiaElegido[] {
  const dias: unknown = fila.dias;
  return Array.isArray(dias) ? (dias as readonly unknown[]).flatMap(diaDeLaFila) : [];
}

function enOrden<T extends { created_at: string; id: string }>(filas: readonly T[]): T[] {
  return [...filas].sort(
    (una, otra) => una.created_at.localeCompare(otra.created_at) || una.id.localeCompare(otra.id),
  );
}

function ultima<T>(filas: readonly T[]): T | null {
  return filas.length === 0 ? null : (filas[filas.length - 1] ?? null);
}

export interface RespuestaEnLaFicha {
  id: string;
  respuesta: RespuestaDeEntrega;
  dias: DiaElegido[];
  nota: string;
  leida: boolean;
  creadaEn: string;
}

function respuestaEnLaFicha(fila: FilaDeRespuestaDeEntrega): RespuestaEnLaFicha {
  return {
    id: fila.id,
    respuesta: fila.respuesta,
    dias: diasDeLaRespuesta(fila),
    nota: fila.nota,
    leida: fila.leida_at !== null,
    creadaEn: fila.created_at,
  };
}

export interface CoordinacionEnLaFicha {
  propuesta: FilaDePropuesta | null;
  respuesta: RespuestaEnLaFicha | null;
  sinLeer: FilaDeRespuestaDeEntrega[];
  laAceptoElCliente: boolean;
}

export function propuestaAbierta(replica: Replica, proyectoId: string): FilaDePropuesta | null {
  return ultima(
    enOrden(
      filasDe(replica, 'propuestas_de_entrega').filter(
        (propuesta) => propuesta.proyecto_id === proyectoId && propuesta.cerrada_at === null,
      ),
    ),
  );
}

function respuestasDelTrabajo(replica: Replica, proyectoId: string): FilaDeRespuestaDeEntrega[] {
  return enOrden(
    filasDe(replica, 'respuestas_de_entrega').filter(
      (respuesta) => respuesta.proyecto_id === proyectoId,
    ),
  );
}

export function laComprometidaVinoDelCliente(replica: Replica, proyectoId: string): boolean {
  const proyecto = filaPorId(replica, 'proyectos', proyectoId);
  const comprometida = proyecto === undefined ? null : entregaComprometida(proyecto);
  if (comprometida === null) return false;
  const historia = ultima(
    enOrden(
      filasDe(replica, 'cambios_de_fecha').filter(
        (cambio) => cambio.proyecto_id === proyectoId && cambio.tipo === 'comprometida',
      ),
    ),
  );
  return historia !== null && historia.origen === 'cliente' && historia.fecha === comprometida;
}

export function coordinacionEnLaFicha(replica: Replica, proyectoId: string): CoordinacionEnLaFicha {
  const propuesta = propuestaAbierta(replica, proyectoId);
  const respuestas = respuestasDelTrabajo(replica, proyectoId);
  const aLaAbierta =
    propuesta === null
      ? null
      : ultima(respuestas.filter((respuesta) => respuesta.propuesta_id === propuesta.id));
  return {
    propuesta,
    respuesta: aLaAbierta === null ? null : respuestaEnLaFicha(aLaAbierta),
    sinLeer: respuestas.filter((respuesta) => respuesta.leida_at === null),
    laAceptoElCliente: laComprometidaVinoDelCliente(replica, proyectoId),
  };
}

export interface AvisoDeEntrega {
  proyectoId: string;
  cliente: string;
  trabajo: string;
  respuesta: RespuestaDeEntrega;
  fecha: string | null;
  franja: FranjaDeEntrega | null;
  creadaEn: string;
  sinLeer: FilaDeRespuestaDeEntrega[];
}

export function avisosDeEntregas(replica: Replica): AvisoDeEntrega[] {
  const porTrabajo = new Map<string, FilaDeRespuestaDeEntrega[]>();
  for (const fila of enOrden(filasDe(replica, 'respuestas_de_entrega'))) {
    if (fila.leida_at !== null) continue;
    porTrabajo.set(fila.proyecto_id, [...(porTrabajo.get(fila.proyecto_id) ?? []), fila]);
  }

  const avisos: AvisoDeEntrega[] = [];
  for (const [proyectoId, sinLeer] of porTrabajo) {
    const proyecto = filaPorId(replica, 'proyectos', proyectoId);
    const masNueva = ultima(sinLeer);
    if (proyecto === undefined || masNueva === null) continue;
    const propuesta = filaPorId(replica, 'propuestas_de_entrega', masNueva.propuesta_id);
    const cliente = filaPorId(replica, 'clientes', proyecto.cliente_id);
    const franja = propuesta?.franja ?? null;
    avisos.push({
      proyectoId,
      cliente: cliente?.nombre ?? '',
      trabajo: proyecto.titulo,
      respuesta: masNueva.respuesta,
      fecha: masNueva.respuesta === 'me_queda_bien' ? (propuesta?.fecha ?? null) : null,
      franja: masNueva.respuesta === 'me_queda_bien' && esFranja(franja) ? franja : null,
      creadaEn: masNueva.created_at,
      sinLeer,
    });
  }
  return avisos.sort((uno, otro) => otro.creadaEn.localeCompare(uno.creadaEn));
}
