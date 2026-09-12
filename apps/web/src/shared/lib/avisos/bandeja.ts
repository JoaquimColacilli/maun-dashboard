import { useQuery, type QueryClient } from '@tanstack/react-query';

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

// La bandeja es una entrada más del cache, así que se persiste en IndexedDB con todo lo demás y
// sobrevive a cerrar la app. Un aviso se va cuando el usuario lo descarta, no cuando vence un
// reloj: es lo único que queda de una operación que el usuario da por hecha, y sobre todo de una
// liquidación, que mueve plata. El gcTime infinito (query-client.ts) es lo que impide que el
// recolector se la lleve cuando ninguna pantalla la está mirando.
export function avisosAnotados(queryClient: QueryClient): AvisoAnotado[] {
  return queryClient.getQueryData<AvisoAnotado[]>(CLAVE_DE_AVISOS) ?? [];
}

export function anotarAviso(queryClient: QueryClient, aviso: AvisoAnotado): void {
  queryClient.setQueryData<AvisoAnotado[]>(CLAVE_DE_AVISOS, (previos) => [
    ...(previos ?? []).filter((anotado) => anotado.id !== aviso.id),
    aviso,
  ]);
}

export function descartarAviso(queryClient: QueryClient, id: string): void {
  queryClient.setQueryData<AvisoAnotado[]>(CLAVE_DE_AVISOS, (previos) =>
    (previos ?? []).filter((anotado) => anotado.id !== id),
  );
}

// Un proyecto que vuelve a liquidarse bien se lleva sus rechazos: el aviso dejó de ser cierto. Los
// ajustes no se borran solos, porque siguen explicando por qué el reparto congelado es el que es.
export function limpiarRechazosDelProyecto(queryClient: QueryClient, proyectoId: string): void {
  queryClient.setQueryData<AvisoAnotado[]>(CLAVE_DE_AVISOS, (previos) =>
    (previos ?? []).filter(
      (anotado) => anotado.tipo !== 'rechazo' || anotado.proyectoId !== proyectoId,
    ),
  );
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
