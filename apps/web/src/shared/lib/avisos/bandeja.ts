import { useQuery, type QueryClient } from '@tanstack/react-query';

import { guardarCacheAhora } from '../cache/guardado';

export const CLAVE_DE_AVISOS = ['avisos'] as const;

export type TipoDeAviso = 'rechazo' | 'ajuste';

export interface AvisoAnotado {
  id: string;
  tipo: TipoDeAviso;
  cuando: string;
  operacion: string;
  sujeto: string;
  titulo: string;
  detalle: string;
  codigo: string;
  proyectoId: string | null;
  ruta: string | null;
}

export function avisosAnotados(queryClient: QueryClient): AvisoAnotado[] {
  return queryClient.getQueryData<AvisoAnotado[]>(CLAVE_DE_AVISOS) ?? [];
}

export function anotarAviso(queryClient: QueryClient, aviso: AvisoAnotado): Promise<void> {
  queryClient.setQueryData<AvisoAnotado[]>(CLAVE_DE_AVISOS, (previos) => [
    ...(previos ?? []).filter((anotado) => anotado.id !== aviso.id),
    aviso,
  ]);
  return guardarCacheAhora();
}

export function descartarAviso(queryClient: QueryClient, id: string): Promise<void> {
  queryClient.setQueryData<AvisoAnotado[]>(CLAVE_DE_AVISOS, (previos) =>
    (previos ?? []).filter((anotado) => anotado.id !== id),
  );
  return guardarCacheAhora();
}

export function limpiarRechazosDelProyecto(
  queryClient: QueryClient,
  proyectoId: string,
): Promise<void> {
  queryClient.setQueryData<AvisoAnotado[]>(CLAVE_DE_AVISOS, (previos) =>
    (previos ?? []).filter(
      (anotado) => anotado.tipo !== 'rechazo' || anotado.proyectoId !== proyectoId,
    ),
  );
  return guardarCacheAhora();
}

const SIN_AVISOS: readonly AvisoAnotado[] = [];

export function useAvisos(): readonly AvisoAnotado[] {
  const { data } = useQuery({
    queryKey: CLAVE_DE_AVISOS,
    queryFn: () => [] as AvisoAnotado[],
    gcTime: Infinity,
    staleTime: Infinity,
  });
  return data ?? SIN_AVISOS;
}

export function useAvisosDelProyecto(proyectoId: string): readonly AvisoAnotado[] {
  const avisos = useAvisos();
  return avisos.filter((aviso) => aviso.proyectoId === proyectoId);
}
