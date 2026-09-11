export type EstadoSync =
  | { tipo: 'sin-conexion'; pendientes: number }
  | { tipo: 'pendiente'; pendientes: number }
  | { tipo: 'rechazado'; rechazados: number }
  | { tipo: 'sincronizado' };

export function calcularEstadoSync(
  enLinea: boolean,
  pendientes: number,
  rechazados = 0,
): EstadoSync {
  if (!enLinea) return { tipo: 'sin-conexion', pendientes };
  if (pendientes > 0) return { tipo: 'pendiente', pendientes };
  if (rechazados > 0) return { tipo: 'rechazado', rechazados };
  return { tipo: 'sincronizado' };
}

export function describirEstadoSync(estado: EstadoSync): string {
  switch (estado.tipo) {
    case 'sin-conexion':
      if (estado.pendientes === 0) return 'Sin conexión. Estás viendo lo último que se sincronizó.';
      if (estado.pendientes === 1)
        return 'Sin conexión. 1 cambio se va a sincronizar cuando vuelva la señal.';
      return `Sin conexión. ${estado.pendientes} cambios se van a sincronizar cuando vuelva la señal.`;
    case 'pendiente':
      return estado.pendientes === 1
        ? 'Sincronizando 1 cambio…'
        : `Sincronizando ${estado.pendientes} cambios…`;
    case 'rechazado':
      return estado.rechazados === 1
        ? 'Hay 1 cambio que no se pudo guardar.'
        : `Hay ${estado.rechazados} cambios que no se pudieron guardar.`;
    case 'sincronizado':
      return 'Todo sincronizado.';
  }
}
