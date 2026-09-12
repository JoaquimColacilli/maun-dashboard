const FORMATO = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

const FORMATO_CON_CENTAVOS = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
});

const FORMATO_LLANO = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });

// Para un input: los mismos separadores que lee parsearPesos, sin el símbolo de moneda.
export function pesosEditables(centavos: number): string {
  return FORMATO_LLANO.format(centavos / 100);
}

export function formatearPesos(centavos: number): string {
  const pesos = centavos / 100;
  return Number.isInteger(pesos) ? FORMATO.format(pesos) : FORMATO_CON_CENTAVOS.format(pesos);
}

function leerPesos(texto: string): number | undefined {
  const limpio = texto.replace(/[$\s]/g, '');
  if (limpio === '' || !/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+([.,]\d{1,2})?$/.test(limpio)) {
    return undefined;
  }

  const normalizado = limpio.includes(',')
    ? limpio.replace(/\./g, '').replace(',', '.')
    : limpio.replace(/\.(?=\d{3}(\D|$))/g, '');

  const pesos = Number(normalizado);
  if (!Number.isFinite(pesos) || pesos < 0) return undefined;
  return Math.round(pesos * 100);
}

export function parsearPesos(texto: string): number | undefined {
  const centavos = leerPesos(texto);
  return centavos === undefined || centavos === 0 ? undefined : centavos;
}

// Un movimiento de cero no existe, pero un objetivo de cero sí: "no me pago sueldo" o "todavía no
// tengo meta" son respuestas válidas de la primera configuración.
export function parsearPesosDesdeCero(texto: string): number | undefined {
  return leerPesos(texto);
}
