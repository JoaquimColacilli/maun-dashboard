import { useSyncExternalStore } from 'react';

export type PreferenciaDeTema = 'light' | 'dark' | 'system';

export const CLAVE_DEL_TEMA = 'maun:tema';

const OSCURO = '(prefers-color-scheme: dark)';

const COLOR_DE_LA_MESA: Readonly<Record<'light' | 'dark', string>> = {
  light: '#f2f1ed',
  dark: '#0b0b0b',
};

const oyentes = new Set<() => void>();

function esPreferencia(valor: unknown): valor is PreferenciaDeTema {
  return valor === 'light' || valor === 'dark' || valor === 'system';
}

function recordar(preferencia: PreferenciaDeTema): void {
  try {
    if (preferencia === 'system') localStorage.removeItem(CLAVE_DEL_TEMA);
    else localStorage.setItem(CLAVE_DEL_TEMA, preferencia);
  } catch {
    return;
  }
}

export function preferenciaDeTema(): PreferenciaDeTema {
  const actual = document.documentElement.dataset.theme;
  return esPreferencia(actual) ? actual : 'system';
}

function pintarLaBarraDeEstado(preferencia: PreferenciaDeTema): void {
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    const suyo = meta.getAttribute('media') === OSCURO ? 'dark' : 'light';
    meta.setAttribute('content', COLOR_DE_LA_MESA[preferencia === 'system' ? suyo : preferencia]);
  }
}

export function elegirTema(preferencia: PreferenciaDeTema): void {
  document.documentElement.dataset.theme = preferencia;
  pintarLaBarraDeEstado(preferencia);
  recordar(preferencia);
  for (const avisar of oyentes) avisar();
}

function sistemaOscuro(): boolean {
  return globalThis.matchMedia(OSCURO).matches;
}

function suscribir(avisar: () => void): () => void {
  oyentes.add(avisar);
  const consulta = globalThis.matchMedia(OSCURO);
  consulta.addEventListener('change', avisar);
  return () => {
    oyentes.delete(avisar);
    consulta.removeEventListener('change', avisar);
  };
}

export function useTema(): { preferencia: PreferenciaDeTema; oscuro: boolean } {
  const preferencia = useSyncExternalStore(suscribir, preferenciaDeTema, preferenciaDeTema);
  const oscuroDelSistema = useSyncExternalStore(suscribir, sistemaOscuro, () => false);
  return {
    preferencia,
    oscuro: preferencia === 'dark' || (preferencia === 'system' && oscuroDelSistema),
  };
}
