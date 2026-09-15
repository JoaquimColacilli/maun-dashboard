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
  entregaEstimada: string | null;
  vencimientoPresupuesto: string | null;
  direccionEntrega: string;
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
  proyectoId: string;
  clienteId: string;
  titulo: string;
  cliente: string;
  lugar: string;
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

const PESO_DE_LA_CATEGORIA: Readonly<Record<CategoriaDeAgenda, number>> = {
  presupuesto: 0,
  visita: 1,
  entrega: 2,
  materiales: 3,
  taller: 4,
};

function derivadosDelProyecto(
  proyecto: ProyectoDeLaAgenda,
  cliente: ClienteDeLaAgenda | undefined,
): EventoDerivado[] {
  const enSeguimiento = faseDe(proyecto.estado) === 'seguimiento';
  const comun = {
    clase: 'derivada' as const,
    proyectoId: proyecto.id,
    clienteId: proyecto.clienteId,
    titulo: proyecto.titulo,
    cliente: cliente?.nombre ?? '',
  };
  const zona = cliente?.zona ?? '';
  const eventos: EventoDerivado[] = [];

  if (proyecto.estado === 'en_curso' && proyecto.entregaEstimada !== null) {
    eventos.push({
      ...comun,
      id: `entrega:${proyecto.id}`,
      categoria: 'entrega',
      fecha: proyecto.entregaEstimada,
      lugar: proyecto.direccionEntrega.trim() === '' ? zona : proyecto.direccionEntrega,
    });
  }
  if (enSeguimiento && proyecto.fechaVisita !== null) {
    eventos.push({
      ...comun,
      id: `visita:${proyecto.id}`,
      categoria: 'visita',
      fecha: proyecto.fechaVisita,
      lugar: zona,
    });
  }
  if (
    enSeguimiento &&
    proyecto.estado !== 'presupuesto_enviado' &&
    proyecto.vencimientoPresupuesto !== null
  ) {
    eventos.push({
      ...comun,
      id: `presupuesto:${proyecto.id}`,
      categoria: 'presupuesto',
      fecha: proyecto.vencimientoPresupuesto,
      lugar: zona,
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

function horaDe(evento: EventoDeLaAgenda): string | null {
  return evento.clase === 'propia' ? evento.hora : null;
}

function textoDe(evento: EventoDeLaAgenda): string {
  return evento.clase === 'propia' ? evento.texto : evento.titulo;
}

function compararEventos(uno: EventoDeLaAgenda, otro: EventoDeLaAgenda): number {
  if (uno.fecha !== otro.fecha) return uno.fecha < otro.fecha ? -1 : 1;

  const horaUno = horaDe(uno) ?? '';
  const horaOtro = horaDe(otro) ?? '';
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
    if (evento.clase === 'propia' && evento.hecha) return false;
    return diasEntre(hoy, evento.fecha) <= preferencia.anticipacion;
  });
}
