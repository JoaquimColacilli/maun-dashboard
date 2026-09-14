export const TOPE_DE_UNA_CEREMONIA_MS = 30_000;

export const ESPERA_DE_LA_CEREMONIA_ANTERIOR_MS = 2_000;

export type DesenlaceDeLaCeremonia<T> =
  | { tipo: 'terminada'; valor: T }
  | { tipo: 'fallida'; error: unknown }
  | { tipo: 'cancelada-por-la-app' }
  | { tipo: 'sin-respuesta' };

export interface OpcionesDeLaCeremonia {
  signal?: AbortSignal;
  tope?: number | null;
  pasiva?: boolean;
}

interface CeremoniaEnCurso {
  control: AbortController;
  pasiva: boolean;
  terminada: Promise<void>;
}

let enCurso: CeremoniaEnCurso | null = null;

function esperar(milisegundos: number): Promise<void> {
  return new Promise((resolver) => {
    setTimeout(resolver, milisegundos);
  });
}

export async function conUnaSolaCeremonia<T>(
  ceremonia: (signal: AbortSignal) => Promise<T>,
  { signal, tope = TOPE_DE_UNA_CEREMONIA_MS, pasiva = false }: OpcionesDeLaCeremonia = {},
): Promise<DesenlaceDeLaCeremonia<T>> {
  if (signal?.aborted === true) return { tipo: 'cancelada-por-la-app' };
  if (pasiva && enCurso !== null && !enCurso.pasiva) return { tipo: 'cancelada-por-la-app' };

  const anterior = enCurso;
  const control = new AbortController();
  let terminar: () => void = () => undefined;
  const propia: CeremoniaEnCurso = {
    control,
    pasiva,
    terminada: new Promise((resolver) => {
      terminar = resolver;
    }),
  };
  enCurso = propia;

  const cancelarDesdeAfuera = () => {
    control.abort();
  };
  signal?.addEventListener('abort', cancelarDesdeAfuera, { once: true });
  let vencida = false;
  let reloj: ReturnType<typeof setTimeout> | undefined;

  const seCorto = (): boolean => control.signal.aborted;
  const cortada = (): DesenlaceDeLaCeremonia<T> =>
    vencida ? { tipo: 'sin-respuesta' } : { tipo: 'cancelada-por-la-app' };

  try {
    if (anterior !== null) {
      anterior.control.abort();
      await Promise.race([anterior.terminada, esperar(ESPERA_DE_LA_CEREMONIA_ANTERIOR_MS)]);
    }
    if (control.signal.aborted) return { tipo: 'cancelada-por-la-app' };

    if (tope !== null) {
      reloj = setTimeout(() => {
        vencida = true;
        control.abort();
      }, tope);
    }
    try {
      const valor = await ceremonia(control.signal);
      return seCorto() ? cortada() : { tipo: 'terminada', valor };
    } catch (error) {
      return seCorto() ? cortada() : { tipo: 'fallida', error };
    }
  } finally {
    clearTimeout(reloj);
    signal?.removeEventListener('abort', cancelarDesdeAfuera);
    if (enCurso === propia) enCurso = null;
    terminar();
  }
}
