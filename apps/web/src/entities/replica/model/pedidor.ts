export interface Pedidor {
  pedir: () => void;
  cancelar: () => void;
}

export interface OpcionesDelPedidor {
  traer: () => Promise<unknown>;
  yaTrae: () => boolean;
  minimoMs: number;
}

export function crearPedidor({ traer, yaTrae, minimoMs }: OpcionesDelPedidor): Pedidor {
  let ultimo = Number.NEGATIVE_INFINITY;
  let enVuelo = false;
  let otraVez = false;
  let cancelado = false;
  let reloj: ReturnType<typeof setTimeout> | undefined;

  function correr(): void {
    reloj = undefined;
    if (cancelado) return;
    if (enVuelo) {
      otraVez = true;
      return;
    }
    const espera = ultimo + minimoMs - Date.now();
    if (espera > 0) {
      reloj = setTimeout(correr, espera);
      return;
    }
    otraVez = yaTrae();
    ultimo = Date.now();
    enVuelo = true;
    void traer()
      .catch(() => undefined)
      .finally(() => {
        enVuelo = false;
        if (otraVez) {
          otraVez = false;
          pedir();
        }
      });
  }

  function pedir(): void {
    if (cancelado || reloj !== undefined) return;
    correr();
  }

  return {
    pedir,
    cancelar: () => {
      cancelado = true;
      clearTimeout(reloj);
      reloj = undefined;
    },
  };
}
