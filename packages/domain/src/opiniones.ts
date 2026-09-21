import { diasEntre } from './fechas.ts';

export const UMBRAL_BARRAS = 12;

export const UMBRAL_EVOLUCION = 12;

export const UMBRAL_MESES = 6;

export const TOPE_PREGUNTAS = 8;

export const TOPE_PROPIAS = 3;

export const PUNTOS_DE_LA_TASA = 40;

export const REFERENCIA_SEG = 108;

export const LIMITE_DEL_LARGO_SEG = 180;

export const SEGUNDOS_DE_ENTRADA = 8;

export const LARGO_MAXIMO_DE_LA_PREGUNTA = 300;

export const LARGO_MAXIMO_DE_LA_OPCION = 120;

export const MINIMO_DE_OPCIONES = 2;

export const MAXIMO_DE_OPCIONES = 8;

export const TIPOS_DE_PREGUNTA = ['escala5', 'sitalvezno', 'una', 'varias', 'texto'] as const;

export type TipoDePregunta = (typeof TIPOS_DE_PREGUNTA)[number];

export const TIPOS_DE_PREGUNTA_PROPIA = [
  'escala5',
  'sitalvezno',
  'texto',
] as const satisfies readonly TipoDePregunta[];

export type TipoDePreguntaPropia = (typeof TIPOS_DE_PREGUNTA_PROPIA)[number];

export const ESCALAS = ['conformidad', 'tiempos', 'trato'] as const;

export type Escala = (typeof ESCALAS)[number];

export const ESCALA_POR_DEFECTO: Escala = 'conformidad';

export type Polo = 'bien' | 'neutro' | 'mal';

export type Cara =
  'enojada' | 'triste' | 'seria' | 'contenta' | 'riendo' | 'pulgar-arriba' | 'pulgar-abajo';

export interface Paso {
  valor: number;
  etiqueta: string;
  corta: string;
  polo: Polo | null;
  cara: Cara | null;
}

export interface FormaDePregunta {
  tipo: TipoDePregunta;
  escala: Escala | null;
  opciones: readonly string[] | null;
}

function paso(valor: number, etiqueta: string, corta: string, polo: Polo, cara: Cara): Paso {
  return { valor, etiqueta, corta, polo, cara };
}

const PASOS_DE_LA_ESCALA: Readonly<Record<Escala, readonly Paso[]>> = {
  conformidad: [
    paso(1, 'Nada conforme', 'Nada', 'mal', 'enojada'),
    paso(2, 'Poco conforme', 'Poco', 'mal', 'triste'),
    paso(3, 'Ni bien ni mal', 'Así nomás', 'neutro', 'seria'),
    paso(4, 'Conforme', 'Conforme', 'bien', 'contenta'),
    paso(5, 'Muy conforme', 'Muy conforme', 'bien', 'riendo'),
  ],
  tiempos: [
    paso(1, 'Llegó muy tarde', 'Muy tarde', 'mal', 'enojada'),
    paso(2, 'Se atrasó', 'Se atrasó', 'mal', 'triste'),
    paso(3, 'Más o menos a tiempo', 'Más o menos', 'neutro', 'seria'),
    paso(4, 'Llegó cuando dijeron', 'A tiempo', 'bien', 'contenta'),
    paso(5, 'Llegó antes de lo pautado', 'Antes', 'bien', 'riendo'),
  ],
  trato: [
    paso(1, 'Costaba mucho', 'Costaba', 'mal', 'enojada'),
    paso(2, 'Costaba un poco', 'Un poco', 'mal', 'triste'),
    paso(3, 'Ni bien ni mal', 'Ni bien ni mal', 'neutro', 'seria'),
    paso(4, 'Fácil', 'Fácil', 'bien', 'contenta'),
    paso(5, 'Muy fácil', 'Muy fácil', 'bien', 'riendo'),
  ],
};

