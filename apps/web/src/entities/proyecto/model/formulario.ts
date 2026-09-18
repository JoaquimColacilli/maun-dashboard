import { ESTADOS, puedeCambiarEstado, type EstadoProyecto } from '@maun/domain';
import { z } from 'zod';

import {
  COLUMNAS_DE_PROYECTO,
  horaDeLaEntrega,
  horaDeLaVisita,
  visitaHecha,
  type BajaDeFilaHija,
  type CambiosDeProyecto,
  type DatosDeProyecto,
  type GastoParaGuardar,
  type OpcionParaGuardar,
  type PagoParaGuardar,
  type ProyectoParaGuardar,
} from '@/shared/api';
import { formatearPorcentaje, hoyLocal, parsearPorcentaje, SENA_MAXIMA_BP } from '@/shared/lib';

import {
  COMPROBANTES_EN_ORDEN,
  FORMAS_EN_ORDEN,
  type Comprobante,
  type Gasto,
  type Pago,
  type Proyecto,
} from './catalogos';
import { senaDelProyecto, type OpcionDePresupuesto } from './opciones';

const SIN_MONTO = 'Poné cuánto, en pesos.';

function texto(maximo: number) {
  return z
    .string()
    .trim()
    .max(maximo, { error: `No puede pasar de ${String(maximo)} caracteres.` });
}

const monto = z
  .number()
  .int()
  .nullable()
  .refine((valor) => valor !== null && valor > 0, { error: SIN_MONTO });

const filaDinamica = z.object({
  id: z.string(),
  fecha: z.string().min(1, { error: 'Poné la fecha.' }),
  detalle: texto(500),
  monto,
});

const filaDeOpcion = z.object({
  id: z.string(),
  detalle: texto(500),
  monto,
  aprobada: z.boolean(),
});

export const esquemaDeProyecto = z.object({
  cliente_id: z.string().min(1, { error: 'Elegí un cliente, o creá uno nuevo desde acá.' }),
  titulo: texto(200).min(1, { error: 'Contá qué mueble es.' }),
  descripcion: texto(10_000),
  estado: z.enum(ESTADOS),
  presupuesto: z
    .number()
    .int()
    .nonnegative({ error: 'Revisá el presupuesto: va en pesos.' })
    .nullable(),
  sena: z
    .string()
    .refine(
      (valor) => valor.trim() === '' || parsearPorcentaje(valor, SENA_MAXIMA_BP) !== undefined,
      { error: 'La seña va entre 0 y 100.' },
    ),
  forma_pago: z.enum(FORMAS_EN_ORDEN).nullable(),
  comprobante: z.enum(COMPROBANTES_EN_ORDEN),
  fecha_visita: z.string(),
  visita_hora: z.string(),
  visita_hecha: z.boolean(),
  ultimo_contacto: z.string(),
  fecha_inicio: z.string(),
  entrega_estimada: z.string(),
  entrega_hora: z.string(),
  fecha_entrega: z.string(),
  direccion_entrega: texto(500),
  notas: texto(10_000),
  vencimiento_presupuesto: z.string(),
  pagos: z.array(filaDinamica),
  gastos: z.array(filaDinamica),
  opciones: z.array(filaDeOpcion),
});

export type FormularioDeProyecto = z.infer<typeof esquemaDeProyecto>;
export type FilaDinamica = z.infer<typeof filaDinamica>;
export type FilaDeOpcion = z.infer<typeof filaDeOpcion>;

function fecha(valor: string | null): string {
  return valor ?? '';
}

// La base guarda una hora como HH:MM:SS y un <input type="time"> escribe HH:MM.
function hora(valor: string | null | undefined): string {
  return valor === null || valor === undefined ? '' : valor.slice(0, 5);
}

function fechaOnNull(valor: string): string | null {
  return valor.trim() === '' ? null : valor;
}

export function filaVacia(id: string, hoy: string = hoyLocal()): FilaDinamica {
  return { id, fecha: hoy, detalle: '', monto: null };
}

