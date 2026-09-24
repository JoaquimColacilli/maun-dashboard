export interface HojaAbierta {
  cerrarYDespues: (despues: () => void) => void;
}

const abiertas: HojaAbierta[] = [];

export function anotarHojaAbierta(hoja: HojaAbierta): () => void {
  abiertas.push(hoja);
  return () => {
    const indice = abiertas.lastIndexOf(hoja);
    if (indice >= 0) abiertas.splice(indice, 1);
  };
}

export function hojaAbiertaArriba(): HojaAbierta | undefined {
  return abiertas.at(-1);
}