const PASOS_DE_SI_TAL_VEZ_NO: readonly Paso[] = [
  paso(3, 'Sí, sin dudarlo', 'Sí', 'bien', 'pulgar-arriba'),
  paso(2, 'Tal vez', 'Tal vez', 'neutro', 'seria'),
  paso(1, 'No', 'No', 'mal', 'pulgar-abajo'),
];

export function pasosDe(pregunta: FormaDePregunta): readonly Paso[] {
  switch (pregunta.tipo) {
    case 'escala5':
      return PASOS_DE_LA_ESCALA[pregunta.escala ?? ESCALA_POR_DEFECTO];
    case 'sitalvezno':
      return PASOS_DE_SI_TAL_VEZ_NO;
    case 'una':
    case 'varias':
      return (pregunta.opciones ?? []).map((etiqueta, valor) => ({
        valor,
        etiqueta,
        corta: etiqueta,
        polo: null,
        cara: null,
      }));
    case 'texto':
      return [];
  }
}

export function pasoDe(pregunta: FormaDePregunta, valor: number): Paso | null {
  return pasosDe(pregunta).find((candidato) => candidato.valor === valor) ?? null;
}

export function porcentaje(parte: number, total: number): string {
  if (total === 0) return '—';
  return `${String(Math.round((parte * 100) / total))}% (${String(parte)} de ${String(total)})`;
}

export interface Promedio {
  decimas: number;
  texto: string;
  n: number;
}

export function promedio(valores: readonly number[]): Promedio | null {
  const n = valores.length;
  if (n === 0) return null;
  const suma = valores.reduce((total, valor) => total + valor, 0);
  const decimas = Math.floor((20 * suma + n) / (2 * n));
  const enteros = Math.floor(decimas / 10);
  const resto = decimas % 10;
  return {
    decimas,
    texto: resto === 0 ? String(enteros) : `${String(enteros)},${String(resto)}`,
    n,
  };
}

export const SEGUNDOS_POR_TIPO: Readonly<Record<TipoDePregunta, number>> = {
  escala5: 9,
  sitalvezno: 7,
  una: 11,
  varias: 14,
  texto: 38,
};

export type TonoDelLargo = 'ok' | 'atencion' | 'alerta';

export interface Duracion {
  segundos: number;
  texto: string;
  tono: TonoDelLargo;
  nota: string;
}

const NOTAS_DEL_LARGO: Readonly<Record<TonoDelLargo, string>> = {
  ok: 'Está en el largo que la gente contesta sin pensarlo.',
  atencion: 'Se está poniendo larga. Arriba de tres minutos empiezan a abandonarla.',
  alerta: 'Demasiado larga. A este largo la mitad la deja por la mitad.',
};

function tonoDelLargo(segundos: number): TonoDelLargo {
  if (segundos <= REFERENCIA_SEG) return 'ok';
  return segundos <= LIMITE_DEL_LARGO_SEG ? 'atencion' : 'alerta';
}

export function duracion(tipos: readonly TipoDePregunta[]): Duracion {
  const segundos = tipos.reduce(
    (suma, tipo) => suma + SEGUNDOS_POR_TIPO[tipo],
    SEGUNDOS_DE_ENTRADA,
  );
  const tono = tonoDelLargo(segundos);
  return {
    segundos,
    texto: `${String(Math.floor(segundos / 60))}:${String(segundos % 60).padStart(2, '0')}`,
    tono,
    nota: NOTAS_DEL_LARGO[tono],
  };
}

const NUMEROS = [
  'cero',
  'uno',
  'dos',
  'tres',
  'cuatro',
  'cinco',
  'seis',
  'siete',
  'ocho',
  'nueve',
  'diez',
  'once',
  'doce',
];

export type Genero = 'femenino' | 'masculino';

export function enPalabras(n: number, genero: Genero): string {
  if (n === 1) return genero === 'femenino' ? 'una' : 'un';
  return NUMEROS[n] ?? String(n);
}

function cuantas(n: number, singular: string, plural: string, genero: Genero): string {
  return `${enPalabras(n, genero)} ${n === 1 ? singular : plural}`;
}

