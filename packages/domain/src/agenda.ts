import { faseDe, type EstadoProyecto } from './estados.ts';
import { diasEntre, sumarDias } from './fechas.ts';

export const CATEGORIAS_DERIVADAS = ['presupuesto', 'visita', 'entrega'] as const;

export const CATEGORIAS_PROPIAS = ['materiales', 'taller'] as const;

export const CATEGORIAS_DE_AGENDA = [...CATEGORIAS_DERIVADAS, ...CATEGORIAS_PROPIAS] as const;

export type CategoriaDerivada = (typeof CATEGORIAS_DERIVADAS)[number];

export type CategoriaPropia = (typeof CATEGORIAS_PROPIAS)[number];

export type CategoriaDeAgenda = CategoriaDerivada | CategoriaPropia;

export interface ProyectoDeLaAgenda {
  id: string;
  clienteId: string;
  titulo: string;
  estado: EstadoProyecto;
  fechaVisita: string | null;
  visitaHora: string | null;
  visitaHecha: boolean;
  entregaEstimada: string | null;
  entregaHora: string | null;
  vencimientoPresupuesto: string | null;
  direccionEntrega: string;
  importante: Readonly<Record<CategoriaDerivada, boolean>>;
}

export interface ClienteDeLaAgenda {
  id: string;
  nombre: string;
  zona: string;
}

export interface AnotacionDeLaAgenda {
  id: string;
  fecha: string;
  hora: string | null;
  texto: string;
  categoria: CategoriaPropia;
  proyectoId: string | null;
  hecha: boolean;
  importante: boolean;
}

export interface DatosDeLaAgenda {
  proyectos: readonly ProyectoDeLaAgenda[];
  clientes: readonly ClienteDeLaAgenda[];
  anotaciones: readonly AnotacionDeLaAgenda[];
}

export interface RangoDeLaAgenda {
  desde: string;
  hasta: string;
}

export interface EventoDerivado {
  clase: 'derivada';
  id: string;
  categoria: CategoriaDerivada;
  fecha: string;
  hora: string | null;
  proyectoId: string;
  clienteId: string;
  titulo: string;
  cliente: string;
  lugar: string;
  hecha: boolean;
  importante: boolean;
}

export interface EventoPropio {
  clase: 'propia';
  id: string;
  categoria: CategoriaPropia;
  fecha: string;
  hora: string | null;
  texto: string;
  proyectoId: string | null;
  proyecto: string | null;
  hecha: boolean;
  importante: boolean;
}

export type EventoDeLaAgenda = EventoDerivado | EventoPropio;

const ESTADOS_CON_LA_ENTREGA_HECHA: readonly EstadoProyecto[] = ['entregado', 'cobrado'];

const PESO_DE_LA_CATEGORIA: Readonly<Record<CategoriaDeAgenda, number>> = {
  presupuesto: 0,
  visita: 1,
  entrega: 2,
  materiales: 3,
  taller: 4,
};

function entregaHecha(estado: EstadoProyecto): boolean {
  return ESTADOS_CON_LA_ENTREGA_HECHA.includes(estado);
}

