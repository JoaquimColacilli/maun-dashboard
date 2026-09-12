import type { QueryClient } from '@tanstack/react-query';

import {
  CLAVE_DE_BAJA_DE_CLIENTE,
  CLAVE_DE_CLIENTE,
  CLAVE_DE_CLIENTE_NUEVO,
  MUTACION_DE_BAJA_DE_CLIENTE,
  MUTACION_DE_CLIENTE,
  MUTACION_DE_CLIENTE_NUEVO,
} from '@/entities/cliente';
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
import {
  CLAVE_DE_AJUSTES,
  CLAVE_DEL_NOMBRE,
  MUTACION_DE_AJUSTES,
  MUTACION_DEL_NOMBRE,
} from '@/features/configurar-taller';
import { CLAVE_DE_MOVIMIENTO, MUTACION_DE_MOVIMIENTO } from '@/features/registrar-movimiento';

type RegistroDeMutacion = (queryClient: QueryClient) => void;

const mutacionesPersistibles: readonly RegistroDeMutacion[] = [
  (queryClient) => {
    queryClient.setMutationDefaults(CLAVE_DE_MOVIMIENTO, MUTACION_DE_MOVIMIENTO);
  },
  (queryClient) => {
    queryClient.setMutationDefaults(CLAVE_DE_AJUSTES, MUTACION_DE_AJUSTES);
  },
  (queryClient) => {
    queryClient.setMutationDefaults(CLAVE_DEL_NOMBRE, MUTACION_DEL_NOMBRE);
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
];

export function registrarMutacionesPersistibles(queryClient: QueryClient): void {
  for (const registrar of mutacionesPersistibles) registrar(queryClient);
}