export function queTieneLaEncuesta(tipos: readonly TipoDePregunta[]): string {
  const comentarios = tipos.filter((tipo) => tipo === 'texto').length;
  const preguntas = tipos.length - comentarios;
  const partes = [
    ...(preguntas > 0 ? [cuantas(preguntas, 'pregunta', 'preguntas', 'femenino')] : []),
    ...(comentarios > 0 ? [cuantas(comentarios, 'comentario', 'comentarios', 'masculino')] : []),
  ];
  if (partes.length === 0) return 'No tiene preguntas';
  return `${tipos.length === 1 ? 'Es' : 'Son'} ${partes.join(' y ')}`;
}

export function cuantasPreguntas(tipos: readonly TipoDePregunta[]): string {
  const preguntas = tipos.filter((tipo) => tipo !== 'texto').length;
  if (preguntas === 0) return queTieneLaEncuesta(tipos);
  return `${preguntas === 1 ? 'Es' : 'Son'} ${cuantas(preguntas, 'pregunta', 'preguntas', 'femenino')}`;
}

export function menosDe(segundos: number): string {
  return `menos de ${cuantas(Math.floor(segundos / 60) + 1, 'minuto', 'minutos', 'masculino')}`;
}

export function primeraPalabra(texto: string): string {
  return texto.trim().split(/\s+/, 1).join('');
}

export function elMueble(titulo: string): string {
  const primera = primeraPalabra(titulo);
  if (!/^\p{L}{2,}$/u.test(primera) || primera === primera.toUpperCase()) return 'mueble';
  return primera.toLowerCase();
}

export function nombresQueOpinaron(nombres: readonly string[]): string {
  const unicos = [...new Set(nombres.map(primeraPalabra).filter((nombre) => nombre !== ''))];
  if (unicos.length === 0) return '';
  if (unicos.length === 1) return `${unicos.join('')} opinó`;
  const [primeros, ultimo] =
    unicos.length <= 3
      ? [unicos.slice(0, -1), unicos.slice(-1).join('')]
      : [unicos.slice(0, 2), `${String(unicos.length - 2)} más`];
  return `${primeros.join(', ')} y ${ultimo} opinaron`;
}

export interface PreguntaEditable extends FormaDePregunta {
  texto: string;
  obligatoria: boolean;
}

export function limpiarBorrador(borrador: PreguntaEditable): PreguntaEditable {
  const conOpciones = borrador.tipo === 'una' || borrador.tipo === 'varias';
  return {
    texto: borrador.texto.trim(),
    tipo: borrador.tipo,
    escala: borrador.tipo === 'escala5' ? (borrador.escala ?? ESCALA_POR_DEFECTO) : null,
    opciones: conOpciones ? (borrador.opciones ?? []).map((opcion) => opcion.trim()) : null,
    obligatoria: borrador.obligatoria,
  };
}

export type ProblemaDelBorrador =
  | 'sin-texto'
  | 'texto-largo'
  | 'pocas-opciones'
  | 'muchas-opciones'
  | 'opcion-vacia'
  | 'opcion-larga'
  | 'opciones-repetidas';

export function revisarBorrador(borrador: PreguntaEditable): ProblemaDelBorrador | null {
  const limpio = limpiarBorrador(borrador);
  if (limpio.texto === '') return 'sin-texto';
  if (Array.from(limpio.texto).length > LARGO_MAXIMO_DE_LA_PREGUNTA) return 'texto-largo';
  if (limpio.opciones === null) return null;
  if (limpio.opciones.some((opcion) => opcion === '')) return 'opcion-vacia';
  if (limpio.opciones.length < MINIMO_DE_OPCIONES) return 'pocas-opciones';
  if (limpio.opciones.length > MAXIMO_DE_OPCIONES) return 'muchas-opciones';
  if (limpio.opciones.some((opcion) => Array.from(opcion).length > LARGO_MAXIMO_DE_LA_OPCION)) {
    return 'opcion-larga';
  }
  if (new Set(limpio.opciones).size !== limpio.opciones.length) return 'opciones-repetidas';
  return null;
}

