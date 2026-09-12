import { ESTADOS, puedeCambiarEstado, type EstadoProyecto } from '@maun/domain';
import { z } from 'zod';

import {
  COLUMNAS_DE_PROYECTO,
  type BajaDeFilaHija,
  type CambiosDeProyecto,
  type DatosDeProyecto,
  type GastoParaGuardar,
  type PagoParaGuardar,
  type ProyectoParaGuardar,
} from '@/shared/api';
import { hoyLocal, parsearPesos, parsearPesosDesdeCero, pesosEditables } from '@/shared/lib';

import {
  COMPROBANTES_EN_ORDEN,
  FORMAS_EN_ORDEN,
  type Comprobante,
  type Gasto,
  type Pago,
  type Proyecto,
} from './catalogos';

const SIN_MONTO = 'Poné cuánto, en pesos.';

function texto(maximo: number) {
  return z
    .string()
    .trim()
    .max(maximo, { error: `No puede pasar de ${String(maximo)} caracteres.` });
}

// Cada fila de pagos y gastos es su propio bloque en el celular, y su propio error: si el usuario
// dejó una fila a medias, el mensaje tiene que caer en esa fila y no arriba de todo.
const filaDinamica = z.object({
  id: z.string(),
  fecha: z.string().min(1, { error: 'Poné la fecha.' }),
  detalle: texto(500),
  monto: z.string().refine((valor) => parsearPesos(valor) !== undefined, { error: SIN_MONTO }),
});

export const esquemaDeProyecto = z.object({
  cliente_id: z.string().min(1, { error: 'Elegí un cliente, o creá uno nuevo desde acá.' }),
  titulo: texto(200).min(1, { error: 'Contá qué mueble es.' }),
  descripcion: texto(10_000),
  estado: z.enum(ESTADOS),
  presupuesto: z
    .string()
    .refine((valor) => valor.trim() === '' || parsearPesosDesdeCero(valor) !== undefined, {
      error: 'Revisá el presupuesto: va en pesos.',
    }),
  forma_pago: z.enum(FORMAS_EN_ORDEN).nullable(),
  comprobante: z.enum(COMPROBANTES_EN_ORDEN),
  fecha_visita: z.string(),
  ultimo_contacto: z.string(),
  fecha_inicio: z.string(),
  entrega_estimada: z.string(),
  fecha_entrega: z.string(),
  direccion_entrega: texto(500),
  notas: texto(10_000),
  pagos: z.array(filaDinamica),
  gastos: z.array(filaDinamica),
});

export type FormularioDeProyecto = z.infer<typeof esquemaDeProyecto>;
export type FilaDinamica = z.infer<typeof filaDinamica>;

function fecha(valor: string | null): string {
  return valor ?? '';
}

function fechaOnNull(valor: string): string | null {
  return valor.trim() === '' ? null : valor;
}

export function filaVacia(id: string, hoy: string = hoyLocal()): FilaDinamica {
  return { id, fecha: hoy, detalle: '', monto: '' };
}

export function valoresDelFormulario(
  proyecto: Proyecto | undefined,
  pagos: readonly Pago[],
  gastos: readonly Gasto[],
  inicial: { clienteId?: string; comprobante?: Comprobante; direccion?: string; hoy: string },
): FormularioDeProyecto {
  if (proyecto === undefined) {
    return {
      cliente_id: inicial.clienteId ?? '',
      titulo: '',
      descripcion: '',
      estado: 'en_curso',
      presupuesto: '',
      forma_pago: 'transferencia',
      comprobante: inicial.comprobante ?? 'sin_comprobante',
      fecha_visita: '',
      ultimo_contacto: '',
      fecha_inicio: inicial.hoy,
      entrega_estimada: '',
      fecha_entrega: '',
      direccion_entrega: inicial.direccion ?? '',
      notas: '',
      pagos: [],
      gastos: [],
    };
  }

  return {
    cliente_id: proyecto.cliente_id,
    titulo: proyecto.titulo,
    descripcion: proyecto.descripcion,
    estado: proyecto.estado,
    presupuesto:
      proyecto.presupuesto_centavos === null ? '' : pesosEditables(proyecto.presupuesto_centavos),
    forma_pago: proyecto.forma_pago,
    comprobante: proyecto.comprobante,
    fecha_visita: fecha(proyecto.fecha_visita),
    ultimo_contacto: fecha(proyecto.ultimo_contacto),
    fecha_inicio: fecha(proyecto.fecha_inicio),
    entrega_estimada: fecha(proyecto.entrega_estimada),
    fecha_entrega: fecha(proyecto.fecha_entrega),
    direccion_entrega: proyecto.direccion_entrega,
    notas: proyecto.notas,
    pagos: pagos.map((pago) => ({
      id: pago.id,
      fecha: pago.fecha,
      detalle: pago.concepto,
      monto: pesosEditables(pago.monto_centavos),
    })),
    gastos: gastos.map((gasto) => ({
      id: gasto.id,
      fecha: gasto.fecha,
      detalle: gasto.descripcion,
      monto: pesosEditables(gasto.monto_centavos),
    })),
  };
}

export function datosDelFormulario(valores: FormularioDeProyecto): DatosDeProyecto {
  const presupuesto = parsearPesosDesdeCero(valores.presupuesto);
  return {
    cliente_id: valores.cliente_id,
    titulo: valores.titulo.trim(),
    descripcion: valores.descripcion.trim(),
    estado: valores.estado,
    presupuesto_centavos: valores.presupuesto.trim() === '' ? null : (presupuesto ?? null),
    forma_pago: valores.forma_pago,
    comprobante: valores.comprobante,
    fecha_visita: fechaOnNull(valores.fecha_visita),
    ultimo_contacto: fechaOnNull(valores.ultimo_contacto),
    fecha_inicio: fechaOnNull(valores.fecha_inicio),
    entrega_estimada: fechaOnNull(valores.entrega_estimada),
    fecha_entrega: fechaOnNull(valores.fecha_entrega),
    direccion_entrega: valores.direccion_entrega.trim(),
    notas: valores.notas.trim(),
  };
}

// Las bajas son las filas que estaban y ya no: se mandan marcadas en el mismo array, y solo las que
// existían de verdad. Una fila que el usuario agregó y sacó sin guardar nunca llegó a la base.
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
  existentes: { pagos: readonly string[]; gastos: readonly string[] },
): ProyectoParaGuardar {
  const monto = (valor: string) => parsearPesos(valor) ?? 0;

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

  return {
    id,
    version,
    datos: datosDelFormulario(valores),
    pagos: [...pagos, ...bajasDe(pagos, existentes.pagos)],
    gastos: [...gastos, ...bajasDe(gastos, existentes.gastos)],
  };
}

// El select de estado ofrece solo lo que la base acepta: el estado actual y las transiciones que
// valen desde ahí. Un estado inválido rebota con MN007, que es un rechazo definitivo y tapa la cola.
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

export function totalDeLasFilas(filas: readonly { monto: string }[]): number {
  return filas.reduce((suma, fila) => suma + (parsearPesos(fila.monto) ?? 0), 0);
}
