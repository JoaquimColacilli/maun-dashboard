import { filasDe, type FilaDe, type Replica } from '@/shared/api';

export type Enlace = FilaDe<'enlaces_publicos'>;

export type EstadoDelEnlace = 'sin_enlace' | 'activo' | 'de_baja';

function delProyecto(replica: Replica, proyectoId: string): Enlace[] {
  return filasDe(replica, 'enlaces_publicos').filter((enlace) => enlace.proyecto_id === proyectoId);
}

export function enlaceActivo(replica: Replica, proyectoId: string): Enlace | undefined {
  return delProyecto(replica, proyectoId).find((enlace) => enlace.revocado_at === null);
}

export function estadoDelEnlace(replica: Replica, proyectoId: string): EstadoDelEnlace {
  const enlaces = delProyecto(replica, proyectoId);
  if (enlaces.length === 0) return 'sin_enlace';
  return enlaces.some((enlace) => enlace.revocado_at === null) ? 'activo' : 'de_baja';
}

export function vecesQueLoAbrio(enlace: Enlace): string {
  if (enlace.visitas === 0) return 'Todavía no lo abrió';
  if (enlace.visitas === 1) return 'Lo abrió una vez';
  return `Lo abrió ${String(enlace.visitas)} veces`;
}