function mismasOpciones(a: readonly string[] | null, b: readonly string[] | null): boolean {
  if (a === null || b === null) return a === b;
  return a.length === b.length && a.every((opcion, indice) => opcion === b[indice]);
}

export function mismaForma(a: FormaDePregunta, b: FormaDePregunta): boolean {
  return a.tipo === b.tipo && a.escala === b.escala && mismasOpciones(a.opciones, b.opciones);
}

export interface UsoDeLaPregunta {
  respuestas: number;
  enviada: boolean;
}

export type ComoGuardar =
  | { modo: 'en-el-lugar' }
  | { modo: 'preguntar'; respuestas: number }
  | { modo: 'version-nueva'; respuestas: number };

export function comoGuardar(
  antes: PreguntaEditable,
  despues: PreguntaEditable,
  uso: UsoDeLaPregunta,
): ComoGuardar {
  const viejo = limpiarBorrador(antes);
  const nuevo = limpiarBorrador(despues);
  if (!mismaForma(viejo, nuevo) && (uso.enviada || uso.respuestas > 0)) {
    return { modo: 'version-nueva', respuestas: uso.respuestas };
  }
  if (viejo.texto !== nuevo.texto && uso.respuestas > 0) {
    return { modo: 'preguntar', respuestas: uso.respuestas };
  }
  return { modo: 'en-el-lugar' };
}

export function sePuedeBorrar(
  pregunta: { titular: boolean; numero: number },
  uso: UsoDeLaPregunta & { otrasVersiones: boolean },
): boolean {
  return (
    !pregunta.titular &&
    pregunta.numero === 1 &&
    !uso.otrasVersiones &&
    !uso.enviada &&
    uso.respuestas === 0
  );
}

export interface EnvioDelTrabajo {
  id: string;
  enviadaEl: string;
  enviadaA: string;
  recordadaEl: string | null;
  revocadaEl: string | null;
  contestadaEl: string | null;
  contestadaA: string | null;
  respuestaId: string | null;
}

export type PedidoMandado =
  | { estado: 'mandada' | 'recordada'; envio: EnvioDelTrabajo }
  | { estado: 'contestada'; envio: EnvioDelTrabajo };

export type EstadoDelPedido = { estado: 'sin_mandar' } | PedidoMandado;

export function estadoDelPedido(envios: readonly EnvioDelTrabajo[]): EstadoDelPedido {
  const contestado = envios.find((envio) => envio.respuestaId !== null);
  if (contestado) return { estado: 'contestada', envio: contestado };
  const vivo = envios.find((envio) => envio.revocadaEl === null);
  if (!vivo) return { estado: 'sin_mandar' };
  return { estado: vivo.recordadaEl === null ? 'mandada' : 'recordada', envio: vivo };
}

export function fueMandado(pedido: EstadoDelPedido): pedido is PedidoMandado {
  return pedido.estado !== 'sin_mandar';
}

export interface PreguntaDeLaEncuesta extends FormaDePregunta {
  id: string;
  texto: string;
  obligatoria: boolean;
  propia: boolean;
}

export interface PreguntaGuardada extends FormaDePregunta {
  id: string;
  serie: string;
  numero: number;
  proyectoId: string | null;
  titular: boolean;
  orden: number;
  texto: string;
  obligatoria: boolean;
  archivadaEl: string | null;
  creadaEl: string;
}

export interface EncuestaGuardada {
  id: string;
  proyectoId: string;
  enviadaEl: string;
  enviadaA: string;
  recordadaEl: string | null;
  revocadaEl: string | null;
  preguntas: readonly PreguntaDeLaEncuesta[];
}

export type ValorGuardado = number | readonly number[] | string;

export interface RenglonGuardado {
  preguntaId: string;
  preguntaTexto: string;
  valor: ValorGuardado;
}

