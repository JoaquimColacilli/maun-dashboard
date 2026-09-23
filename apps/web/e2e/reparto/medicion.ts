export interface Excepcion {
  selector: string;
  motivo: string;
}

export interface HuecoMedido {
  contenedor: string;
  columnas: number;
  hueco: number;
  exento: string | null;
}

export interface DesordenMedido {
  contenedor: string;
  antes: string;
  despues: string;
  exento: string | null;
}

export interface Medicion {
  visible: number;
  columnas: number;
  hueco: number;
  huecos: HuecoMedido[];
  franja: number | null;
  desorden: DesordenMedido[];
  alto: number;
}

export function medirElReparto(excepciones: readonly Excepcion[]): Medicion {
  const dialogo = document.querySelector('dialog[open]');
  const principal = document.querySelector<HTMLElement>('main#contenido');
  const raiz = dialogo ?? principal ?? document.querySelector('main') ?? document.body;
  const visible =
    principal !== null && raiz === principal ? principal.clientHeight : window.innerHeight;
  const alto = raiz.scrollHeight;

  const REEMPLAZADOS = new Set([
    'IMG',
    'SVG',
    'INPUT',
    'TEXTAREA',
    'SELECT',
    'BUTTON',
    'VIDEO',
    'CANVAS',
    'PROGRESS',
    'METER',
    'IFRAME',
    'HR',
  ]);

  const transparente = (color: string) =>
    color === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(color) || color.endsWith(' / 0)');

  const conBorde = (estilo: CSSStyleDeclaration) =>
    (['Top', 'Right', 'Bottom', 'Left'] as const).some(
      (lado) =>
        Number.parseFloat(estilo.getPropertyValue(`border-${lado.toLowerCase()}-width`)) > 0 &&
        estilo.getPropertyValue(`border-${lado.toLowerCase()}-style`) !== 'none' &&
        !transparente(estilo.getPropertyValue(`border-${lado.toLowerCase()}-color`)),
    );

  interface Tinta {
    arriba: number;
    abajo: number;
    izquierda: number;
  }

  const tintas = new Map<Element, Tinta | null>();

  const sumar = (actual: Tinta | null, otra: Tinta | null): Tinta | null => {
    if (otra === null) return actual;
    if (actual === null) return { ...otra };
    return {
      arriba: Math.min(actual.arriba, otra.arriba),
      abajo: Math.max(actual.abajo, otra.abajo),
      izquierda: Math.min(actual.izquierda, otra.izquierda),
    };
  };

  const rango = document.createRange();

  const recorrer = (elemento: Element): Tinta | null => {
    const estilo = getComputedStyle(elemento);
    if (estilo.display === 'none' || estilo.visibility === 'hidden') {
      tintas.set(elemento, null);
      return null;
    }
    const caja = elemento.getBoundingClientRect();
    if (estilo.position === 'fixed' && elemento !== raiz) {
      tintas.set(elemento, null);
      return null;
    }
    if (caja.width < 2 || caja.height < 2) {
      if (estilo.overflow !== 'visible' || estilo.display === 'contents') {
        tintas.set(elemento, null);
        return null;
      }
    }
    let tinta: Tinta | null = null;
    const opaco = Number(estilo.opacity) > 0;
    if (
      opaco &&
      caja.width >= 2 &&
      caja.height >= 2 &&
      (REEMPLAZADOS.has(elemento.tagName.toUpperCase()) ||
        !transparente(estilo.backgroundColor) ||
        estilo.backgroundImage !== 'none' ||
        conBorde(estilo))
    ) {
      tinta = { arriba: caja.top, abajo: caja.bottom, izquierda: caja.left };
    }
    for (const hijo of Array.from(elemento.childNodes)) {
      if (hijo.nodeType === Node.TEXT_NODE) {
        if (!opaco || (hijo.textContent ?? '').trim() === '') continue;
        rango.selectNodeContents(hijo);
        for (const renglon of Array.from(rango.getClientRects())) {
          if (renglon.width < 1 || renglon.height < 1) continue;
          tinta = sumar(tinta, {
            arriba: renglon.top,
            abajo: renglon.bottom,
            izquierda: renglon.left,
          });
        }
      } else if (hijo instanceof Element) {
        tinta = sumar(tinta, recorrer(hijo));
      }
    }
    tintas.set(elemento, tinta);
    return tinta;
  };

  recorrer(raiz);

  const describir = (elemento: Element): string => {
    const partes: string[] = [];
    let actual: Element | null = elemento;
    while (actual && actual !== raiz && partes.length < 4) {
      const reparto = actual.getAttribute('data-reparto');
      const nombre = actual.getAttribute('aria-label');
      const titulo = actual.querySelector('h1, h2, h3')?.textContent.trim().slice(0, 40);
      const etiqueta = actual.tagName.toLowerCase();
      if (reparto !== null) partes.push(`${etiqueta}[data-reparto=${reparto}]`);
      else if (nombre !== null) partes.push(`${etiqueta}«${nombre.slice(0, 40)}»`);
      else if (titulo) partes.push(`${etiqueta} con «${titulo}»`);
      else partes.push(etiqueta);
      if (reparto !== null || nombre !== null) break;
      actual = actual.parentElement;
    }
    return partes.join(' < ');
  };

  const motivoDe = (elemento: Element): string | null => {
    for (const excepcion of excepciones) {
      if (elemento.matches(excepcion.selector)) return excepcion.motivo;
    }
    return null;
  };

  const enFlujo = (contenedor: Element): Element[] =>
    Array.from(contenedor.children).filter((hijo) => {
      const estilo = getComputedStyle(hijo);
      if (estilo.display === 'none' || estilo.display === 'contents') return false;
      if (estilo.position === 'absolute' || estilo.position === 'fixed') return false;
      const caja = hijo.getBoundingClientRect();
      return caja.width >= 2 && caja.height >= 2;
    });

  const huecos: HuecoMedido[] = [];
  const desorden: DesordenMedido[] = [];
  let columnasMaximas = 1;

  for (const contenedor of [raiz, ...Array.from(raiz.querySelectorAll('*'))]) {
    if (tintas.get(contenedor) === undefined) continue;
    if (contenedor instanceof SVGElement) continue;
    const estilo = getComputedStyle(contenedor);
    const esGrilla = estilo.display === 'grid' || estilo.display === 'inline-grid';
    const esFila =
      (estilo.display === 'flex' || estilo.display === 'inline-flex') &&
      estilo.flexDirection.startsWith('row');
    const esColumna =
      (estilo.display === 'flex' || estilo.display === 'inline-flex') &&
      estilo.flexDirection.startsWith('column');
    if (!esGrilla && !esFila && !esColumna && estilo.display !== 'block') continue;
    const piezas = enFlujo(contenedor);
    if (piezas.length < 2) continue;
    const cajas = piezas.map((pieza) => pieza.getBoundingClientRect());
    const excepcion = motivoDe(contenedor);

    for (let i = 0; i < piezas.length; i += 1) {
      const a = cajas[i];
      if (!a) continue;
      for (let j = i + 1; j < piezas.length; j += 1) {
        const b = cajas[j];
        if (!b) continue;
        const arriba = b.bottom <= a.top - 1;
        const solape = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        const izquierda = b.right <= a.left + 1 && solape > 1;
        if (arriba || izquierda) {
          desorden.push({
            contenedor: describir(contenedor),
            antes: describir(piezas[i] ?? contenedor),
            despues: describir(piezas[j] ?? contenedor),
            exento: excepcion,
          });
        }
      }
    }

    if (!esGrilla && !esFila) continue;

    const ancho = contenedor.getBoundingClientRect().width;
    const angostas = piezas
      .map((pieza, indice) => ({ pieza, caja: cajas[indice] }))
      .filter(({ caja }) => caja !== undefined && caja.width < ancho * 0.9);
    const pistas: { izquierda: number; derecha: number }[] = [];
    for (const { caja } of [...angostas].sort(
      (x, y) => (x.caja?.left ?? 0) - (y.caja?.left ?? 0),
    )) {
      if (!caja) continue;
      const ultima = pistas.at(-1);
      if (ultima && caja.left < ultima.derecha - 1) {
        ultima.derecha = Math.max(ultima.derecha, caja.right);
      } else {
        pistas.push({ izquierda: caja.left, derecha: caja.right });
      }
    }
    if (pistas.length < 2) continue;

    const separacion = Number.parseFloat(estilo.rowGap) || 0;
    const porPista = pistas.map((pista) => {
      const intervalos: { arriba: number; abajo: number }[] = [];
      let pegada = false;
      piezas.forEach((pieza, indice) => {
        const caja = cajas[indice];
        if (!caja) return;
        const cubre = Math.min(caja.right, pista.derecha) - Math.max(caja.left, pista.izquierda);
        if (cubre <= (pista.derecha - pista.izquierda) * 0.5) return;
        if (getComputedStyle(pieza).position === 'sticky') pegada = true;
        const tinta = tintas.get(pieza);
        if (tinta) intervalos.push({ arriba: tinta.arriba, abajo: tinta.abajo });
      });
      intervalos.sort((x, y) => x.arriba - y.arriba);
      return { intervalos, pegada };
    });

    const conTinta = porPista.filter((pista) => pista.intervalos.length > 0);
    if (conTinta.length < 2) continue;
    columnasMaximas = Math.max(columnasMaximas, conTinta.length);
    const techo = Math.min(...conTinta.map((pista) => pista.intervalos[0]?.arriba ?? Infinity));
    const piso = Math.max(
      ...conTinta.map((pista) => Math.max(...pista.intervalos.map((intervalo) => intervalo.abajo))),
    );

    let peor = 0;
    let pegadaEnElPeor = false;
    for (const pista of conTinta) {
      let hueco = (pista.intervalos[0]?.arriba ?? techo) - techo;
      let hasta = pista.intervalos[0]?.abajo ?? techo;
      for (const intervalo of pista.intervalos.slice(1)) {
        if (intervalo.arriba > hasta)
          hueco = Math.max(hueco, intervalo.arriba - hasta - separacion);
        hasta = Math.max(hasta, intervalo.abajo);
      }
      hueco = Math.max(hueco, piso - hasta);
      if (hueco > peor) {
        peor = hueco;
        pegadaEnElPeor = pista.pegada;
      }
    }

    if (peor >= 24) {
      huecos.push({
        contenedor: describir(contenedor),
        columnas: conTinta.length,
        hueco: Math.round(peor),
        exento:
          excepcion ??
          (pegadaEnElPeor
            ? 'la columna corta es un panel de apoyo pegado: la sigue al scrollear'
            : null),
      });
    }
  }

  huecos.sort((x, y) => y.hueco - x.hueco);

  const navegacion = document.querySelector('nav[aria-label="Principal"]');
  const borde = navegacion?.getBoundingClientRect();
  let franja: number | null = null;
  if (borde && borde.left < 1 && raiz === principal) {
    let izquierda = Infinity;
    for (const [elemento, tinta] of tintas) {
      if (!tinta || !REEMPLAZADOS.has(elemento.tagName.toUpperCase())) continue;
      izquierda = Math.min(izquierda, elemento.getBoundingClientRect().left);
    }
    const caminante = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
    for (let nodo = caminante.nextNode(); nodo; nodo = caminante.nextNode()) {
      const padre = nodo.parentElement;
      if (!padre || !tintas.get(padre) || (nodo.textContent ?? '').trim() === '') continue;
      rango.selectNodeContents(nodo);
      for (const renglon of Array.from(rango.getClientRects())) {
        if (renglon.width >= 1 && renglon.height >= 1)
          izquierda = Math.min(izquierda, renglon.left);
      }
    }
    if (Number.isFinite(izquierda)) franja = Math.round(izquierda - borde.right);
  }

  const peorSinExcepcion = huecos.find((hueco) => hueco.exento === null)?.hueco ?? 0;

  return {
    visible,
    columnas: columnasMaximas,
    hueco: peorSinExcepcion,
    huecos: huecos.slice(0, 6),
    franja,
    desorden: desorden.slice(0, 12),
    alto,
  };
}
