import type { EventoDeLaAgenda, EventoDerivado, EventoPropio } from '@maun/domain';
import type { MutationOptions, QueryClient } from '@tanstack/react-query';

import {
  DERIVADA,
  diaEnPalabras,
  MUTACION_DE_ANOTACION,
  MUTACION_DE_ANOTACION_NUEVA,
  MUTACION_DE_BAJA_DE_ANOTACION,
  nombreDelEvento,
  type Anotacion,
} from '@/entities/agenda';
import {
  guardadoDeUnPaso,
  marcaDeImportante,
  MUTACION_DE_MARCAS,
  MUTACION_DE_PROYECTO,
  type Proyecto,
} from '@/entities/proyecto';
import {
  COLUMNA_DE_LA_FECHA,
  COLUMNA_DE_LA_MARCA,
  filaPorId,
  visitaHecha,
  type AnotacionNueva,
  type CambiosDeAnotacion,
  type CambiosDeProyecto,
  type Replica,
} from '@/shared/api';
import { avisarEnPantalla, claveDeTodaReplica, metaDeAvisos, type NuevoAviso } from '@/shared/lib';

export type Avisador = (aviso: NuevoAviso) => void;

const DESHACER = 'Deshacer';

function mandarALaCola<TDatos, TVariables>(
  cliente: QueryClient,
  opciones: MutationOptions<TDatos, unknown, TVariables>,
  variables: TVariables,
): void {
  void cliente
    .getMutationCache()
    .build(cliente, opciones)
    .execute(variables)
    .catch(() => undefined);
}

function datosDe(anotacion: Anotacion): AnotacionNueva {
  return {
    id: anotacion.id,
    fecha: anotacion.fecha,
    hora: anotacion.hora,
    texto: anotacion.texto,
    categoria: anotacion.categoria,
    proyecto_id: anotacion.proyecto_id,
    hecha: anotacion.hecha,
    importante: anotacion.importante,
  };
}

function anotacionEnLaReplica(cliente: QueryClient, id: string): Anotacion | undefined {
  for (const [, replica] of cliente.getQueriesData<Replica>({ queryKey: claveDeTodaReplica() })) {
    const fila = replica === undefined ? undefined : filaPorId(replica, 'anotaciones', id);
    if (fila) return fila;
  }
  return undefined;
}

function proyectoEnLaReplica(cliente: QueryClient, id: string): Proyecto | undefined {
  for (const [, replica] of cliente.getQueriesData<Replica>({ queryKey: claveDeTodaReplica() })) {
    const fila = replica === undefined ? undefined : filaPorId(replica, 'proyectos', id);
    if (fila) return fila;
  }
  return undefined;
}

function guardar(cliente: QueryClient, nueva: AnotacionNueva, previa: Anotacion | null): void {
  mandarALaCola(
    cliente,
    {
      ...MUTACION_DE_ANOTACION_NUEVA,
      meta: metaDeAvisos('anotacion', { silencioso: true, sujeto: nueva.texto }),
    },
    { nueva, previa },
  );
}

function quitar(cliente: QueryClient, anotacion: Anotacion): void {
  mandarALaCola(
    cliente,
    {
      ...MUTACION_DE_BAJA_DE_ANOTACION,
      meta: metaDeAvisos('anotacionBorrada', { silencioso: true, sujeto: anotacion.texto }),
    },
    { id: anotacion.id, borradoEn: new Date().toISOString(), previa: anotacion },
  );
}

function editar(
  cliente: QueryClient,
  evento: EventoPropio,
  cambios: CambiosDeAnotacion,
  previos: CambiosDeAnotacion,
): void {
  mandarALaCola(
    cliente,
    {
      ...MUTACION_DE_ANOTACION,
      meta: metaDeAvisos('anotacion', { silencioso: true, sujeto: evento.texto }),
    },
    { id: evento.id, cambios, previos },
  );
}

function avisarLaMarca(avisar: Avisador, id: string, importante: boolean): void {
  avisar({
    clave: `agenda-marca-${id}`,
    tono: 'hecho',
    texto: importante ? 'Marcado como importante.' : 'Le sacaste la marca.',
  });
}

export function anotar(
  cliente: QueryClient,
  nueva: AnotacionNueva,
  avisar: Avisador = avisarEnPantalla,
): void {
  guardar(cliente, nueva, null);
  avisar({
    clave: `agenda-anotada-${nueva.id}`,
    tono: 'hecho',
    texto: `Anotado para el ${diaEnPalabras(nueva.fecha)}.`,
    accion: {
      etiqueta: DESHACER,
      alTocar: () => {
        const fila = anotacionEnLaReplica(cliente, nueva.id);
        if (fila) quitar(cliente, fila);
      },
    },
  });
}