export interface RespuestaGuardada {
  id: string;
  encuestaId: string;
  contestadaEl: string;
  contestadaA: string;
  leidaEl: string | null;
  renglones: readonly RenglonGuardado[];
}

export interface TrabajoOpinado {
  proyectoId: string;
  cliente: string;
  trabajo: string;
}

export interface DatosDeLasOpiniones {
  preguntas: readonly PreguntaGuardada[];
  encuestas: readonly EncuestaGuardada[];
  respuestas: readonly RespuestaGuardada[];
  trabajos: readonly TrabajoOpinado[];
}

function porOrden(a: PreguntaGuardada, b: PreguntaGuardada): number {
  return a.orden - b.orden || a.serie.localeCompare(b.serie);
}

export function vigentesPorSerie(preguntas: readonly PreguntaGuardada[]): PreguntaGuardada[] {
  const vigentes = new Map<string, PreguntaGuardada>();
  for (const pregunta of preguntas) {
    const actual = vigentes.get(pregunta.serie);
    if (!actual || pregunta.numero > actual.numero) vigentes.set(pregunta.serie, pregunta);
  }
  return [...vigentes.values()].sort(porOrden);
}

export interface EncuestaBase {
  vigentes: readonly PreguntaGuardada[];
  archivadas: readonly PreguntaGuardada[];
}

export function encuestaBase(preguntas: readonly PreguntaGuardada[]): EncuestaBase {
  const vigentes = vigentesPorSerie(preguntas.filter((pregunta) => pregunta.proyectoId === null));
  return {
    vigentes: vigentes.filter((pregunta) => pregunta.archivadaEl === null),
    archivadas: vigentes.filter((pregunta) => pregunta.archivadaEl !== null),
  };
}

export function propiasDelTrabajo(
  preguntas: readonly PreguntaGuardada[],
  proyectoId: string,
): PreguntaGuardada[] {
  return preguntas.filter((pregunta) => pregunta.proyectoId === proyectoId).sort(porOrden);
}

export function versionesDe(
  preguntas: readonly PreguntaGuardada[],
  serie: string,
): PreguntaGuardada[] {
  return preguntas
    .filter((pregunta) => pregunta.serie === serie)
    .sort((a, b) => b.numero - a.numero);
}

export function comoLaVeElCliente(pregunta: PreguntaGuardada): PreguntaDeLaEncuesta {
  return {
    id: pregunta.id,
    texto: pregunta.texto,
    tipo: pregunta.tipo,
    escala: pregunta.escala,
    obligatoria: pregunta.obligatoria,
    opciones: pregunta.opciones,
    propia: pregunta.proyectoId !== null,
  };
}

interface Contestado {
  respuesta: RespuestaGuardada;
  renglon: RenglonGuardado;
}

function renglonesPorPregunta(respuestas: readonly RespuestaGuardada[]): Map<string, Contestado[]> {
  const porPregunta = new Map<string, Contestado[]>();
  for (const respuesta of respuestas) {
    for (const renglon of respuesta.renglones) {
      porPregunta.set(renglon.preguntaId, [
        ...(porPregunta.get(renglon.preguntaId) ?? []),
        { respuesta, renglon },
      ]);
    }
  }
  return porPregunta;
}

export function usoDeLasPreguntas(
  datos: Pick<DatosDeLasOpiniones, 'encuestas' | 'respuestas'>,
): ReadonlyMap<string, UsoDeLaPregunta> {
  const uso = new Map<string, UsoDeLaPregunta>();
  const de = (id: string): UsoDeLaPregunta => uso.get(id) ?? { respuestas: 0, enviada: false };
  for (const encuesta of datos.encuestas) {
    for (const pregunta of encuesta.preguntas)
      uso.set(pregunta.id, { ...de(pregunta.id), enviada: true });
  }
  for (const [id, contestados] of renglonesPorPregunta(datos.respuestas)) {
    uso.set(id, { ...de(id), respuestas: contestados.length });
  }
  return uso;
}

