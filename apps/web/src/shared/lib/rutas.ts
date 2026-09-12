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

export function rutaDeAprobacion(id: string): string {
  return `/proyectos/${id}/aprobar`;
}

export const RUTA_DE_PROYECTO_NUEVO = '/proyectos/nuevo';

export const RUTA_DE_PROYECTOS = '/proyectos';

export const RUTA_DE_SEGUIMIENTO = '/seguimiento';

export const RUTA_DE_CONTACTO_NUEVO = '/seguimiento/nuevo';

export const RUTA_DE_FINANZAS = '/finanzas';

export const RUTA_DE_MOVIMIENTO_NUEVO = '/finanzas/nuevo';

export function rutaDeMovimientoNuevo(opciones: { clase?: string } = {}): string {
  return opciones.clase === undefined
    ? RUTA_DE_MOVIMIENTO_NUEVO
    : `${RUTA_DE_MOVIMIENTO_NUEVO}?${new URLSearchParams({ clase: opciones.clase }).toString()}`;
}

export function rutaDelMovimiento(id: string): string {
  return `/finanzas/${id}`;
}

export const RUTA_DE_DIEZMO = '/diezmo';