export function opcionVacia(id: string): FilaDeOpcion {
  return { id, detalle: '', monto: null, aprobada: false };
}

export function conLaOpcionAprobada(
  opciones: readonly FilaDeOpcion[],
  id: string,
  aprobada: boolean,
): FilaDeOpcion[] {
  return opciones.map((opcion) => ({
    ...opcion,
    aprobada: aprobada && opcion.id === id,
  }));
}

export function presupuestoDeLasOpciones(opciones: readonly FilaDeOpcion[]): number | null {
  if (opciones.length === 0) return null;
  return opciones.find((opcion) => opcion.aprobada)?.monto ?? null;
}

export function valoresDelFormulario(
  proyecto: Proyecto | undefined,
  pagos: readonly Pago[],
  gastos: readonly Gasto[],
  opciones: readonly OpcionDePresupuesto[],
  inicial: {
    clienteId?: string;
    comprobante?: Comprobante;
    direccion?: string;
    entrega?: string;
    hoy: string;
  },
): FormularioDeProyecto {
  if (proyecto === undefined) {
    return {
      cliente_id: inicial.clienteId ?? '',
      titulo: '',
      descripcion: '',
      estado: 'en_curso',
      presupuesto: null,
      sena: '',
      forma_pago: 'transferencia',
      comprobante: inicial.comprobante ?? 'sin_comprobante',
      fecha_visita: '',
      visita_hora: '',
      visita_hecha: false,
      ultimo_contacto: '',
      fecha_inicio: inicial.hoy,
      entrega_estimada: inicial.entrega ?? '',
      entrega_hora: '',
      fecha_entrega: '',
      direccion_entrega: inicial.direccion ?? '',
      notas: '',
      vencimiento_presupuesto: '',
      pagos: [],
      gastos: [],
      opciones: [],
    };
  }

  const propia = senaDelProyecto(proyecto);

  return {
    cliente_id: proyecto.cliente_id,
    titulo: proyecto.titulo,
    descripcion: proyecto.descripcion,
    estado: proyecto.estado,
    presupuesto: proyecto.presupuesto_centavos,
    sena: propia === null ? '' : formatearPorcentaje(propia),
    forma_pago: proyecto.forma_pago,
    comprobante: proyecto.comprobante,
    fecha_visita: fecha(proyecto.fecha_visita),
    visita_hora: hora(horaDeLaVisita(proyecto)),
    visita_hecha: visitaHecha(proyecto),
    ultimo_contacto: fecha(proyecto.ultimo_contacto),
    fecha_inicio: fecha(proyecto.fecha_inicio),
    entrega_estimada: fecha(proyecto.entrega_estimada),
    entrega_hora: hora(horaDeLaEntrega(proyecto)),
    fecha_entrega: fecha(proyecto.fecha_entrega),
    direccion_entrega: proyecto.direccion_entrega,
    notas: proyecto.notas,
    vencimiento_presupuesto: fecha(proyecto.vencimiento_presupuesto),
    pagos: pagos.map((pago) => ({
      id: pago.id,
      fecha: pago.fecha,
      detalle: pago.concepto,
      monto: pago.monto_centavos,
    })),
    gastos: gastos.map((gasto) => ({
      id: gasto.id,
      fecha: gasto.fecha,
      detalle: gasto.descripcion,
      monto: gasto.monto_centavos,
    })),
    opciones: opciones.map((opcion) => ({
      id: opcion.id,
      detalle: opcion.descripcion,
      monto: opcion.monto_centavos,
      aprobada: opcion.aprobada,
    })),
  };
}

