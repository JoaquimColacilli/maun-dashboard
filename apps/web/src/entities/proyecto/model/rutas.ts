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
