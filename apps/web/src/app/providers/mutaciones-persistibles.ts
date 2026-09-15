import type { QueryClient } from '@tanstack/react-query';

import {
  CLAVE_DE_ANOTACION,
  CLAVE_DE_ANOTACION_NUEVA,
  CLAVE_DE_BAJA_DE_ANOTACION,
  MUTACION_DE_ANOTACION,
  MUTACION_DE_ANOTACION_NUEVA,
  MUTACION_DE_BAJA_DE_ANOTACION,
} from '@/entities/agenda';
import {
  CLAVE_DE_BAJA_DE_CLIENTE,
  CLAVE_DE_CLIENTE,
  CLAVE_DE_CLIENTE_NUEVO,
  MUTACION_DE_BAJA_DE_CLIENTE,
  MUTACION_DE_CLIENTE,
  MUTACION_DE_CLIENTE_NUEVO,
} from '@/entities/cliente';
import {
  CLAVE_DE_BAJA_DE_MOVIMIENTO,
  CLAVE_DE_EDICION_DE_MOVIMIENTO,
  CLAVE_DE_MOVIMIENTO,
  MUTACION_DE_BAJA_DE_MOVIMIENTO,
  MUTACION_DE_EDICION_DE_MOVIMIENTO,
  MUTACION_DE_MOVIMIENTO,
} from '@/entities/movimiento';
import {
  CLAVE_DE_BAJA_DE_PROYECTO,
  CLAVE_DE_LIQUIDACION,
  CLAVE_DE_NOTAS,
  CLAVE_DE_PROYECTO,
  CLAVE_DE_REVERSION,
  MUTACION_DE_BAJA_DE_PROYECTO,
  MUTACION_DE_LIQUIDACION,
  MUTACION_DE_NOTAS,
  MUTACION_DE_PROYECTO,
  MUTACION_DE_REVERSION,
} from '@/entities/proyecto';
import { CLAVE_DEL_PERFIL, MUTACION_DEL_PERFIL } from '@/entities/sesion';
import {
  CLAVE_DE_AJUSTES,
  CLAVE_DEL_NOMBRE,
  MUTACION_DE_AJUSTES,
  MUTACION_DEL_NOMBRE,
} from '@/features/configurar-taller';
type RegistroDeMutacion = (queryClient: QueryClient) => void;

const mutacionesPersistibles: readonly RegistroDeMutacion[] = [
  (queryClient) => {
    queryClient.setMutationDefaults(CLAVE_DE_MOVIMIENTO, MUTACION_DE_MOVIMIENTO);
  },
  (queryClient) => {
    queryClient.setMutationDefaults(
      CLAVE_DE_EDICION_DE_MOVIMIENTO,
      MUTACION_DE_EDICION_DE_MOVIMIENTO,
    );
  },
  (queryClient) => {
    queryClient.setMutationDefaults(CLAVE_DE_BAJA_DE_MOVIMIENTO, MUTACION_DE_BAJA_DE_MOVIMIENTO);
  },
  (queryClient) => {
    queryClient.setMutationDefaults(CLAVE_DE_AJUSTES, MUTACION_DE_AJUSTES);
  },
  (queryClient) => {
    queryClient.setMutationDefaults(CLAVE_DEL_NOMBRE, MUTACION_DEL_NOMBRE);
  },
  (queryClient) => {
    queryClient.setMutationDefaults(CLAVE_DEL_PERFIL, MUTACION_DEL_PERFIL);
  },
  (queryClient) => {
    queryClient.setMutationDefaults(CLAVE_DE_CLIENTE_NUEVO, MUTACION_DE_CLIENTE_NUEVO);
  },
  (queryClient) => {
    queryClient.setMutationDefaults(CLAVE_DE_CLIENTE, MUTACION_DE_CLIENTE);
  },
  (queryClient) => {
    queryClient.setMutationDefaults(CLAVE_DE_BAJA_DE_CLIENTE, MUTACION_DE_BAJA_DE_CLIENTE);
  },
  (queryClient) => {
    queryClient.setMutationDefaults(CLAVE_DE_PROYECTO, MUTACION_DE_PROYECTO);
  },
  (queryClient) => {
    queryClient.setMutationDefaults(CLAVE_DE_NOTAS, MUTACION_DE_NOTAS);
  },
  (queryClient) => {
    queryClient.setMutationDefaults(CLAVE_DE_BAJA_DE_PROYECTO, MUTACION_DE_BAJA_DE_PROYECTO);
  },
  (queryClient) => {
    queryClient.setMutationDefaults(CLAVE_DE_LIQUIDACION, MUTACION_DE_LIQUIDACION);
  },
  (queryClient) => {
    queryClient.setMutationDefaults(CLAVE_DE_REVERSION, MUTACION_DE_REVERSION);
  },
  (queryClient) => {
    queryClient.setMutationDefaults(CLAVE_DE_ANOTACION_NUEVA, MUTACION_DE_ANOTACION_NUEVA);
  },
  (queryClient) => {
    queryClient.setMutationDefaults(CLAVE_DE_ANOTACION, MUTACION_DE_ANOTACION);
  },
  (queryClient) => {
    queryClient.setMutationDefaults(CLAVE_DE_BAJA_DE_ANOTACION, MUTACION_DE_BAJA_DE_ANOTACION);
  },
];

export function registrarMutacionesPersistibles(queryClient: QueryClient): void {
  for (const registrar of mutacionesPersistibles) registrar(queryClient);
}