export function datosDelFormulario(
  valores: FormularioDeProyecto,
  hoy: string = hoyLocal(),
): DatosDeProyecto {
  const fechaVisita = fechaOnNull(valores.fecha_visita);
  const entregaEstimada = fechaOnNull(valores.entrega_estimada);
  return {
    cliente_id: valores.cliente_id,
    titulo: valores.titulo.trim(),
    descripcion: valores.descripcion.trim(),
    estado: valores.estado,
    presupuesto_centavos:
      valores.opciones.length > 0
        ? presupuestoDeLasOpciones(valores.opciones)
        : valores.presupuesto,
    sena_bp:
      valores.sena.trim() === '' ? null : (parsearPorcentaje(valores.sena, SENA_MAXIMA_BP) ?? null),
    forma_pago: valores.forma_pago,
    comprobante: valores.comprobante,
    fecha_visita: fechaVisita,
    // Una hora sin su día no quiere decir nada: si se borra la fecha, se va con ella.
    visita_hora: fechaVisita === null ? null : fechaOnNull(valores.visita_hora),
    visita_hecha: valores.visita_hecha && fechaVisita !== null && fechaVisita <= hoy,
    ultimo_contacto: fechaOnNull(valores.ultimo_contacto),
    fecha_inicio: fechaOnNull(valores.fecha_inicio),
    entrega_estimada: entregaEstimada,
    entrega_hora: entregaEstimada === null ? null : fechaOnNull(valores.entrega_hora),
    fecha_entrega: fechaOnNull(valores.fecha_entrega),
    direccion_entrega: valores.direccion_entrega.trim(),
    notas: valores.notas.trim(),
    vencimiento_presupuesto: fechaOnNull(valores.vencimiento_presupuesto),
  };
}

function bajasDe(
  vivas: readonly { id: string }[],
  existentes: readonly string[],
): BajaDeFilaHija[] {
  const quedan = new Set(vivas.map((fila) => fila.id));
  return existentes.filter((id) => !quedan.has(id)).map((id) => ({ id, borrado: true }));
}

export function pedidoDeGuardado(
  id: string,
  version: number | null,
  valores: FormularioDeProyecto,
  existentes: { pagos: readonly string[]; gastos: readonly string[]; opciones: readonly string[] },
): ProyectoParaGuardar {
  const monto = (valor: number | null) => valor ?? 0;

  const pagos: PagoParaGuardar[] = valores.pagos.map((fila) => ({
    id: fila.id,
    fecha: fila.fecha,
    concepto: fila.detalle.trim(),
    monto_centavos: monto(fila.monto),
  }));

  const gastos: GastoParaGuardar[] = valores.gastos.map((fila) => ({
    id: fila.id,
    fecha: fila.fecha,
    descripcion: fila.detalle.trim(),
    monto_centavos: monto(fila.monto),
  }));

  const opciones: OpcionParaGuardar[] = valores.opciones.map((fila) => ({
    id: fila.id,
    descripcion: fila.detalle.trim(),
    monto_centavos: monto(fila.monto),
    aprobada: fila.aprobada,
  }));

  return {
    id,
    version,
    datos: datosDelFormulario(valores),
    pagos: [...pagos, ...bajasDe(pagos, existentes.pagos)],
    gastos: [...gastos, ...bajasDe(gastos, existentes.gastos)],
    opciones: [...opciones, ...bajasDe(opciones, existentes.opciones)],
  };
}

export function estadosDisponibles(actual: EstadoProyecto): EstadoProyecto[] {
  return ESTADOS.filter((estado) => estado === actual || puedeCambiarEstado(actual, estado));
}

export function cambiaLaFila(actual: Proyecto, cambios: CambiosDeProyecto): boolean {
  return COLUMNAS_DE_PROYECTO.some(
    (columna) => columna in cambios && actual[columna] !== cambios[columna],
  );
}

export function versionDelGuardado(
  actual: Proyecto | null | undefined,
  datos: CambiosDeProyecto,
): number {
  if (actual === null || actual === undefined) return 1;
  return cambiaLaFila(actual, datos) ? actual.version + 1 : actual.version;
}

export function totalDeLasFilas(filas: readonly { monto: number | null }[]): number {
  return filas.reduce((suma, fila) => suma + (fila.monto ?? 0), 0);
}
