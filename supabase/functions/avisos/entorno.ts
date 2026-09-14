export interface ClavesVapid {
  publica: string;
  privada: string;
  sujeto: string;
}

export interface Configuracion {
  vapid: ClavesVapid | null;
  secretoDelTrabajo: string | null;
  supabaseUrl: string;
  claveDelServidor: string;
}

export interface Entorno {
  get(nombre: string): string | undefined;
}

function leer(entorno: Entorno, nombre: string): string | null {
  const valor = entorno.get(nombre)?.trim();
  return valor === undefined || valor === '' ? null : valor;
}

function claveDelServidor(entorno: Entorno): string {
  const heredada = leer(entorno, 'SUPABASE_SERVICE_ROLE_KEY');
  if (heredada !== null) return heredada;
  const nuevas = leer(entorno, 'SUPABASE_SECRET_KEYS');
  if (nuevas === null) return '';
  try {
    const claves = JSON.parse(nuevas) as Record<string, unknown>;
    const primera = Object.values(claves).find((clave) => typeof clave === 'string');
    return typeof primera === 'string' ? primera : '';
  } catch {
    return '';
  }
}

export function configuracionDelEntorno(entorno: Entorno): Configuracion {
  const publica = leer(entorno, 'VAPID_PUBLIC_KEY');
  const privada = leer(entorno, 'VAPID_PRIVATE_KEY');
  const sujeto = leer(entorno, 'VAPID_SUBJECT');
  return {
    vapid:
      publica !== null && privada !== null && sujeto !== null ? { publica, privada, sujeto } : null,
    secretoDelTrabajo: leer(entorno, 'AVISOS_SECRETO'),
    supabaseUrl: leer(entorno, 'SUPABASE_URL') ?? '',
    claveDelServidor: claveDelServidor(entorno),
  };
}
