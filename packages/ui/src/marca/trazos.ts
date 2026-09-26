export interface TrazoDeLaMarca {
  d: string;
  grosor: number;
}

export const NOMBRE_DE_LA_APP = 'NUMA';

export const ALTO_DE_LA_MARCA = 200;

export const ANCHO_DEL_LOGOTIPO = 738;

export const ANCHO_DEL_ISOTIPO = 158;

export const GROSOR_DEL_TRAZO = 44;

export const GROSOR_DEL_TRAVESANO = 38;

export const TRAZO_DEL_ISOTIPO: TrazoDeLaMarca = {
  d: 'M22 178V22L136 178V22',
  grosor: GROSOR_DEL_TRAZO,
};

export const TRAZOS_DEL_LOGOTIPO: readonly TrazoDeLaMarca[] = [
  TRAZO_DEL_ISOTIPO,
  { d: 'M208 22V123A55 55 0 0 0 318 123V22', grosor: GROSOR_DEL_TRAZO },
  { d: 'M390 178V22L461 112L532 22V178', grosor: GROSOR_DEL_TRAZO },
  { d: 'M604 178V78A56 56 0 0 1 716 78V178', grosor: GROSOR_DEL_TRAZO },
  { d: 'M604 126H716', grosor: GROSOR_DEL_TRAVESANO },
];

export const CAJA_DEL_LOGOTIPO = `0 0 ${String(ANCHO_DEL_LOGOTIPO)} ${String(ALTO_DE_LA_MARCA)}`;

export const CAJA_DEL_ISOTIPO = `0 0 ${String(ANCHO_DEL_ISOTIPO)} ${String(ALTO_DE_LA_MARCA)}`;

export function trazosEnSvg(trazos: readonly TrazoDeLaMarca[], color: string): string {
  const caminos = trazos
    .map(({ d, grosor }) =>
      grosor === GROSOR_DEL_TRAZO
        ? `<path d="${d}"/>`
        : `<path d="${d}" stroke-width="${String(grosor)}"/>`,
    )
    .join('');
  return `<g fill="none" stroke="${color}" stroke-width="${String(GROSOR_DEL_TRAZO)}" stroke-linecap="round" stroke-linejoin="round">${caminos}</g>`;
}
