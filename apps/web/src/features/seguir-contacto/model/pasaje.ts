import { calcularSena, centavos, type PuntosBasicos, type SenaDelTrabajo } from '@maun/domain';

import {
  aprobacionDeUnaOpcion,
  datosActualesDelProyecto,
  opcionAprobada,
  ultimoContactoAlGuardar,
  type Comprobante,
  type FormaDePago,
  type GuardadoDeProyecto,
  type OpcionDePresupuesto,
  type Proyecto,
} from '@/entities/proyecto';
import type { DatosDeProyecto, PagoParaGuardar } from '@/shared/api';

export const CONCEPTO_DE_LA_SENA_AL_APROBAR = 'Seña';

export interface ValoresDelPasaje {
  presupuesto: number | null;
  opcion: string | null;
  sena: number | null;
  forma: FormaDePago;
  comprobante: Comprobante;
  inicio: string;
  entrega: string;
  direccion: string;
}

type LoQueDecideElPresupuesto = Pick<ValoresDelPasaje, 'presupuesto' | 'opcion'>;

export function opcionElegida(
  opciones: readonly OpcionDePresupuesto[],
  id: string | null,
): OpcionDePresupuesto | undefined {
  return opciones.find((opcion) => opcion.id === id);
}

export function presupuestoDelPasaje(
  opciones: readonly OpcionDePresupuesto[],
  valores: LoQueDecideElPresupuesto,
): number | null {
  if (opciones.length === 0) return valores.presupuesto;
  return opcionElegida(opciones, valores.opcion)?.monto_centavos ?? null;
}

export function errorDelPasaje(
  opciones: readonly OpcionDePresupuesto[],
  valores: LoQueDecideElPresupuesto,
): string | undefined {
  if (opciones.length > 0) {
    return opcionElegida(opciones, valores.opcion) === undefined
      ? 'Elegí la opción que aprobó.'
      : undefined;
  }
  return valores.presupuesto === null ? 'Poné el presupuesto que aprobó, en pesos.' : undefined;
}

export function senaDelPasaje(
  aprobado: number | null,
  cobrado: number,
  porcentajeDelTaller: PuntosBasicos,
  porcentajeDelTrabajo: PuntosBasicos | null,
): SenaDelTrabajo {
  return calcularSena({
    presupuesto: aprobado === null ? null : centavos(aprobado),
    cobrado: centavos(cobrado),
    porcentajeDelTaller,
    porcentajeDelTrabajo,
  });
}

export function senaSugerida(sena: SenaDelTrabajo): number | null {
  return sena.situacion === 'falta' ? sena.falta : null;
}

export interface ResumenDelPasaje {
  antes: number;
  ahora: number;
  cobrado: number;
  saldo: number | null;
}

export function resumenDelPasaje(
  aprobado: number | null,
  antes: number,
  sena: number | null,
): ResumenDelPasaje {
  const ahora = sena === null || sena <= 0 ? 0 : sena;
  const cobrado = antes + ahora;
  return {
    antes,
    ahora,
    cobrado,
    saldo: aprobado === null ? null : Math.max(0, aprobado - cobrado),
  };
}

function pagoDeLaSena(monto: number | null, id: string, fecha: string): PagoParaGuardar[] {
  if (monto === null || monto <= 0) return [];
  return [{ id, fecha, concepto: CONCEPTO_DE_LA_SENA_AL_APROBAR, monto_centavos: monto }];
}

export function guardadoDelPasaje(
  proyecto: Proyecto,
  opciones: readonly OpcionDePresupuesto[],
  valores: ValoresDelPasaje,
  hoy: string,
  idDelPago: string,
): GuardadoDeProyecto {
  const datos: DatosDeProyecto = {
    ...datosActualesDelProyecto(proyecto),
    estado: 'en_curso',
    ultimo_contacto: ultimoContactoAlGuardar(proyecto, 'en_curso', hoy),
    presupuesto_centavos: presupuestoDelPasaje(opciones, valores),
    forma_pago: valores.forma,
    comprobante: valores.comprobante,
    fecha_inicio: valores.inicio === '' ? null : valores.inicio,
    entrega_estimada: valores.entrega === '' ? null : valores.entrega,
    direccion_entrega: valores.direccion.trim(),
  };

  const pagos = pagoDeLaSena(valores.sena, idDelPago, valores.inicio === '' ? hoy : valores.inicio);

  const elegida = opcionElegida(opciones, valores.opcion);
  if (elegida === undefined || elegida.id === opcionAprobada(opciones)?.id) {
    return {
      pedido: { id: proyecto.id, version: proyecto.version, datos, pagos, gastos: [] },
      previos: { proyecto, pagos: [], gastos: [], opciones: [], necesidades: [] },
    };
  }

  const aprobacion = aprobacionDeUnaOpcion(proyecto, opciones, elegida.id, true);
  return { ...aprobacion, pedido: { ...aprobacion.pedido, datos, pagos } };
}