function derivadosDelProyecto(
  proyecto: ProyectoDeLaAgenda,
  cliente: ClienteDeLaAgenda | undefined,
): EventoDerivado[] {
  const enConsulta = faseDe(proyecto.estado) === 'consultas';
  const entregada = entregaHecha(proyecto.estado);
  const comun = {
    clase: 'derivada' as const,
    proyectoId: proyecto.id,
    clienteId: proyecto.clienteId,
    titulo: proyecto.titulo,
    cliente: cliente?.nombre ?? '',
  };
  const zona = cliente?.zona ?? '';
  const eventos: EventoDerivado[] = [];

  if ((proyecto.estado === 'en_curso' || entregada) && proyecto.entregaEstimada !== null) {
    eventos.push({
      ...comun,
      id: `entrega:${proyecto.id}`,
      categoria: 'entrega',
      fecha: proyecto.entregaEstimada,
      hora: proyecto.entregaHora,
      lugar: proyecto.direccionEntrega.trim() === '' ? zona : proyecto.direccionEntrega,
      hecha: entregada,
      importante: proyecto.importante.entrega,
    });
  }
  if ((enConsulta || proyecto.visitaHecha) && proyecto.fechaVisita !== null) {
    eventos.push({
      ...comun,
      id: `visita:${proyecto.id}`,
      categoria: 'visita',
      fecha: proyecto.fechaVisita,
      hora: proyecto.visitaHora,
      lugar: zona,
      hecha: proyecto.visitaHecha,
      importante: proyecto.importante.visita,
    });
  }
  if (
    enConsulta &&
    proyecto.estado !== 'presupuesto_enviado' &&
    proyecto.estado !== 'presupuesto_estimativo' &&
    proyecto.vencimientoPresupuesto !== null
  ) {
    eventos.push({
      ...comun,
      id: `presupuesto:${proyecto.id}`,
      categoria: 'presupuesto',
      fecha: proyecto.vencimientoPresupuesto,
      hora: null,
      lugar: zona,
      hecha: false,
      importante: proyecto.importante.presupuesto,
    });
  }
  return eventos;
}

function propioDeLaAnotacion(
  anotacion: AnotacionDeLaAgenda,
  proyecto: ProyectoDeLaAgenda | undefined,
): EventoPropio {
  return {
    clase: 'propia',
    id: anotacion.id,
    categoria: anotacion.categoria,
    fecha: anotacion.fecha,
    hora: anotacion.hora,
    texto: anotacion.texto,
    proyectoId: anotacion.proyectoId,
    proyecto: proyecto?.titulo ?? null,
    hecha: anotacion.hecha,
    importante: anotacion.importante,
  };
}

function textoDe(evento: EventoDeLaAgenda): string {
  return evento.clase === 'propia' ? evento.texto : evento.titulo;
}

function compararEventos(uno: EventoDeLaAgenda, otro: EventoDeLaAgenda): number {
  if (uno.fecha !== otro.fecha) return uno.fecha < otro.fecha ? -1 : 1;

  const horaUno = uno.hora ?? '';
  const horaOtro = otro.hora ?? '';
  if (horaUno !== horaOtro) {
    if (horaUno === '') return 1;
    if (horaOtro === '') return -1;
    return horaUno < horaOtro ? -1 : 1;
  }

  const peso = PESO_DE_LA_CATEGORIA[uno.categoria] - PESO_DE_LA_CATEGORIA[otro.categoria];
  if (peso !== 0) return peso;

  const porTexto = textoDe(uno).localeCompare(textoDe(otro), 'es');
  if (porTexto !== 0) return porTexto;

  return uno.id < otro.id ? -1 : 1;
}

export function eventosDeLaAgenda(
  datos: DatosDeLaAgenda,
  rango: RangoDeLaAgenda,
): EventoDeLaAgenda[] {
  if (diasEntre(rango.desde, rango.hasta) < 0) {
    throw new RangeError(
      `El rango de la agenda va de una fecha a otra igual o posterior: ${rango.desde} a ${rango.hasta} no.`,
    );
  }
  const adentro = (fecha: string) => fecha >= rango.desde && fecha <= rango.hasta;

  const clientes = new Map(datos.clientes.map((cliente) => [cliente.id, cliente]));
  const proyectos = new Map(datos.proyectos.map((proyecto) => [proyecto.id, proyecto]));
  const eventos: EventoDeLaAgenda[] = [];

  for (const proyecto of datos.proyectos) {
    for (const evento of derivadosDelProyecto(proyecto, clientes.get(proyecto.clienteId))) {
      if (adentro(evento.fecha)) eventos.push(evento);
    }
  }
  for (const anotacion of datos.anotaciones) {
    if (!adentro(anotacion.fecha)) continue;
    const proyecto =
      anotacion.proyectoId === null ? undefined : proyectos.get(anotacion.proyectoId);
    eventos.push(propioDeLaAnotacion(anotacion, proyecto));
  }

  return eventos.sort(compararEventos);
}

export interface RangoDeHoras {
  desde: number;
  hasta: number;
}

export const HORARIO_DEL_TALLER: RangoDeHoras = { desde: 7, hasta: 20 };

