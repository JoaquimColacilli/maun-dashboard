import {
  ESCALAS,
  estadoDelPedido,
  envioDe,
  lineasDeLaRespuesta,
  propiasDelTrabajo,
  resumenDeOpiniones,
  TIPOS_DE_PREGUNTA,
  type DatosDeLasOpiniones,
  type EncuestaGuardada,
  type Escala,
  type EstadoDelPedido,
  type LineaDeLaRespuesta,
  type Paso,
  type PreguntaDeLaEncuesta,
  type PreguntaGuardada,
  type RenglonGuardado,
  type RespuestaGuardada,
  type ResumenDeOpiniones,
  type TipoDePregunta,
  type TrabajoOpinado,
  type ValorGuardado,
} from '@maun/domain';

import { filaPorId, filasDe, type FilaDe, type Replica } from '@/shared/api';
import { diaLocal } from '@/shared/lib';

export type FilaDePregunta = FilaDe<'preguntas'>;
export type FilaDeEncuesta = FilaDe<'encuestas_enviadas'>;
export type FilaDeRespuesta = FilaDe<'respuestas'>;

function tipoDe(valor: unknown): TipoDePregunta | undefined {
  return TIPOS_DE_PREGUNTA.find((tipo) => tipo === valor);
}

function escalaDe(valor: unknown): Escala | null {
  return ESCALAS.find((escala) => escala === valor) ?? null;
}

function opcionesDe(valor: unknown): string[] | null {
  if (!Array.isArray(valor)) return null;
  const opciones: readonly unknown[] = valor;
  return opciones.every((opcion) => typeof opcion === 'string') ? (opciones as string[]) : null;
}

function preguntaDeLaFoto(valor: unknown): PreguntaDeLaEncuesta[] {
  if (typeof valor !== 'object' || valor === null) return [];
  const cruda = valor as Record<string, unknown>;
  const tipo = tipoDe(cruda.tipo);
  if (typeof cruda.id !== 'string' || typeof cruda.texto !== 'string' || tipo === undefined) {
    return [];
  }
  return [
    {
      id: cruda.id,
      texto: cruda.texto,
      tipo,
      escala: escalaDe(cruda.escala),
      obligatoria: cruda.obligatoria === true,
      opciones: opcionesDe(cruda.opciones),
      propia: cruda.propia === true,
    },
  ];
}

export function fotoDeLaEncuesta(fila: FilaDeEncuesta): PreguntaDeLaEncuesta[] {
  const foto: unknown = fila.preguntas;
  return Array.isArray(foto) ? (foto as readonly unknown[]).flatMap(preguntaDeLaFoto) : [];
}

export function preguntaGuardada(fila: FilaDePregunta): PreguntaGuardada {
  return {
    id: fila.id,
    serie: fila.serie,
    numero: fila.numero,
    proyectoId: fila.proyecto_id,
    titular: fila.titular,
    orden: fila.orden,
    texto: fila.texto,
    tipo: fila.tipo,
    escala: fila.escala,
    obligatoria: fila.obligatoria,
    opciones: fila.opciones,
    archivadaEl: fila.archivada_at === null ? null : diaLocal(fila.archivada_at),
    creadaEl: diaLocal(fila.created_at),
  };
}

function encuestaGuardada(fila: FilaDeEncuesta): EncuestaGuardada {
  return {
    id: fila.id,
    proyectoId: fila.proyecto_id,
    enviadaEl: diaLocal(fila.enviada_at),
    enviadaA: fila.enviada_at,
    recordadaEl: fila.recordada_at === null ? null : diaLocal(fila.recordada_at),
    revocadaEl: fila.revocada_at === null ? null : diaLocal(fila.revocada_at),
    preguntas: fotoDeLaEncuesta(fila),
  };
}

function valorDelRenglon(fila: FilaDe<'renglones_de_respuesta'>): ValorGuardado {
  if (fila.tipo === 'varias') return fila.valor_opciones ?? [];
  if (fila.tipo === 'texto') return fila.valor_texto ?? '';
  return fila.valor_numero ?? 0;
}

function renglonesPorRespuesta(replica: Replica): Map<string, RenglonGuardado[]> {
  const porRespuesta = new Map<string, RenglonGuardado[]>();
  for (const fila of filasDe(replica, 'renglones_de_respuesta')) {
    porRespuesta.set(fila.respuesta_id, [
      ...(porRespuesta.get(fila.respuesta_id) ?? []),
      {
        preguntaId: fila.pregunta_id,
        preguntaTexto: fila.pregunta_texto,
        valor: valorDelRenglon(fila),
      },
    ]);
  }
  return porRespuesta;
}

function respuestaGuardada(
  fila: FilaDeRespuesta,
  renglones: ReadonlyMap<string, readonly RenglonGuardado[]>,
): RespuestaGuardada {
  return {
    id: fila.id,
    encuestaId: fila.encuesta_id,
    contestadaEl: diaLocal(fila.contestada_at),
    contestadaA: fila.contestada_at,
    leidaEl: fila.leida_at === null ? null : diaLocal(fila.leida_at),
    renglones: renglones.get(fila.id) ?? [],
  };
}

export function trabajoOpinado(replica: Replica, proyectoId: string): TrabajoOpinado {
  const proyecto = filaPorId(replica, 'proyectos', proyectoId);
  const cliente =
    proyecto === undefined ? undefined : filaPorId(replica, 'clientes', proyecto.cliente_id);
  return { proyectoId, cliente: cliente?.nombre ?? '', trabajo: proyecto?.titulo ?? '' };
}