export interface LineaDeLaRespuesta {
  pregunta: PreguntaDeLaEncuesta;
  pasos: readonly Paso[];
  texto: string | null;
}

function elegidos(valor: ValorGuardado): readonly number[] {
  if (typeof valor === 'number') return [valor];
  return typeof valor === 'string' ? [] : valor;
}

export function lineasDeLaRespuesta(
  preguntas: readonly PreguntaDeLaEncuesta[],
  renglones: readonly { preguntaId: string; valor: ValorGuardado }[],
): LineaDeLaRespuesta[] {
  return preguntas.flatMap((pregunta) =>
    renglones
      .filter((renglon) => renglon.preguntaId === pregunta.id)
      .map((renglon) => {
        const valores = elegidos(renglon.valor);
        return {
          pregunta,
          pasos: pasosDe(pregunta).filter((candidato) => valores.includes(candidato.valor)),
          texto: typeof renglon.valor === 'string' ? renglon.valor : null,
        };
      }),
  );
}

export interface Conteo {
  paso: Paso;
  n: number;
}

export type ModoDeMostrar = 'puntos' | 'barras';

export function modoDeMostrar(pregunta: FormaDePregunta, n: number): ModoDeMostrar {
  const conPolos = pregunta.tipo === 'escala5' || pregunta.tipo === 'sitalvezno';
  return conPolos && n >= UMBRAL_BARRAS ? 'barras' : 'puntos';
}

export interface VersionAnterior {
  pregunta: PreguntaGuardada;
  n: number;
  hasta: string;
  conteos: readonly Conteo[];
}

export interface ResultadoDePregunta {
  pregunta: PreguntaGuardada;
  n: number;
  modo: ModoDeMostrar;
  conteos: readonly Conteo[];
  promedio: Promedio | null;
  anteriores: readonly VersionAnterior[];
}

function conteosDe(pregunta: FormaDePregunta, valores: readonly ValorGuardado[]): Conteo[] {
  const todos = valores.flatMap(elegidos);
  return pasosDe(pregunta).map((candidato) => ({
    paso: candidato,
    n: todos.filter((valor) => valor === candidato.valor).length,
  }));
}

function resultadoDeLaSerie(
  vigente: PreguntaGuardada,
  viejas: readonly PreguntaGuardada[],
  porPregunta: ReadonlyMap<string, readonly Contestado[]>,
): ResultadoDePregunta {
  const valoresDe = (pregunta: PreguntaGuardada): ValorGuardado[] =>
    (porPregunta.get(pregunta.id) ?? []).map(({ renglon }) => renglon.valor);
  const valores = valoresDe(vigente);
  const anteriores: VersionAnterior[] = [];
  let siguiente = vigente;
  for (const pregunta of viejas) {
    const suyos = valoresDe(pregunta);
    if (suyos.length > 0) {
      anteriores.push({
        pregunta,
        n: suyos.length,
        hasta: siguiente.creadaEl,
        conteos: conteosDe(pregunta, suyos),
      });
    }
    siguiente = pregunta;
  }
  return {
    pregunta: vigente,
    n: valores.length,
    modo: modoDeMostrar(vigente, valores.length),
    conteos: conteosDe(vigente, valores),
    promedio:
      vigente.tipo === 'escala5'
        ? promedio(valores.filter((valor): valor is number => typeof valor === 'number'))
        : null,
    anteriores,
  };
}

export interface Comentario {
  respuestaId: string;
  trabajo: TrabajoOpinado;
  pregunta: string;
  texto: string;
  dia: string;
  titular: Paso | null;
}

export interface PuntoDeLaEvolucion {
  respuestaId: string;
  cliente: string;
  dia: string;
  paso: Paso;
}

export interface Evolucion {
  conEvolucion: boolean;
  puntos: readonly PuntoDeLaEvolucion[];
}

export interface FilaDeTrabajo {
  trabajo: TrabajoOpinado;
  propias: number;
  pedido: PedidoMandado;
  titular: Paso | null;
}

