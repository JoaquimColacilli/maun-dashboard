import { vencimientoDelPresupuesto, type EstadoProyecto } from '@maun/domain';

import {
  cambiaLaFila,
  datosActualesDelProyecto,
  etapaAlGuardarElContacto,
  ultimoContactoAlGuardar,
  vencimientoPropuesto,
  yaSeRelevo,
  type Pago,
  type Proyecto,
} from '@/entities/proyecto';
import type { DatosDeProyecto, PagoParaGuardar, ProyectoParaGuardar } from '@/shared/api';
import { fechaDelEnlace, hayCambios } from '@/shared/lib';

export const CONCEPTO_DE_LA_SENA = 'Seña de la visita';

export interface ValoresDelContacto {
  clienteId: string;
  titulo: string;
  visita: string;
  sena: number | null;
  notas: string;
  vencimiento: string;
}

export interface ErroresDelContacto {
  cliente?: string;
  titulo?: string;
  telefono?: string;
  notas?: string;
}

export function senaEditable(pagos: readonly Pago[]): Pago | undefined {
  return pagos.length === 1 ? pagos[0] : undefined;
}

export function valoresDelContacto(
  proyecto: Proyecto | undefined,
  sena: Pago | undefined,
  visitaInicial = '',
): ValoresDelContacto {
  return {
    clienteId: proyecto?.cliente_id ?? '',
    titulo: proyecto?.titulo ?? '',
    visita: proyecto?.fecha_visita ?? visitaInicial,
    sena: sena === undefined ? null : sena.monto_centavos,
    notas: proyecto?.notas ?? '',
    vencimiento: proyecto?.vencimiento_presupuesto ?? '',
  };
}

function recortados(valores: ValoresDelContacto): ValoresDelContacto {
  return { ...valores, titulo: valores.titulo.trim(), notas: valores.notas.trim() };
}

export function hayCambiosEnElContacto(
  iniciales: ValoresDelContacto,
  actuales: ValoresDelContacto,
  telefonoDelCliente: string,
  telefonoEscrito: string | undefined,
): boolean {
  const cambioElTelefono =
    telefonoEscrito !== undefined && telefonoEscrito.trim() !== telefonoDelCliente.trim();
  return cambioElTelefono || hayCambios(recortados(iniciales), recortados(actuales));
}

export function muestraElVencimiento(proyecto: Proyecto | undefined): boolean {
  return (
    proyecto !== undefined &&
    (proyecto.estado === 'contacto' ||
      proyecto.estado === 'relevamiento' ||
      proyecto.estado === 'a_presupuestar')
  );
}

export function etiquetaDeLaVisita(proyecto: Proyecto | undefined, hoy: string): string {
  return proyecto !== undefined && yaSeRelevo(proyecto, hoy)
    ? 'Día que fuiste a relevar'
    : 'Visita';
}

function vencimientoDeLaVisita(visita: string, hoy: string): string | null {
  const fecha = fechaDelEnlace(visita);
  return fecha === undefined || fecha > hoy ? null : vencimientoDelPresupuesto(fecha);
}

export function valoresConOtraVisita(
  proyecto: Proyecto | undefined,
  valores: ValoresDelContacto,
  visita: string,
  hoy: string,
): ValoresDelContacto {
  const siguientes = { ...valores, visita };
  if (proyecto === undefined || proyecto.estado !== 'a_presupuestar') return siguientes;

  const propuestoAntes = vencimientoDeLaVisita(valores.visita, hoy);
  const puestoAMano = valores.vencimiento !== '' && valores.vencimiento !== propuestoAntes;
  const propuestoAhora = vencimientoDeLaVisita(visita, hoy);
  if (puestoAMano || propuestoAhora === null) return siguientes;
  return { ...siguientes, vencimiento: propuestoAhora };
}