export function tildar(
  cliente: QueryClient,
  evento: EventoPropio,
  avisar: Avisador = avisarEnPantalla,
): void {
  const hecha = !evento.hecha;
  editar(cliente, evento, { hecha }, { hecha: evento.hecha });
  if (!hecha) return;
  avisar({
    clave: `agenda-lista-${evento.id}`,
    tono: 'hecho',
    texto: `Listo: ${evento.texto}.`,
    accion: {
      etiqueta: DESHACER,
      alTocar: () => {
        editar(cliente, evento, { hecha: false }, { hecha: true });
      },
    },
  });
}

export function marcar(
  cliente: QueryClient,
  evento: EventoPropio,
  avisar: Avisador = avisarEnPantalla,
): void {
  const importante = !evento.importante;
  editar(cliente, evento, { importante }, { importante: evento.importante });
  avisarLaMarca(avisar, evento.id, importante);
}

export function marcarDelTrabajo(
  cliente: QueryClient,
  evento: EventoDerivado,
  proyecto: Proyecto,
  avisar: Avisador = avisarEnPantalla,
): void {
  const columna = COLUMNA_DE_LA_MARCA[evento.categoria];
  const importante = !evento.importante;
  mandarALaCola(
    cliente,
    {
      ...MUTACION_DE_MARCAS,
      meta: metaDeAvisos('marcaDeLaAgenda', { silencioso: true, sujeto: evento.titulo }),
    },
    {
      id: proyecto.id,
      cambios: marcaDeImportante(columna, importante),
      previos: marcaDeImportante(columna, evento.importante),
      version: proyecto.version,
    },
  );
  avisarLaMarca(avisar, evento.id, importante);
}

export function borrar(
  cliente: QueryClient,
  anotacion: Anotacion,
  avisar: Avisador = avisarEnPantalla,
): void {
  quitar(cliente, anotacion);
  avisar({
    clave: `agenda-borrada-${anotacion.id}`,
    tono: 'hecho',
    texto: `Borraste «${anotacion.texto}».`,
    accion: {
      etiqueta: DESHACER,
      alTocar: () => {
        guardar(cliente, datosDe(anotacion), anotacion);
      },
    },
  });
}

// Arrastrar un evento derivado no es un efecto colateral: es la operación. La fecha de una entrega
// vive en el proyecto y en ningún otro lado, así que moverla en la agenda es escribirla ahí, por el
// mismo guardado del agregado que usa la ficha (ADR 0045).
function moverElTrabajo(
  cliente: QueryClient,
  evento: EventoDerivado,
  fecha: string,
  hoy: string,
): boolean {
  const proyecto = proyectoEnLaReplica(cliente, evento.proyectoId);
  if (proyecto === undefined) return false;

  const cambios: CambiosDeProyecto = { [COLUMNA_DE_LA_FECHA[evento.categoria]]: fecha };
  // La misma regla de la hoja del contacto: una visita que se corre a un día que todavía no llegó
  // vuelve a estar pendiente. Lo hecho no se arrastra, así que acá ya viene apagada; se manda igual
  // para que el invariante no dependa de eso.
  if (evento.categoria === 'visita') {
    cambios.visita_hecha = visitaHecha(proyecto) && fecha <= hoy;
  }

  mandarALaCola(
    cliente,
    {
      ...MUTACION_DE_PROYECTO,
      meta: metaDeAvisos('eventoMovido', { silencioso: true, sujeto: evento.titulo }),
    },
    guardadoDeUnPaso(proyecto, cambios, hoy),
  );
  return true;
}

function moverLaAnotacion(cliente: QueryClient, evento: EventoPropio, fecha: string): void {
  mandarALaCola(
    cliente,
    {
      ...MUTACION_DE_ANOTACION,
      meta: metaDeAvisos('eventoMovido', { silencioso: true, sujeto: evento.texto }),
    },
    { id: evento.id, cambios: { fecha }, previos: { fecha: evento.fecha } },
  );
}

function escribirElMovimiento(
  cliente: QueryClient,
  evento: EventoDeLaAgenda,
  fecha: string,
  hoy: string,
): boolean {
  if (evento.clase === 'propia') {
    moverLaAnotacion(cliente, evento, fecha);
    return true;
  }
  return moverElTrabajo(cliente, evento, fecha, hoy);
}

export function mover(
  cliente: QueryClient,
  evento: EventoDeLaAgenda,
  fecha: string,
  hoy: string,
  avisar: Avisador = avisarEnPantalla,
): void {
  if (fecha === evento.fecha) return;
  if (!escribirElMovimiento(cliente, evento, fecha, hoy)) return;

  avisar({
    clave: `agenda-movido-${evento.id}`,
    tono: 'hecho',
    texto:
      evento.clase === 'propia'
        ? `${nombreDelEvento(evento)} pasó al ${diaEnPalabras(fecha)}.`
        : `${nombreDelEvento(evento)}: al ${diaEnPalabras(fecha)}. Le cambiaste ${DERIVADA[evento.categoria].queCambia}.`,
    accion: {
      etiqueta: DESHACER,
      alTocar: () => {
        escribirElMovimiento(cliente, { ...evento, fecha }, evento.fecha, hoy);
      },
    },
  });
}
