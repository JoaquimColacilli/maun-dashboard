export const PARAMETRO_DE_LA_CAMARA_LENTA = 'camara-lenta';
export const CLAVE_DE_LA_CAMARA_LENTA = 'maun:camara-lenta';
export const VECES_MAS_LENTA = 5;

export interface AlmacenDeLaCamaraLenta {
  getItem: (clave: string) => string | null;
  setItem: (clave: string, valor: string) => void;
  removeItem: (clave: string) => void;
}

export interface CamaraLenta {
  activa: boolean;
  direccionLimpia: string | null;
}

const APAGADA = new Set(['0', 'no']);

function recordada(almacen: AlmacenDeLaCamaraLenta | null): boolean {
  try {
    return almacen?.getItem(CLAVE_DE_LA_CAMARA_LENTA) === '1';
  } catch {
    return false;
  }
}

function recordar(almacen: AlmacenDeLaCamaraLenta | null, activa: boolean): void {
  try {
    if (activa) almacen?.setItem(CLAVE_DE_LA_CAMARA_LENTA, '1');
    else almacen?.removeItem(CLAVE_DE_LA_CAMARA_LENTA);
  } catch {
    return;
  }
}

export function leerLaCamaraLenta(url: URL, almacen: AlmacenDeLaCamaraLenta | null): CamaraLenta {
  const pedido = url.searchParams.get(PARAMETRO_DE_LA_CAMARA_LENTA);
  if (pedido === null) return { activa: recordada(almacen), direccionLimpia: null };
  const activa = !APAGADA.has(pedido);
  recordar(almacen, activa);
  const limpia = new URL(url);
  limpia.searchParams.delete(PARAMETRO_DE_LA_CAMARA_LENTA);
  return { activa, direccionLimpia: `${limpia.pathname}${limpia.search}${limpia.hash}` };
}

function almacenDeLaSesion(): AlmacenDeLaCamaraLenta | null {
  try {
    return globalThis.sessionStorage;
  } catch {
    return null;
  }
}

export function ponerLaCamaraLenta(): void {
  const camara = leerLaCamaraLenta(new URL(globalThis.location.href), almacenDeLaSesion());
  if (camara.direccionLimpia !== null) {
    globalThis.history.replaceState(globalThis.history.state, '', camara.direccionLimpia);
  }
  if (camara.activa) {
    document.documentElement.style.setProperty('--camara-lenta', String(VECES_MAS_LENTA));
  }
}
