import {
  esAnteriorALaApertura,
  vencimientoDelPresupuesto,
  type EstadoProyecto,
} from '@maun/domain';

import {
  cambiaLaFila,
  datosActualesDelProyecto,
  etapaAlGuardarElContacto,
  ultimoContactoAlGuardar,
  vencimientoPropuesto,
  vigenciaDelPresupuesto,
  yaSeRelevo,
  type Pago,
  type Proyecto,
} from '@/entities/proyecto';
import {
  horaDeLaVisita,
  visitaHecha,
  type DatosDeProyecto,
  type PagoParaGuardar,
  type ProyectoParaGuardar,
} from '@/shared/api';
import { errorDeLaFechaDeLaPlata, fechaDelEnlace, hayCambios } from '@/shared/lib';

export const CONCEPTO_DE_LA_SENA = 'Seña de la visita';

export interface ValoresDelContacto {
  clienteId: string;
  titulo: string;
  visita: string;
  visitaHora: string;
  visitaHecha: boolean;
  sena: number | null;
  diaDeLaSena: string | null;
  senaEnLaApertura: boolean;
  notas: string;
  vencimiento: string;
  valeHasta: string;
}

export interface ErroresDelContacto {
  cliente?: string;
  titulo?: string;
  telefono?: string;
  diaDeLaSena?: string;
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
    visitaHora: proyecto === undefined ? '' : (horaDeLaVisita(proyecto) ?? ''),
    visitaHecha: proyecto === undefined ? false : visitaHecha(proyecto),
    sena: sena === undefined ? null : sena.monto_centavos,
    diaDeLaSena: sena === undefined ? null : sena.fecha,
    senaEnLaApertura:
      sena === undefined ? true : (sena as Partial<Pago>).ya_en_la_apertura === true,
    notas: proyecto?.notas ?? '',
    vencimiento: proyecto?.vencimiento_presupuesto ?? '',
    valeHasta: proyecto === undefined ? '' : (vigenciaDelPresupuesto(proyecto) ?? ''),
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

export function muestraLaVigencia(proyecto: Proyecto | undefined): boolean {
  return proyecto !== undefined && proyecto.estado === 'presupuesto_enviado';
}

export function etiquetaDeLaVisita(proyecto: Proyecto | undefined, hoy: string): string {
  return proyecto !== undefined && yaSeRelevo(proyecto, hoy)
    ? 'Día que fuiste a relevar'
    : 'Visita';
}

export function ofreceMarcarLaVisita(
  proyecto: Proyecto | undefined,
  valores: ValoresDelContacto,
  hoy: string,
): boolean {
  if (proyecto === undefined || proyecto.estado === 'contacto') return false;
  const fecha = fechaDelEnlace(valores.visita);
  return fecha !== undefined && fecha <= hoy;
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
  const fecha = fechaDelEnlace(visita);
  const siguientes = {
    ...valores,
    visita,
    visitaHecha: valores.visitaHecha && fecha !== undefined && fecha <= hoy,
  };
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

function vigenciaAlGuardar(
  proyecto: Proyecto | undefined,
  valores: ValoresDelContacto,
  guardada: DatosDeProyecto['presupuesto_vale_hasta'],
): DatosDeProyecto['presupuesto_vale_hasta'] {
  if (proyecto === undefined || !muestraLaVigencia(proyecto)) return guardada;
  const escrita = fechaDelEnlace(valores.valeHasta.trim()) ?? null;
  return escrita === vigenciaDelPresupuesto(proyecto) ? guardada : escrita;
}

function visitaHechaAlGuardar(
  proyecto: Proyecto | undefined,
  estado: EstadoProyecto,
  valores: ValoresDelContacto,
  hoy: string,
): boolean {
  const fecha = fechaDelEnlace(valores.visita.trim());
  if (fecha === undefined || fecha > hoy) return false;
  const quedaAPresupuestarPorLaFecha =
    estado === 'a_presupuestar' && proyecto?.estado !== 'a_presupuestar';
  return quedaAPresupuestarPorLaFecha || valores.visitaHecha;
}

export function diaDeLaSena(valores: ValoresDelContacto, hoy: string): string {
  if (valores.diaDeLaSena !== null) return valores.diaDeLaSena;
  const visita = fechaDelEnlace(valores.visita.trim());
  return visita !== undefined && visita <= hoy ? visita : hoy;
}

export function erroresDelContacto(
  valores: ValoresDelContacto,
  telefono: string,
  hoy: string,
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
  if ((valores.sena ?? 0) > 0) {
    const delDia = errorDeLaFechaDeLaPlata(diaDeLaSena(valores, hoy), hoy);
    if (delDia !== undefined) errores.diaDeLaSena = delDia;
  }
  return errores;
}

const DATOS_DE_UN_CONTACTO_NUEVO: DatosDeProyecto = {
  cliente_id: '',
  titulo: '',
  descripcion: '',
  estado: 'contacto',
  presupuesto_centavos: null,
  sena_bp: null,
  forma_pago: null,
  comprobante: 'sin_comprobante',
  fecha_visita: null,
  visita_hora: null,
  ultimo_contacto: null,
  fecha_inicio: null,
  entrega_estimada: null,
  entrega_hora: null,
  fecha_entrega: null,
  direccion_entrega: '',
  notas: '',
  vencimiento_presupuesto: null,
  visita_hecha: false,
  presupuesto_vale_hasta: null,
};

function pagosDeLaSena(
  valores: ValoresDelContacto,
  sena: Pago | undefined,
  idDeSenaNueva: string,
  hoy: string,
  apertura: string | null,
): PagoParaGuardar[] {
  const monto = valores.sena ?? 0;
  const fecha = valores.diaDeLaSena ?? sena?.fecha ?? diaDeLaSena(valores, hoy);
  const enLaApertura = valores.senaEnLaApertura && esAnteriorALaApertura(fecha, apertura);

  if (sena !== undefined) {
    if (monto === 0) return [{ id: sena.id, borrado: true }];
    const igual =
      monto === sena.monto_centavos &&
      fecha === sena.fecha &&
      enLaApertura === ((sena as Partial<Pago>).ya_en_la_apertura === true);
    if (igual) return [];
    return [
      {
        id: sena.id,
        fecha,
        concepto: sena.concepto,
        monto_centavos: monto,
        ya_en_la_apertura: enLaApertura,
      },
    ];
  }

  if (monto === 0) return [];
  return [
    {
      id: idDeSenaNueva,
      fecha,
      concepto: CONCEPTO_DE_LA_SENA,
      monto_centavos: monto,
      ya_en_la_apertura: enLaApertura,
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
  apertura?: string | null;
}

export function pedidoDelContacto({
  id,
  proyecto,
  valores,
  sena,
  idDeSenaNueva,
  hoy,
  apertura = null,
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
      // Una hora sin su día no quiere decir nada: si se borra la visita, se va con ella.
      visita_hora: visita === '' || valores.visitaHora.trim() === '' ? null : valores.visitaHora,
      visita_hecha: visitaHechaAlGuardar(proyecto, estado, valores, hoy),
      ultimo_contacto: ultimoContactoAlGuardar(proyecto, estado, hoy, visita === '' ? hoy : visita),
      notas: valores.notas.trim(),
      vencimiento_presupuesto: vencimientoDelContacto(proyecto, estado, valores, hoy),
      presupuesto_vale_hasta: vigenciaAlGuardar(proyecto, valores, base.presupuesto_vale_hasta),
    },
    pagos: pagosDeLaSena(valores, sena, idDeSenaNueva, hoy, apertura),
    gastos: [],
  };
}

export function hayQueGuardar(
  proyecto: Proyecto | undefined,
  pedido: ProyectoParaGuardar,
): boolean {
  return proyecto === undefined || pedido.pagos.length > 0 || cambiaLaFila(proyecto, pedido.datos);
}
