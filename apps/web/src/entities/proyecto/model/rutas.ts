export function rutaDelProyecto(id: string): string {
  return `/proyectos/${id}`;
}

export function rutaDeEdicion(id: string): string {
  return `/proyectos/${id}/editar`;
}

export const RUTA_DE_PROYECTO_NUEVO = '/proyectos/nuevo';
