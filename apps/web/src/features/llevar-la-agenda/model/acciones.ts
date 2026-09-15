import type { EventoDerivado, EventoPropio } from '@maun/domain';
import type { MutationOptions, QueryClient } from '@tanstack/react-query';

import {
  diaEnPalabras,
  MUTACION_DE_ANOTACION,
  MUTACION_DE_ANOTACION_NUEVA,
  MUTACION_DE_BAJA_DE_ANOTACION,
  type Anotacion,
} from '@/entities/agenda';
import { marcaDeImportante, MUTACION_DE_MARCAS, type Proyecto } from '@/entities/proyecto';
import {
  COLUMNA_DE_LA_MARCA,
  filaPorId,
  type AnotacionNueva,
  type CambiosDeAnotacion,
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