function vencimientoDelContacto(
  proyecto: Proyecto | undefined,
  estado: EstadoProyecto,
  valores: ValoresDelContacto,
  hoy: string,
): string | null {
  const escrito = valores.vencimiento.trim();
  if (escrito !== '') return escrito;
  if (proyecto !== undefined && proyecto.vencimiento_presupuesto !== null) return null;
  return vencimientoPropuesto(proyecto, estado, valores.visita.trim(), hoy);
}

export function erroresDelContacto(
  valores: ValoresDelContacto,
  telefono: string,
): ErroresDelContacto {
  const errores: ErroresDelContacto = {};
  const titulo = valores.titulo.trim();

  if (valores.clienteId === '') {
    errores.cliente = 'Elegí un cliente, o escribí su nombre para crearlo.';
  }
  if (titulo === '') errores.titulo = 'Contá qué pide, aunque sea en dos palabras.';
  else if (titulo.length > 200) errores.titulo = 'No puede pasar de 200 caracteres.';
  if (telefono.trim().length > 200) errores.telefono = 'No puede pasar de 200 caracteres.';
  if (valores.notas.trim().length > 10_000) errores.notas = 'Las notas son demasiado largas.';
  return errores;
}

const DATOS_DE_UN_CONTACTO_NUEVO: DatosDeProyecto = {
  cliente_id: '',
  titulo: '',
  descripcion: '',
  estado: 'contacto',
  presupuesto_centavos: null,
  forma_pago: null,
  comprobante: 'sin_comprobante',
  fecha_visita: null,
  ultimo_contacto: null,
  fecha_inicio: null,
  entrega_estimada: null,
  fecha_entrega: null,
  direccion_entrega: '',
  notas: '',
  vencimiento_presupuesto: null,
};

function pagosDeLaSena(
  valores: ValoresDelContacto,
  sena: Pago | undefined,
  idDeSenaNueva: string,
  hoy: string,
): PagoParaGuardar[] {
  const monto = valores.sena ?? 0;

  if (sena !== undefined) {
    if (monto === 0) return [{ id: sena.id, borrado: true }];
    if (monto === sena.monto_centavos) return [];
    return [{ id: sena.id, fecha: sena.fecha, concepto: sena.concepto, monto_centavos: monto }];
  }

  if (monto === 0) return [];
  const visita = valores.visita.trim();
  return [
    {
      id: idDeSenaNueva,
      fecha: visita !== '' && visita <= hoy ? visita : hoy,
      concepto: CONCEPTO_DE_LA_SENA,
      monto_centavos: monto,
    },
  ];
}

export interface EntradaDelContacto {
  id: string;
  proyecto: Proyecto | undefined;
  valores: ValoresDelContacto;
  sena: Pago | undefined;
  idDeSenaNueva: string;
  hoy: string;
}

export function pedidoDelContacto({
  id,
  proyecto,
  valores,
  sena,
  idDeSenaNueva,
  hoy,
}: EntradaDelContacto): ProyectoParaGuardar {
  const base =
    proyecto === undefined ? DATOS_DE_UN_CONTACTO_NUEVO : datosActualesDelProyecto(proyecto);
  const visita = valores.visita.trim();
  const estado = etapaAlGuardarElContacto(proyecto, visita, hoy);

  return {
    id,
    version: proyecto?.version ?? null,
    datos: {
      ...base,
      cliente_id: valores.clienteId,
      titulo: valores.titulo.trim(),
      estado,
      fecha_visita: visita === '' ? null : visita,
      ultimo_contacto: ultimoContactoAlGuardar(proyecto, estado, hoy, visita === '' ? hoy : visita),
      notas: valores.notas.trim(),
      vencimiento_presupuesto: vencimientoDelContacto(proyecto, estado, valores, hoy),
    },
    pagos: pagosDeLaSena(valores, sena, idDeSenaNueva, hoy),
    gastos: [],
  };
}

export function hayQueGuardar(
  proyecto: Proyecto | undefined,
  pedido: ProyectoParaGuardar,
): boolean {
  return proyecto === undefined || pedido.pagos.length > 0 || cambiaLaFila(proyecto, pedido.datos);
}
