export type ComoQuedo = 'copiado' | 'seleccionado' | 'nada';

type ComandoDeEdicion = (comando: string) => boolean;

// document.execCommand está obsoleto y es, justamente, el camino que rescata a los navegadores
// donde la API nueva no anda. Se busca por reflexión para no atarse a un tipo que ya no existe en
// las definiciones nuevas y para tolerar un entorno que no lo tenga (ADR 0048).
function elComandoDeEdicion(): ComandoDeEdicion | undefined {
  const propio: unknown = Reflect.get(document, 'execCommand');
  return typeof propio === 'function' ? (propio as ComandoDeEdicion).bind(document) : undefined;
}

type EscribirEnElPortapapeles = (texto: string) => Promise<void>;

// navigator.clipboard está tipado como si siempre existiera, y no es cierto: en http, en un
// navegador viejo o en una WebView vieja no está. Se busca igual que el comando de edición, por
// reflexión, para que el código tenga la forma que tiene la realidad (ADR 0048).
function elPortapapeles(): EscribirEnElPortapapeles | undefined {
  const propio: unknown = Reflect.get(navigator, 'clipboard');
  if (typeof propio !== 'object' || propio === null) return undefined;
  const escribir: unknown = Reflect.get(propio, 'writeText');
  return typeof escribir === 'function'
    ? (escribir as EscribirEnElPortapapeles).bind(propio)
    : undefined;
}

function queSePuedaSeleccionar(nodo: HTMLElement): void {
  nodo.style.userSelect = 'text';
  nodo.style.setProperty('-webkit-user-select', 'text');
}

function conElFantasma(texto: string): boolean {
  const comando = elComandoDeEdicion();
  if (comando === undefined) return false;

  let elEventoCorrio = false;

  const fantasma = document.createElement('span');
  fantasma.textContent = texto;
  fantasma.ariaHidden = 'true';
  fantasma.style.all = 'unset';
  fantasma.style.position = 'fixed';
  fantasma.style.top = '0';
  fantasma.style.clipPath = 'inset(50%)';
  fantasma.style.whiteSpace = 'pre';
  queSePuedaSeleccionar(fantasma);
  fantasma.addEventListener('copy', (evento) => {
    elEventoCorrio = true;
    evento.stopPropagation();
    evento.preventDefault();
    evento.clipboardData?.setData('text/plain', texto);
  });

  const seleccion = globalThis.getSelection();
  const antes = seleccion
    ? Array.from({ length: seleccion.rangeCount }, (_, indice) => seleccion.getRangeAt(indice))
    : [];

  document.body.append(fantasma);

  try {
    const rango = document.createRange();
    rango.selectNodeContents(fantasma);
    seleccion?.removeAllRanges();
    seleccion?.addRange(rango);
    return comando('copy') && elEventoCorrio;
  } catch {
    return false;
  } finally {
    seleccion?.removeAllRanges();
    for (const rango of antes) seleccion?.addRange(rango);
    fantasma.remove();
  }
}

export function seleccionarEnPantalla(nodo: HTMLElement | null): boolean {
  const seleccion = globalThis.getSelection();
  if (nodo === null || seleccion === null) return false;

  queSePuedaSeleccionar(nodo);

  try {
    const rango = document.createRange();
    rango.selectNodeContents(nodo);
    seleccion.removeAllRanges();
    seleccion.addRange(rango);
  } catch {
    return false;
  }

  return seleccion.toString().trim() !== '';
}

export async function copiar(texto: string, aMano?: HTMLElement | null): Promise<ComoQuedo> {
  const escribir = elPortapapeles();
  if (escribir !== undefined) {
    try {
      await escribir(texto);
      return 'copiado';
    } catch {
      // El navegador no dijo que copió: todavía no copiamos nada y sigue el camino de atrás.
    }
  }

  if (conElFantasma(texto)) return 'copiado';
  return seleccionarEnPantalla(aMano ?? null) ? 'seleccionado' : 'nada';
}