export type Situacion = 'sin-enviar' | 'sin-respuestas' | 'con-respuestas';

export interface ResumenDeOpiniones {
  situacion: Situacion;
  enviadas: number;
  contestadas: number;
  tasa: string;
  desde: string | null;
  meses: number;
  titular: { pregunta: PreguntaGuardada; promedio: Promedio | null } | null;
  comentarios: readonly Comentario[];
  preguntas: readonly ResultadoDePregunta[];
  archivadas: readonly ResultadoDePregunta[];
  evolucion: Evolucion;
  trabajos: readonly FilaDeTrabajo[];
  sinLeer: readonly RespuestaGuardada[];
}

export function mesesDeHistoria(desde: string | null, hoy: string): number {
  return desde === null ? 0 : Math.round(diasEntre(desde, hoy) / 30);
}

export function envioDe(
  encuesta: EncuestaGuardada,
  respuesta: RespuestaGuardada | undefined,
): EnvioDelTrabajo {
  return {
    id: encuesta.id,
    enviadaEl: encuesta.enviadaEl,
    enviadaA: encuesta.enviadaA,
    recordadaEl: encuesta.recordadaEl,
    revocadaEl: encuesta.revocadaEl,
    contestadaEl: respuesta ? respuesta.contestadaEl : null,
    contestadaA: respuesta ? respuesta.contestadaA : null,
    respuestaId: respuesta ? respuesta.id : null,
  };
}

export function pedidosPorTrabajo(
  datos: Pick<DatosDeLasOpiniones, 'encuestas' | 'respuestas'>,
): ReadonlyMap<string, EstadoDelPedido> {
  const respuestaDe = new Map(
    datos.respuestas.map((respuesta) => [respuesta.encuestaId, respuesta]),
  );
  const envios = new Map<string, EnvioDelTrabajo[]>();
  for (const encuesta of datos.encuestas) {
    envios.set(encuesta.proyectoId, [
      ...(envios.get(encuesta.proyectoId) ?? []),
      envioDe(encuesta, respuestaDe.get(encuesta.id)),
    ]);
  }
  return new Map([...envios].map(([proyectoId, lista]) => [proyectoId, estadoDelPedido(lista)]));
}

function trabajoOpinado(
  trabajos: ReadonlyMap<string, TrabajoOpinado>,
  proyectoId: string,
): TrabajoOpinado {
  return trabajos.get(proyectoId) ?? { proyectoId, cliente: '', trabajo: '' };
}

function momentoDelPedido(pedido: PedidoMandado): string {
  return pedido.envio.contestadaA ?? pedido.envio.enviadaA;
}

