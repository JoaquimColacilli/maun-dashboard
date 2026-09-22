import type { PreguntaDeLaEncuesta } from './opiniones.ts';

export const LARGO_MAXIMO_DE_LA_RESPUESTA = 2000;

export const MOTIVOS_DEL_RECHAZO = [
  'forma',
  'ajena',
  'repetida',
  'tipo',
  'rango',
  'vacio',
  'largo',
  'obligatoria',
] as const;

export type MotivoDelRechazo = (typeof MOTIVOS_DEL_RECHAZO)[number];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALGO_ESCRITO = /[^ \t\n\r\f\v]/;

const BLANCOS_DE_LAS_PUNTAS = /^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g;

export function tieneTexto(texto: string): boolean {
  return ALGO_ESCRITO.test(texto);
}

export function sinBlancosEnLasPuntas(texto: string): string {
  return texto.replace(BLANCOS_DE_LAS_PUNTAS, '');
}

export function largoDelTexto(texto: string): number {
  return Array.from(texto).length;
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function tieneJusto(objeto: Record<string, unknown>, claves: readonly string[]): boolean {
  const suyas = Object.keys(objeto).sort();
  return suyas.length === claves.length && suyas.every((clave, indice) => clave === claves[indice]);
}

function esEntero(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isInteger(valor);
}

function rangoDe(pregunta: PreguntaDeLaEncuesta): readonly [number, number] {
  if (pregunta.tipo === 'escala5') return [1, 5];
  if (pregunta.tipo === 'sitalvezno') return [1, 3];
  return [0, (pregunta.opciones ?? []).length - 1];
}

function motivoDelValor(pregunta: PreguntaDeLaEncuesta, valor: unknown): MotivoDelRechazo | null {
  const [minimo, maximo] = rangoDe(pregunta);
  switch (pregunta.tipo) {
    case 'escala5':
    case 'sitalvezno':
    case 'una':
      if (!esEntero(valor)) return 'tipo';
      return valor < minimo || valor > maximo ? 'rango' : null;
    case 'varias': {
      if (!Array.isArray(valor)) return 'tipo';
      const lista: readonly unknown[] = valor;
      if (!lista.every(esEntero)) return 'tipo';
      if (lista.length === 0) return 'vacio';
      const fuera = lista.some((elegido) => elegido < minimo || elegido > maximo);
      return fuera || new Set(lista).size !== lista.length ? 'rango' : null;
    }
    case 'texto':
      if (typeof valor !== 'string') return 'tipo';
      if (!tieneTexto(valor)) return 'vacio';
      return largoDelTexto(sinBlancosEnLasPuntas(valor)) > LARGO_MAXIMO_DE_LA_RESPUESTA
        ? 'largo'
        : null;
  }
}

export function validarRespuesta(
  preguntas: readonly PreguntaDeLaEncuesta[],
  respuesta: unknown,
): MotivoDelRechazo | null {
  if (!esObjeto(respuesta) || !tieneJusto(respuesta, ['id', 'renglones'])) return 'forma';
  if (typeof respuesta.id !== 'string' || !UUID.test(respuesta.id)) return 'forma';
  if (!Array.isArray(respuesta.renglones)) return 'forma';
  const renglones: readonly unknown[] = respuesta.renglones;

  const vistas = new Set<string>();
  for (const renglon of renglones) {
    if (
      !esObjeto(renglon) ||
      !tieneJusto(renglon, ['pregunta', 'valor']) ||
      typeof renglon.pregunta !== 'string'
    ) {
      return 'forma';
    }
    const id = renglon.pregunta;
    const pregunta = preguntas.find((candidata) => candidata.id === id);
    if (!pregunta) return 'ajena';
    if (vistas.has(id)) return 'repetida';
    vistas.add(id);
    const motivo = motivoDelValor(pregunta, renglon.valor);
    if (motivo !== null) return motivo;
  }

  return preguntas.some((pregunta) => pregunta.obligatoria && !vistas.has(pregunta.id))
    ? 'obligatoria'
    : null;
}

export type ValorDelFormulario = number | readonly number[] | string;

export type ValoresDelFormulario = Readonly<Partial<Record<string, ValorDelFormulario>>>;

function estaContestado(valor: ValorDelFormulario | undefined): valor is ValorDelFormulario {
  if (valor === undefined) return false;
  if (typeof valor === 'string') return tieneTexto(valor);
  return typeof valor === 'number' || valor.length > 0;
}

export function faltantes(
  preguntas: readonly PreguntaDeLaEncuesta[],
  valores: ValoresDelFormulario,
): string[] {
  return preguntas
    .filter((pregunta) => pregunta.obligatoria && !estaContestado(valores[pregunta.id]))
    .map((pregunta) => pregunta.id);
}

export interface RenglonDelFormulario {
  pregunta: string;
  valor: ValorDelFormulario;
}

export interface RespuestaDelFormulario {
  id: string;
  renglones: RenglonDelFormulario[];
}

export function armarRespuesta(
  id: string,
  preguntas: readonly PreguntaDeLaEncuesta[],
  valores: ValoresDelFormulario,
): RespuestaDelFormulario {
  return {
    id,
    renglones: preguntas.flatMap((pregunta) => {
      const valor = valores[pregunta.id];
      if (!estaContestado(valor)) return [];
      return [
        {
          pregunta: pregunta.id,
          valor: typeof valor === 'string' ? sinBlancosEnLasPuntas(valor) : valor,
        },
      ];
    }),
  };
}

export const LARGO_MAXIMO_DEL_LINK_DE_RESENA = 300;

export const HOSTS_DE_RESENA = [
  'g.page',
  'search.google.com',
  'maps.google.com',
  'www.google.com',
  'google.com',
  'maps.app.goo.gl',
  'g.co',
] as const;

const LINK_DE_RESENA =
  /^https:\/\/(?:g\.page|search\.google\.com|maps\.google\.com|www\.google\.com|google\.com|maps\.app\.goo\.gl|g\.co)\/\S*$/;

const SOLO_EL_HOST_DE_RESENA =
  /^https:\/\/(?:g\.page|search\.google\.com|maps\.google\.com|www\.google\.com|google\.com|maps\.app\.goo\.gl|g\.co)$/;

export type MotivoDelLinkDeResena = 'largo' | 'sin-https' | 'otro-sitio';

export type RevisionDelLinkDeResena =
  | { estado: 'vacio' }
  | { estado: 'valido' }
  | { estado: 'invalido'; motivo: MotivoDelLinkDeResena };

export function normalizarLinkDeResena(texto: string): string {
  const link = texto.trim();
  return SOLO_EL_HOST_DE_RESENA.test(link) ? `${link}/` : link;
}

export function esLinkDeResena(texto: string): boolean {
  return texto.length <= LARGO_MAXIMO_DEL_LINK_DE_RESENA && LINK_DE_RESENA.test(texto);
}

export function revisarLinkDeResena(texto: string): RevisionDelLinkDeResena {
  const link = normalizarLinkDeResena(texto);
  if (link === '') return { estado: 'vacio' };
  if (link.length > LARGO_MAXIMO_DEL_LINK_DE_RESENA) return { estado: 'invalido', motivo: 'largo' };
  if (!link.startsWith('https://')) return { estado: 'invalido', motivo: 'sin-https' };
  if (!LINK_DE_RESENA.test(link)) return { estado: 'invalido', motivo: 'otro-sitio' };
  return { estado: 'valido' };
}
