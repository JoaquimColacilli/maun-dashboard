export function rutaDelProyecto(id: string): string {
  return `/proyectos/${id}`;
}

export function rutaDeEdicion(id: string): string {
  return `/proyectos/${id}/editar`;
}

export function rutaDeCobro(id: string): string {
  return `/proyectos/${id}/cobrar`;
}

export function rutaDeCierre(id: string): string {
  return `/proyectos/${id}/cerrar`;
}

export const RUTA_DE_PROYECTO_NUEVO = '/proyectos/nuevo';

export const RUTA_DE_FINANZAS = '/finanzas';

export const RUTA_DE_MOVIMIENTO_NUEVO = '/finanzas/nuevo';

export function rutaDelMovimiento(id: string): string {
  return `/finanzas/${id}`;
}

export const RUTA_DE_DIEZMO = '/diezmo';
