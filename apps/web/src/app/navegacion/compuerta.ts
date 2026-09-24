export const TOPE_DE_LO_RETENIDO_MS = 1_000;

export type QueHacerConElAtras = 'ahora' | 'retener';

type Oyente = EventListenerOrEventListenerObject;

export interface Compuerta {
  ventana: Window;
  alVolver: (decidir: (evento: Event) => QueHacerConElAtras) => void;
  entregarLoRetenido: () => void;
  hayAlgoRetenido: () => boolean;
  escuchaAlgo: () => boolean;
}

function llamar(oyente: Oyente, evento: Event): void {
  if (typeof oyente === 'function') oyente(evento);
  else oyente.handleEvent(evento);
}

export function crearCompuerta(real: Window): Compuerta {
  const oyentes = new Set<Oyente>();
  let decidir: (evento: Event) => QueHacerConElAtras = () => 'ahora';
  let retenido: (() => void) | null = null;
  let tope: ReturnType<typeof setTimeout> | undefined;

  const entregarLoRetenido = () => {
    const entregar = retenido;
    retenido = null;
    clearTimeout(tope);
    entregar?.();
  };

  const alPopstate = (evento: Event) => {
    const entregar = () => {
      for (const oyente of [...oyentes]) llamar(oyente, evento);
    };
    if (retenido !== null) return;
    if (decidir(evento) === 'ahora') {
      entregar();
      return;
    }
    retenido = entregar;
    tope = setTimeout(entregarLoRetenido, TOPE_DE_LO_RETENIDO_MS);
  };

  const agregar = (
    tipo: string,
    oyente: Oyente | null,
    opciones?: boolean | AddEventListenerOptions,
  ) => {
    if (oyente === null) return;
    if (tipo !== 'popstate') {
      real.addEventListener(tipo, oyente, opciones);
      return;
    }
    if (oyentes.size === 0) real.addEventListener('popstate', alPopstate);
    oyentes.add(oyente);
  };

  const sacar = (
    tipo: string,
    oyente: Oyente | null,
    opciones?: boolean | EventListenerOptions,
  ) => {
    if (oyente === null) return;
    if (tipo !== 'popstate') {
      real.removeEventListener(tipo, oyente, opciones);
      return;
    }
    oyentes.delete(oyente);
    if (oyentes.size === 0) real.removeEventListener('popstate', alPopstate);
  };

  const ventana = new Proxy(real, {
    get(objetivo, propiedad) {
      if (propiedad === 'addEventListener') return agregar;
      if (propiedad === 'removeEventListener') return sacar;
      const valor: unknown = Reflect.get(objetivo, propiedad, objetivo);
      return typeof valor === 'function'
        ? (valor as (...argumentos: unknown[]) => unknown).bind(objetivo)
        : valor;
    },
    set(objetivo, propiedad, valor) {
      return Reflect.set(objetivo, propiedad, valor, objetivo);
    },
    has(objetivo, propiedad) {
      return Reflect.has(objetivo, propiedad);
    },
  });

  return {
    ventana,
    alVolver: (nuevo) => {
      decidir = nuevo;
    },
    entregarLoRetenido,
    hayAlgoRetenido: () => retenido !== null,
    escuchaAlgo: () => oyentes.size > 0,
  };
}
