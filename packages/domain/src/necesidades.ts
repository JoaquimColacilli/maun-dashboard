export const TIPOS_DE_NECESIDAD = ['material', 'herraje', 'herramienta'] as const;

export type TipoDeNecesidad = (typeof TIPOS_DE_NECESIDAD)[number];

export const SUGERENCIAS_MAXIMAS = 6;

export interface ParaContar {
  tipo: TipoDeNecesidad;
  listo: boolean;
}

export interface SegmentoDeLoQueHaceFalta<T extends ParaContar> {
  tipo: TipoDeNecesidad;
  items: T[];
  listos: number;
}

export interface CuentaDeLoQueHaceFalta {
  cuantas: number;
  listas: number;
}

export function segmentosDeLoQueHaceFalta<T extends ParaContar>(
  items: readonly T[],
): SegmentoDeLoQueHaceFalta<T>[] {
  return TIPOS_DE_NECESIDAD.map((tipo) => {
    const delTipo = items.filter((item) => item.tipo === tipo);
    return {
      tipo,
      items: delTipo,
      listos: delTipo.filter((item) => item.listo).length,
    };
  });
}

export function cuentaDeLoQueHaceFalta(items: readonly ParaContar[]): CuentaDeLoQueHaceFalta {
  return segmentosDeLoQueHaceFalta(items).reduce<CuentaDeLoQueHaceFalta>(
    (cuenta, segmento) => ({
      cuantas: cuenta.cuantas + segmento.items.length,
      listas: cuenta.listas + segmento.listos,
    }),
    { cuantas: 0, listas: 0 },
  );
}

export interface NecesidadUsada {
  tipo: TipoDeNecesidad;
  nombre: string;
  usadaEn: string;
}

export interface NombreDelCatalogo {
  nombre: string;
  veces: number;
  ultimaVez: string;
}

export function claveDelNombre(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function compararDelCatalogo(uno: NombreDelCatalogo, otro: NombreDelCatalogo): number {
  if (uno.veces !== otro.veces) return otro.veces - uno.veces;
  if (uno.ultimaVez !== otro.ultimaVez) return uno.ultimaVez < otro.ultimaVez ? 1 : -1;
  return uno.nombre.localeCompare(otro.nombre, 'es');
}

export function catalogoDeNecesidades(
  usadas: readonly NecesidadUsada[],
  tipo: TipoDeNecesidad,
): NombreDelCatalogo[] {
  const porClave = new Map<string, NombreDelCatalogo>();

  for (const usada of usadas) {
    if (usada.tipo !== tipo) continue;
    const nombre = usada.nombre.trim();
    const clave = claveDelNombre(nombre);
    if (clave === '') continue;

    const previo = porClave.get(clave);
    if (previo === undefined) {
      porClave.set(clave, { nombre, veces: 1, ultimaVez: usada.usadaEn });
      continue;
    }
    porClave.set(clave, {
      nombre: usada.usadaEn >= previo.ultimaVez ? nombre : previo.nombre,
      veces: previo.veces + 1,
      ultimaVez: usada.usadaEn >= previo.ultimaVez ? usada.usadaEn : previo.ultimaVez,
    });
  }

  return [...porClave.values()].sort(compararDelCatalogo);
}

export function sugerenciasDeNecesidad(
  catalogo: readonly NombreDelCatalogo[],
  escrito: string,
  tope: number = SUGERENCIAS_MAXIMAS,
): NombreDelCatalogo[] {
  const buscado = claveDelNombre(escrito);
  if (buscado === '') return catalogo.slice(0, tope);

  const empiezan: NombreDelCatalogo[] = [];
  const contienen: NombreDelCatalogo[] = [];

  for (const entrada of catalogo) {
    const clave = claveDelNombre(entrada.nombre);
    if (clave === buscado) continue;
    if (clave.startsWith(buscado)) empiezan.push(entrada);
    else if (clave.includes(buscado)) contienen.push(entrada);
  }

  return [...empiezan, ...contienen].slice(0, tope);
}
