export interface Resorte {
  amortiguacion: number;
  rigidez: number;
}

export const RESORTES = {
  espacial: { amortiguacion: 0.9, rigidez: 700 },
  'espacial-rapido': { amortiguacion: 0.9, rigidez: 1400 },
  'espacial-lento': { amortiguacion: 0.9, rigidez: 300 },
  efectos: { amortiguacion: 1, rigidez: 1600 },
  'efectos-rapidos': { amortiguacion: 1, rigidez: 3800 },
  'efectos-lentos': { amortiguacion: 1, rigidez: 800 },
  'expresivo-rapido': { amortiguacion: 0.6, rigidez: 800 },
} as const satisfies Record<string, Resorte>;

export type NombreDeResorte = keyof typeof RESORTES;

export const TOLERANCIA_DEL_ASIENTO = 0.001;
const PASO_EN_SEGUNDOS = 0.0001;
const HASTA_SEGUNDOS = 5;
const PUNTOS_DE_LA_CURVA = 32;

export function posicionDelResorte({ amortiguacion, rigidez }: Resorte, segundos: number): number {
  if (amortiguacion > 1 || amortiguacion <= 0 || rigidez <= 0) {
    throw new RangeError('Solo resortes subamortiguados o críticos, con rigidez positiva.');
  }
  const natural = Math.sqrt(rigidez);
  if (amortiguacion === 1) return 1 - Math.exp(-natural * segundos) * (1 + natural * segundos);
  const amortiguada = natural * Math.sqrt(1 - amortiguacion * amortiguacion);
  const decaimiento = amortiguacion * natural;
  return (
    1 -
    Math.exp(-decaimiento * segundos) *
      (Math.cos(amortiguada * segundos) +
        (decaimiento / amortiguada) * Math.sin(amortiguada * segundos))
  );
}

export function milisegundosDeAsiento(resorte: Resorte): number {
  const pasos = Math.round(HASTA_SEGUNDOS / PASO_EN_SEGUNDOS);
  let ultimo = 0;
  for (let paso = 0; paso <= pasos; paso += 1) {
    const segundos = paso * PASO_EN_SEGUNDOS;
    if (Math.abs(posicionDelResorte(resorte, segundos) - 1) >= TOLERANCIA_DEL_ASIENTO) {
      ultimo = segundos;
    }
  }
  return Math.round(ultimo * 1000);
}

export function reboteDelResorte(resorte: Resorte): number {
  const pasos = Math.round(HASTA_SEGUNDOS / PASO_EN_SEGUNDOS);
  let mayor = 0;
  for (let paso = 0; paso <= pasos; paso += 1) {
    mayor = Math.max(mayor, posicionDelResorte(resorte, paso * PASO_EN_SEGUNDOS));
  }
  return Math.max(0, mayor - 1);
}

function conCuatroDecimales(valor: number): string {
  const redondeado = Math.round(valor * 10_000) / 10_000;
  return Object.is(redondeado, -0) ? '0' : String(redondeado);
}

export function curvaDelResorte(resorte: Resorte): string {
  const segundos = milisegundosDeAsiento(resorte) / 1000;
  const puntos = Array.from({ length: PUNTOS_DE_LA_CURVA + 1 }, (_, indice) => {
    if (indice === 0) return '0';
    if (indice === PUNTOS_DE_LA_CURVA) return '1';
    return conCuatroDecimales(
      posicionDelResorte(resorte, (segundos * indice) / PUNTOS_DE_LA_CURVA),
    );
  });
  return `linear(${puntos.join(', ')})`;
}

export function tokensDeLosResortes(): string[] {
  return Object.entries(RESORTES).flatMap(([nombre, resorte]) => [
    `--resorte-${nombre}: ${curvaDelResorte(resorte)};`,
    `--dur-${nombre}: ${String(milisegundosDeAsiento(resorte))}ms;`,
  ]);
}

export function duracionesSinMovimiento(): string[] {
  return Object.keys(RESORTES).map((nombre) => `--dur-${nombre}: 0ms;`);
}

export const MARCAS_DE_LOS_RESORTES = {
  tokens: [
    '/* resortes: los escribe `pnpm --filter @maun/ui resortes` */',
    '/* fin de los resortes */',
  ],
  sinMovimiento: [
    '/* resortes sin movimiento: los escribe `pnpm --filter @maun/ui resortes` */',
    '/* fin de los resortes sin movimiento */',
  ],
} as const;

export function sinEspacios(texto: string): string {
  return texto.replace(/\s+/g, '');
}

export function textoEntreMarcas(css: string, [inicio, fin]: readonly [string, string]): string {
  const desde = css.indexOf(inicio);
  const hasta = css.indexOf(fin, desde);
  if (desde < 0 || hasta < 0) return '';
  return css.slice(desde + inicio.length, hasta);
}

export function conLosResortes(css: string): string {
  const reemplazar = (
    texto: string,
    [inicio, fin]: readonly [string, string],
    lineas: readonly string[],
  ) => {
    const desde = texto.indexOf(inicio);
    const hasta = texto.indexOf(fin, desde);
    if (desde < 0 || hasta < 0) throw new Error(`Falta la marca «${inicio}» en theme.css.`);
    const sangria = texto.slice(texto.lastIndexOf('\n', desde) + 1, desde);
    const cuerpo = lineas.map((linea) => `${sangria}${linea}`).join('\n');
    return `${texto.slice(0, desde + inicio.length)}\n${cuerpo}\n${sangria}${texto.slice(hasta)}`;
  };
  return reemplazar(
    reemplazar(css, MARCAS_DE_LOS_RESORTES.tokens, tokensDeLosResortes()),
    MARCAS_DE_LOS_RESORTES.sinMovimiento,
    duracionesSinMovimiento(),
  );
}