export const TODO_EL_RELOJ: RangoDeHoras = { desde: 0, hasta: 23 };

export interface FranjaDelDia {
  hora: number;
  desde: string;
  eventos: EventoDeLaAgenda[];
}

export interface DiaPorHoras {
  todoElDia: EventoDeLaAgenda[];
  franjas: FranjaDelDia[];
  rango: RangoDeHoras;
}

const HORA = /^(\d{2}):(\d{2})/;

export function horaDelEvento(evento: EventoDeLaAgenda): number | null {
  const partes = evento.hora === null ? null : HORA.exec(evento.hora);
  if (partes === null) return null;
  const hora = Number(partes[1]);
  return hora >= 0 && hora <= 23 ? hora : null;
}

export function rangoQueEntra(
  eventos: readonly EventoDeLaAgenda[],
  rango: RangoDeHoras = HORARIO_DEL_TALLER,
): RangoDeHoras {
  let { desde, hasta } = rango;
  for (const evento of eventos) {
    const hora = horaDelEvento(evento);
    if (hora === null) continue;
    if (hora < desde) desde = hora;
    if (hora > hasta) hasta = hora;
  }
  return { desde, hasta };
}

export function diaPorHoras(
  eventos: readonly EventoDeLaAgenda[],
  rango: RangoDeHoras = HORARIO_DEL_TALLER,
): DiaPorHoras {
  const conHoras = rangoQueEntra(eventos, rango);
  const franjas: FranjaDelDia[] = [];
  for (let hora = conHoras.desde; hora <= conHoras.hasta; hora += 1) {
    franjas.push({ hora, desde: `${String(hora).padStart(2, '0')}:00`, eventos: [] });
  }

  const todoElDia: EventoDeLaAgenda[] = [];
  for (const evento of eventos) {
    const hora = horaDelEvento(evento);
    const franja = hora === null ? undefined : franjas[hora - conHoras.desde];
    if (franja === undefined) todoElDia.push(evento);
    else franja.eventos.push(evento);
  }

  return { todoElDia, franjas, rango: conHoras };
}

export function puedeArrastrarse(evento: EventoDeLaAgenda): boolean {
  return !evento.hecha;
}

export const AVISOS_DE_LA_AGENDA = ['entregas', 'visitas', 'presupuestos', 'anotaciones'] as const;

export type AvisoDeLaAgenda = (typeof AVISOS_DE_LA_AGENDA)[number];

export const ANTICIPACIONES = [0, 1, 2, 3] as const;

export type Anticipacion = (typeof ANTICIPACIONES)[number];

export interface PreferenciaDeAviso {
  activo: boolean;
  anticipacion: Anticipacion;
}

export type PreferenciasDeAvisos = Readonly<Record<AvisoDeLaAgenda, PreferenciaDeAviso>>;

export const PREFERENCIAS_INICIALES: PreferenciasDeAvisos = {
  entregas: { activo: true, anticipacion: 2 },
  visitas: { activo: true, anticipacion: 1 },
  presupuestos: { activo: true, anticipacion: 1 },
  anotaciones: { activo: false, anticipacion: 0 },
};

export const AVISO_DE_LA_CATEGORIA: Readonly<Record<CategoriaDeAgenda, AvisoDeLaAgenda>> = {
  entrega: 'entregas',
  visita: 'visitas',
  presupuesto: 'presupuestos',
  materiales: 'anotaciones',
  taller: 'anotaciones',
};

export function eventosParaAvisar(
  datos: DatosDeLaAgenda,
  hoy: string,
  preferencias: PreferenciasDeAvisos,
): EventoDeLaAgenda[] {
  const mayor = Math.max(...AVISOS_DE_LA_AGENDA.map((aviso) => preferencias[aviso].anticipacion));

  return eventosDeLaAgenda(datos, { desde: hoy, hasta: sumarDias(hoy, mayor) }).filter((evento) => {
    const preferencia = preferencias[AVISO_DE_LA_CATEGORIA[evento.categoria]];
    if (!preferencia.activo) return false;
    if (evento.hecha) return false;
    return diasEntre(hoy, evento.fecha) <= preferencia.anticipacion;
  });
}
