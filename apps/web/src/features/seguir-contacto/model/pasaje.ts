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
import type { DatosDeProyecto } from '@/shared/api';

export interface ValoresDelPasaje {
  presupuesto: number | null;
  opcion: string | null;
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

export function guardadoDelPasaje(
  proyecto: Proyecto,
  opciones: readonly OpcionDePresupuesto[],
  valores: ValoresDelPasaje,
  hoy: string,
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

  const elegida = opcionElegida(opciones, valores.opcion);
  if (elegida === undefined || elegida.id === opcionAprobada(opciones)?.id) {
    return {
      pedido: { id: proyecto.id, version: proyecto.version, datos, pagos: [], gastos: [] },
      previos: { proyecto, pagos: [], gastos: [], opciones: [], necesidades: [] },
    };
  }

  const aprobacion = aprobacionDeUnaOpcion(proyecto, opciones, elegida.id, true);
  return { ...aprobacion, pedido: { ...aprobacion.pedido, datos } };
}
