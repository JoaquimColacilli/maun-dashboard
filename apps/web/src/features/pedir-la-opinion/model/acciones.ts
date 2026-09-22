import { ESCALA_POR_DEFECTO, type TipoDePreguntaPropia } from '@maun/domain';
import type { QueryClient } from '@tanstack/react-query';

import {
  guardarPreguntaEnLaCola,
  mandarALaCola,
  MUTACION_DE_RECORDATORIO,
  paraGuardar,
  preguntaEnLaReplica,
  type FilaDeEncuesta,
  type FilaDePregunta,
} from '@/entities/opinion';
import {
  avisarEnPantalla,
  metaDeAvisos,
  olvidarToken,
  recordarToken,
  tokenDelEnlace,
  tokenNuevo,
  uuidv7,
  type NuevoAviso,
} from '@/shared/lib';

export type Avisador = (aviso: NuevoAviso) => void;

function claveDelToken(proyectoId: string): string {
  return `encuesta:${proyectoId}`;
}

export function tokenDelPedido(proyectoId: string): string {
  return tokenDelEnlace(claveDelToken(proyectoId)) ?? tokenNuevo();
}

export function guardarTokenDelPedido(proyectoId: string, token: string): void {
  recordarToken(claveDelToken(proyectoId), token);
}

export function olvidarTokenDelPedido(proyectoId: string): void {
  olvidarToken(claveDelToken(proyectoId));
}

export function recordar(
  cliente: QueryClient,
  encuesta: FilaDeEncuesta,
  momento: string = new Date().toISOString(),
): void {
  mandarALaCola(
    cliente,
    { ...MUTACION_DE_RECORDATORIO, meta: metaDeAvisos('recordatorio') },
    { encuesta, momento },
  );
}

export function agregarPropia(
  cliente: QueryClient,
  proyectoId: string,
  datos: { texto: string; tipo: TipoDePreguntaPropia },
  orden: number,
  avisar: Avisador = avisarEnPantalla,
): string {
  const id = uuidv7();
  guardarPreguntaEnLaCola(
    cliente,
    {
      id,
      serie: id,
      numero: 1,
      proyecto_id: proyectoId,
      orden,
      texto: datos.texto.trim(),
      tipo: datos.tipo,
      escala: datos.tipo === 'escala5' ? ESCALA_POR_DEFECTO : null,
      obligatoria: false,
      opciones: null,
      archivada_at: null,
      deleted_at: null,
    },
    false,
    null,
    'preguntaPropia',
  );
  avisar({
    clave: `propia-${id}`,
    tono: 'hecho',
    texto: 'La sumamos a la encuesta de este trabajo.',
  });
  return id;
}

export function sacarPropia(
  cliente: QueryClient,
  pregunta: FilaDePregunta,
  avisar: Avisador = avisarEnPantalla,
): void {
  guardarPreguntaEnLaCola(
    cliente,
    { ...paraGuardar(pregunta), deleted_at: new Date().toISOString() },
    false,
    pregunta,
    'preguntaPropia',
  );
  avisar({
    clave: `propia-fuera-${pregunta.id}`,
    tono: 'hecho',
    texto: 'Sacaste la pregunta.',
    accion: {
      etiqueta: 'Deshacer',
      alTocar: () => {
        guardarPreguntaEnLaCola(
          cliente,
          { ...paraGuardar(pregunta), deleted_at: null },
          false,
          preguntaEnLaReplica(cliente, pregunta.id) ?? null,
          'preguntaPropia',
        );
      },
    },
  });
}