export function resumenDeOpiniones(datos: DatosDeLasOpiniones, hoy: string): ResumenDeOpiniones {
  const trabajos = new Map(datos.trabajos.map((trabajo) => [trabajo.proyectoId, trabajo]));
  const proyectoDe = new Map(datos.encuestas.map((encuesta) => [encuesta.id, encuesta.proyectoId]));
  const preguntaDe = new Map(datos.preguntas.map((pregunta) => [pregunta.id, pregunta]));
  const porPregunta = renglonesPorPregunta(datos.respuestas);
  const base = datos.preguntas.filter((pregunta) => pregunta.proyectoId === null);
  const vigentes = vigentesPorSerie(base);
  const titular = vigentes.find((pregunta) => pregunta.titular) ?? null;

  const trabajoDe = (respuesta: RespuestaGuardada): TrabajoOpinado =>
    trabajoOpinado(trabajos, proyectoDe.get(respuesta.encuestaId) ?? '');

  const titularDe = (respuesta: RespuestaGuardada): Paso | null => {
    for (const renglon of respuesta.renglones) {
      const pregunta = preguntaDe.get(renglon.preguntaId);
      if (pregunta?.titular === true && typeof renglon.valor === 'number') {
        return pasoDe(pregunta, renglon.valor);
      }
    }
    return null;
  };

  const mandados = [...pedidosPorTrabajo(datos)].flatMap(([proyectoId, pedido]) =>
    fueMandado(pedido) ? [{ proyectoId, pedido }] : [],
  );
  const enviadas = mandados.length;
  const contestadas = mandados.filter(({ pedido }) => pedido.estado === 'contestada').length;
  const desde = mandados.map(({ pedido }) => pedido.envio.enviadaEl).sort()[0] ?? null;
  const meses = mesesDeHistoria(desde, hoy);

  const nuevasPrimero = [...datos.respuestas].sort((a, b) =>
    b.contestadaA.localeCompare(a.contestadaA),
  );

  const comentarios = nuevasPrimero.flatMap((respuesta) =>
    respuesta.renglones.flatMap((renglon) =>
      preguntaDe.get(renglon.preguntaId)?.proyectoId === null && typeof renglon.valor === 'string'
        ? [
            {
              respuestaId: respuesta.id,
              trabajo: trabajoDe(respuesta),
              pregunta: renglon.preguntaTexto,
              texto: renglon.valor,
              dia: respuesta.contestadaEl,
              titular: titularDe(respuesta),
            },
          ]
        : [],
    ),
  );

  const resultados = vigentes
    .filter((vigente) => vigente.tipo !== 'texto')
    .map((vigente) =>
      resultadoDeLaSerie(
        vigente,
        versionesDe(base, vigente.serie).filter((pregunta) => pregunta.numero < vigente.numero),
        porPregunta,
      ),
    );

  const puntos = titular
    ? [...(porPregunta.get(titular.id) ?? [])]
        .sort((a, b) => a.respuesta.contestadaA.localeCompare(b.respuesta.contestadaA))
        .flatMap(({ respuesta, renglon }) => {
          const encontrado =
            typeof renglon.valor === 'number' ? pasoDe(titular, renglon.valor) : null;
          return encontrado
            ? [
                {
                  respuestaId: respuesta.id,
                  cliente: trabajoDe(respuesta).cliente,
                  dia: respuesta.contestadaEl,
                  paso: encontrado,
                },
              ]
            : [];
        })
    : [];

  const respuestaPorId = new Map(datos.respuestas.map((respuesta) => [respuesta.id, respuesta]));
  const filas = mandados
    .map(({ proyectoId, pedido }) => {
      const respuesta = respuestaPorId.get(pedido.envio.respuestaId ?? '');
      return {
        trabajo: trabajoOpinado(trabajos, proyectoId),
        propias: propiasDelTrabajo(datos.preguntas, proyectoId).length,
        pedido,
        titular: respuesta ? titularDe(respuesta) : null,
      };
    })
    .sort((a, b) => {
      const primeroLasContestadas =
        Number(a.pedido.estado !== 'contestada') - Number(b.pedido.estado !== 'contestada');
      return (
        primeroLasContestadas ||
        momentoDelPedido(b.pedido).localeCompare(momentoDelPedido(a.pedido))
      );
    });

  const situacion: Situacion =
    enviadas === 0 ? 'sin-enviar' : contestadas === 0 ? 'sin-respuestas' : 'con-respuestas';

  return {
    situacion,
    enviadas,
    contestadas,
    tasa: porcentaje(contestadas, enviadas),
    desde,
    meses,
    titular: titular
      ? {
          pregunta: titular,
          promedio:
            resultados.find((resultado) => resultado.pregunta.id === titular.id)?.promedio ?? null,
        }
      : null,
    comentarios,
    preguntas: resultados.filter((resultado) => resultado.pregunta.archivadaEl === null),
    archivadas: resultados.filter((resultado) => resultado.pregunta.archivadaEl !== null),
    evolucion: {
      conEvolucion: puntos.length >= UMBRAL_EVOLUCION && meses >= UMBRAL_MESES,
      puntos,
    },
    trabajos: filas,
    sinLeer: nuevasPrimero.filter((respuesta) => respuesta.leidaEl === null),
  };
}
