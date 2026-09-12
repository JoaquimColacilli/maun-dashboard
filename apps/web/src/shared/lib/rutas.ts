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

function conVuelta(base: string, extras: Record<string, string | undefined>): string {
  const parametros = new URLSearchParams();
  for (const [clave, valor] of Object.entries(extras)) {
    if (valor !== undefined) parametros.set(clave, valor);
  }
  const cola = parametros.toString();
  return cola === '' ? base : `${base}?${cola}`;
}

export function rutaDeMovimientoNuevo(opciones: { clase?: string; volverA?: string } = {}): string {
  return conVuelta(RUTA_DE_MOVIMIENTO_NUEVO, opciones);
}

export function rutaDelMovimiento(id: string, volverA?: string): string {
  return conVuelta(`/finanzas/${id}`, { volverA });
}

export const RUTA_DE_DIEZMO = '/diezmo';