export function datosDeLasOpiniones(replica: Replica): DatosDeLasOpiniones {
  const renglones = renglonesPorRespuesta(replica);
  const encuestas = filasDe(replica, 'encuestas_enviadas').map(encuestaGuardada);
  const proyectos = [...new Set(encuestas.map((encuesta) => encuesta.proyectoId))];
  return {
    preguntas: filasDe(replica, 'preguntas').map(preguntaGuardada),
    encuestas,
    respuestas: filasDe(replica, 'respuestas').map((fila) => respuestaGuardada(fila, renglones)),
    trabajos: proyectos.map((proyectoId) => trabajoOpinado(replica, proyectoId)),
  };
}

export function resumenDelTaller(replica: Replica, hoy: string): ResumenDeOpiniones {
  return resumenDeOpiniones(datosDeLasOpiniones(replica), hoy);
}

export interface UltimaSinLeer {
  respuestaId: string;
  cliente: string;
  trabajo: string;
  titular: Paso | null;
  comentario: string | null;
}

export interface NovedadesDeOpiniones {
  sinLeer: number;
  nombres: string[];
  ultima: UltimaSinLeer | null;
}

export function novedadesDeOpiniones(replica: Replica, hoy: string): NovedadesDeOpiniones {
  const resumen = resumenDelTaller(replica, hoy);
  const filaDe = (respuestaId: string) =>
    resumen.trabajos.find((fila) => fila.pedido.envio.respuestaId === respuestaId);
  const [primera] = resumen.sinLeer;
  const suFila = primera === undefined ? undefined : filaDe(primera.id);
  return {
    sinLeer: resumen.sinLeer.length,
    nombres: resumen.sinLeer.map((respuesta) => filaDe(respuesta.id)?.trabajo.cliente ?? ''),
    ultima:
      primera === undefined
        ? null
        : {
            respuestaId: primera.id,
            cliente: suFila?.trabajo.cliente ?? '',
            trabajo: suFila?.trabajo.trabajo ?? '',
            titular: suFila?.titular ?? null,
            comentario:
              resumen.comentarios.find((comentario) => comentario.respuestaId === primera.id)
                ?.texto ?? null,
          },
  };
}

export interface FichaDeLaRespuesta {
  respuesta: FilaDeRespuesta;
  trabajo: TrabajoOpinado;
  telefono: string;
  contestadaEl: string;
  lineas: LineaDeLaRespuesta[];
}

export function fichaDeLaRespuesta(
  replica: Replica,
  respuestaId: string,
): FichaDeLaRespuesta | null {
  const respuesta = filaPorId(replica, 'respuestas', respuestaId);
  if (!respuesta) return null;
  const encuesta = filaPorId(replica, 'encuestas_enviadas', respuesta.encuesta_id);
  if (!encuesta) return null;
  const proyecto = filaPorId(replica, 'proyectos', encuesta.proyecto_id);
  const cliente =
    proyecto === undefined ? undefined : filaPorId(replica, 'clientes', proyecto.cliente_id);
  return {
    respuesta,
    trabajo: trabajoOpinado(replica, encuesta.proyecto_id),
    telefono: cliente?.telefono ?? '',
    contestadaEl: diaLocal(respuesta.contestada_at),
    lineas: lineasDeLaRespuesta(
      fotoDeLaEncuesta(encuesta),
      renglonesPorRespuesta(replica).get(respuesta.id) ?? [],
    ),
  };
}

const TERMINADOS: readonly string[] = ['entregado', 'cobrado'];

export interface TrabajosParaPedir {
  terminados: number;
  sinPedir: string | null;
}

export function trabajosParaPedir(replica: Replica): TrabajosParaPedir {
  const conPedido = new Set(
    filasDe(replica, 'encuestas_enviadas').map((encuesta) => encuesta.proyecto_id),
  );
  const terminados = filasDe(replica, 'proyectos')
    .filter((proyecto) => TERMINADOS.includes(proyecto.estado))
    .sort((a, b) =>
      (b.fecha_entrega ?? b.updated_at).localeCompare(a.fecha_entrega ?? a.updated_at),
    );
  return {
    terminados: terminados.length,
    sinPedir: terminados.find((proyecto) => !conPedido.has(proyecto.id))?.id ?? null,
  };
}

export interface PedidoDelTrabajo {
  pedido: EstadoDelPedido;
  encuesta: FilaDeEncuesta | undefined;
  respuesta: RespuestaGuardada | undefined;
  preguntas: PreguntaDeLaEncuesta[];
  propias: PreguntaGuardada[];
}

export function pedidoDelTrabajo(replica: Replica, proyectoId: string): PedidoDelTrabajo {
  const renglones = renglonesPorRespuesta(replica);
  const filas = filasDe(replica, 'encuestas_enviadas').filter(
    (encuesta) => encuesta.proyecto_id === proyectoId,
  );
  const respuestas = filasDe(replica, 'respuestas').filter((respuesta) =>
    filas.some((encuesta) => encuesta.id === respuesta.encuesta_id),
  );
  const respuestaDe = (encuestaId: string): RespuestaGuardada | undefined => {
    const fila = respuestas.find((respuesta) => respuesta.encuesta_id === encuestaId);
    return fila === undefined ? undefined : respuestaGuardada(fila, renglones);
  };
  const pedido = estadoDelPedido(
    filas.map((fila) => envioDe(encuestaGuardada(fila), respuestaDe(fila.id))),
  );
  const encuesta =
    pedido.estado === 'sin_mandar' ? undefined : filas.find((fila) => fila.id === pedido.envio.id);
  const propias = propiasDelTrabajo(
    filasDe(replica, 'preguntas').map(preguntaGuardada),
    proyectoId,
  );
  return {
    pedido,
    encuesta,
    respuesta: encuesta === undefined ? undefined : respuestaDe(encuesta.id),
    preguntas: encuesta === undefined ? [] : fotoDeLaEncuesta(encuesta),
    propias,
  };
}
