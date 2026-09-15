import { entornoDePrueba, type EntornoDePrueba } from './entorno';

export interface SesionDePrueba {
  entorno: EntornoDePrueba;
  accessToken: string;
  usuarioId: string;
}

async function pedir(
  entorno: EntornoDePrueba,
  ruta: string,
  opciones: Omit<RequestInit, 'headers'> & {
    accessToken?: string;
    headers?: Record<string, string>;
  } = {},
): Promise<unknown> {
  const { accessToken, headers, ...resto } = opciones;
  const respuesta = await fetch(`${entorno.url}${ruta}`, {
    ...resto,
    headers: {
      apikey: entorno.publishableKey,
      'Content-Type': 'application/json',
      ...(accessToken === undefined ? {} : { Authorization: `Bearer ${accessToken}` }),
      ...headers,
    },
  });
  const cuerpo: unknown = respuesta.status === 204 ? null : await respuesta.json();
  if (!respuesta.ok) {
    throw new Error(`${ruta} devolvió ${String(respuesta.status)}: ${JSON.stringify(cuerpo)}`);
  }
  return cuerpo;
}

export async function iniciarSesionDePrueba(): Promise<SesionDePrueba> {
  const entorno = entornoDePrueba();
  const cuerpo = (await pedir(entorno, '/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email: entorno.email, password: entorno.password }),
  })) as { access_token?: string; user?: { id?: string } };

  const accessToken = cuerpo.access_token;
  const usuarioId = cuerpo.user?.id;
  if (accessToken === undefined || usuarioId === undefined) {
    throw new Error(
      'La cuenta de prueba no pudo iniciar sesión. Revisá E2E_EMAIL y E2E_PASSWORD, y que el mail esté confirmado.',
    );
  }
  return { entorno, accessToken, usuarioId };
}

export async function vaciarClientes({ entorno, accessToken }: SesionDePrueba): Promise<number> {
  const vivos = (await pedir(entorno, '/rest/v1/clientes?select=id&deleted_at=is.null', {
    accessToken,
  })) as { id: string }[];
  if (vivos.length === 0) return 0;

  await pedir(entorno, '/rest/v1/clientes?deleted_at=is.null', {
    method: 'PATCH',
    accessToken,
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ deleted_at: new Date().toISOString() }),
  });
  return vivos.length;
}

export interface FilaDeCliente {
  id: string;
  nombre: string;
  version: number;
  updated_at: string;
}

export async function contarClientes(
  { entorno, accessToken }: SesionDePrueba,
  nombre: string,
): Promise<number> {
  const filas = (await pedir(
    entorno,
    `/rest/v1/clientes?select=id&deleted_at=is.null&nombre=eq.${encodeURIComponent(nombre)}`,
    { accessToken },
  )) as { id: string }[];
  return filas.length;
}

export async function upsertCliente(
  { entorno, accessToken }: SesionDePrueba,
  datos: { id: string; nombre: string; zona?: string },
): Promise<FilaDeCliente> {
  const filas = (await pedir(entorno, '/rest/v1/clientes?on_conflict=id', {
    method: 'POST',
    accessToken,
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(datos),
  })) as FilaDeCliente[];
  const fila = filas[0];
  if (fila === undefined) throw new Error('el upsert no devolvió la fila');
  return fila;
}

export async function leerCliente(
  { entorno, accessToken }: SesionDePrueba,
  nombre: string,
): Promise<(FilaDeCliente & { zona: string }) | undefined> {
  const filas = (await pedir(
    entorno,
    `/rest/v1/clientes?select=id,nombre,zona,version,updated_at&deleted_at=is.null&nombre=eq.${encodeURIComponent(nombre)}`,
    { accessToken },
  )) as (FilaDeCliente & { zona: string })[];
  return filas[0];
}

export interface FilaDeProyecto {
  id: string;
  titulo: string;
  estado: string;
  version: number;
  presupuesto_centavos: number | null;
  fecha_entrega: string | null;
  visita_hecha: boolean;
  visita_importante: boolean;
  entrega_importante: boolean;
  presupuesto_importante: boolean;
}

export async function descongelarProyectos({
  entorno,
  accessToken,
}: SesionDePrueba): Promise<number> {
  const liquidados = (await pedir(
    entorno,
    '/rest/v1/proyectos?select=id,estado,version&deleted_at=is.null&estado=in.(cobrado,perdido)',
    { accessToken },
  )) as { id: string; estado: string; version: number }[];

  for (const proyecto of liquidados) {
    const esCobro = proyecto.estado === 'cobrado';
    await pedir(entorno, `/rest/v1/rpc/${esCobro ? 'reabrir_proyecto' : 'reactivar_perdido'}`, {
      method: 'POST',
      accessToken,
      body: JSON.stringify({
        p_proyecto_id: proyecto.id,
        p_version: proyecto.version,
        ...(esCobro ? {} : { p_estado: 'contacto' }),
      }),
    });
  }
  return liquidados.length;
}

export async function vaciarProyectos(sesion: SesionDePrueba): Promise<number> {
  const { entorno, accessToken } = sesion;
  await descongelarProyectos(sesion);

  const vivos = (await pedir(entorno, '/rest/v1/proyectos?select=id&deleted_at=is.null', {
    accessToken,
  })) as { id: string }[];
  if (vivos.length === 0) return 0;

  await pedir(entorno, '/rest/v1/proyectos?deleted_at=is.null', {
    method: 'PATCH',
    accessToken,
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ deleted_at: new Date().toISOString() }),
  });
  return vivos.length;
}

export interface FilaDeMovimiento {
  id: string;
  fecha: string;
  tipo: string;
  tesoro_origen: string | null;
  tesoro_destino: string | null;
  monto_centavos: number;
  categoria: string;
  descripcion: string;
}

export async function vaciarMovimientos({ entorno, accessToken }: SesionDePrueba): Promise<number> {
  const vivos = (await pedir(entorno, '/rest/v1/movimientos?select=id&deleted_at=is.null', {
    accessToken,
  })) as { id: string }[];
  if (vivos.length === 0) return 0;

  await pedir(entorno, '/rest/v1/movimientos?deleted_at=is.null', {
    method: 'PATCH',
    accessToken,
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ deleted_at: new Date().toISOString() }),
  });
  return vivos.length;
}

export async function movimientosDelTaller({
  entorno,
  accessToken,
}: SesionDePrueba): Promise<FilaDeMovimiento[]> {
  return (await pedir(
    entorno,
    '/rest/v1/movimientos?select=id,fecha,tipo,tesoro_origen,tesoro_destino,monto_centavos,categoria,descripcion&deleted_at=is.null&order=id',
    { accessToken },
  )) as FilaDeMovimiento[];
}

export async function vaciarAnotaciones({ entorno, accessToken }: SesionDePrueba): Promise<number> {
  const vivas = (await pedir(entorno, '/rest/v1/anotaciones?select=id&deleted_at=is.null', {
    accessToken,
  })) as { id: string }[];
  if (vivas.length === 0) return 0;

  await pedir(entorno, '/rest/v1/anotaciones?deleted_at=is.null', {
    method: 'PATCH',
    accessToken,
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ deleted_at: new Date().toISOString() }),
  });
  return vivas.length;
}

export interface FilaDeAnotacion {
  id: string;
  fecha: string;
  texto: string;
  categoria: string;
  hecha: boolean;
  importante: boolean;
}

export async function anotacionesDelTaller({
  entorno,
  accessToken,
}: SesionDePrueba): Promise<FilaDeAnotacion[]> {
  return (await pedir(
    entorno,
    '/rest/v1/anotaciones?select=id,fecha,texto,categoria,hecha,importante&deleted_at=is.null&order=fecha,texto',
    { accessToken },
  )) as FilaDeAnotacion[];
}

export async function crearAnotacionPorRest(
  { entorno, accessToken }: SesionDePrueba,
  datos: {
    fecha: string;
    texto: string;
    categoria?: 'materiales' | 'taller';
    hora?: string;
    proyecto_id?: string;
    importante?: boolean;
    hecha?: boolean;
  },
): Promise<string> {
  const filas = (await pedir(entorno, '/rest/v1/anotaciones', {
    method: 'POST',
    accessToken,
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(datos),
  })) as { id: string }[];
  const fila = filas[0];
  if (fila === undefined) throw new Error('el alta de la anotación no devolvió la fila');
  return fila.id;
}

export interface FilaDeArchivo {
  id: string;
  household_id: string;
  proyecto_id: string;
  nombre: string;
  tipo: string;
  bytes: number;
  ancho: number | null;
  alto: number | null;
  deleted_at: string | null;
}

export async function archivosDelTaller(
  { entorno, accessToken }: SesionDePrueba,
  incluirBorrados = false,
): Promise<FilaDeArchivo[]> {
  const filtro = incluirBorrados ? '' : '&deleted_at=is.null';
  return (await pedir(
    entorno,
    `/rest/v1/archivos?select=id,household_id,proyecto_id,nombre,tipo,bytes,ancho,alto,deleted_at${filtro}&order=nombre`,
    { accessToken },
  )) as FilaDeArchivo[];
}

export function rutasDelArchivo(fila: FilaDeArchivo): string[] {
  const base = `${fila.household_id}/${fila.proyecto_id}/${fila.id}`;
  if (fila.tipo === 'application/pdf') return [`${base}.pdf`];
  const extension = fila.tipo === 'image/jpeg' ? 'jpg' : 'webp';
  return [`${base}.${extension}`, `${base}.mini.${extension}`];
}

export async function objetosDelTrabajo(
  { entorno, accessToken }: SesionDePrueba,
  householdId: string,
  proyectoId: string,
): Promise<string[]> {
  const lista = (await pedir(entorno, '/storage/v1/object/list/archivos', {
    method: 'POST',
    accessToken,
    body: JSON.stringify({ prefix: `${householdId}/${proyectoId}`, limit: 100 }),
  })) as { name: string }[];
  return lista.map((objeto) => `${householdId}/${proyectoId}/${objeto.name}`);
}

export async function vaciarArchivos(sesion: SesionDePrueba): Promise<number> {
  const { entorno, accessToken } = sesion;
  const filas = await archivosDelTaller(sesion, true);
  const rutas = filas.flatMap(rutasDelArchivo);
  if (rutas.length > 0) {
    await pedir(entorno, '/storage/v1/object/archivos', {
      method: 'DELETE',
      accessToken,
      body: JSON.stringify({ prefixes: rutas }),
    });
  }
  const vivas = filas.filter((fila) => fila.deleted_at === null);
  if (vivas.length > 0) {
    await pedir(entorno, '/rest/v1/archivos?deleted_at=is.null', {
      method: 'PATCH',
      accessToken,
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ deleted_at: new Date().toISOString() }),
    });
  }
  return vivas.length;
}

export async function vaciarTaller(sesion: SesionDePrueba): Promise<void> {
  await vaciarArchivos(sesion);
  await vaciarAnotaciones(sesion);
  await vaciarMovimientos(sesion);
  await vaciarProyectos(sesion);
  await vaciarClientes(sesion);
}

export async function crearCliente(
  { entorno, accessToken }: SesionDePrueba,
  nombre: string,
  extra: { telefono?: string; direccion?: string } = {},
): Promise<string> {
  const filas = (await pedir(entorno, '/rest/v1/clientes', {
    method: 'POST',
    accessToken,
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ nombre, ...extra }),
  })) as { id: string }[];
  const fila = filas[0];
  if (fila === undefined) throw new Error('el alta de cliente no devolvió la fila');
  return fila.id;
}

export async function leerProyecto(
  { entorno, accessToken }: SesionDePrueba,
  titulo: string,
): Promise<FilaDeProyecto | undefined> {
  const filas = (await pedir(
    entorno,
    `/rest/v1/proyectos?select=id,titulo,estado,version,presupuesto_centavos,fecha_entrega,visita_hecha,visita_importante,entrega_importante,presupuesto_importante&deleted_at=is.null&titulo=eq.${encodeURIComponent(titulo)}`,
    { accessToken },
  )) as FilaDeProyecto[];
  return filas[0];
}

export interface ContactoLeido {
  id: string;
  estado: string;
  fecha_visita: string | null;
  vencimiento_presupuesto: string | null;
  presupuesto_centavos: number | null;
  presupuesto_diseno: boolean;
  presupuesto_despiece: boolean;
  presupuesto_cotizacion: boolean;
  presupuesto_pdf: boolean;
  visita_hecha: boolean;
  visita_importante: boolean;
}

export async function leerContacto(
  { entorno, accessToken }: SesionDePrueba,
  titulo: string,
): Promise<ContactoLeido | undefined> {
  const columnas =
    'id,estado,fecha_visita,vencimiento_presupuesto,presupuesto_centavos,presupuesto_diseno,presupuesto_despiece,presupuesto_cotizacion,presupuesto_pdf,visita_hecha,visita_importante';
  const filas = (await pedir(
    entorno,
    `/rest/v1/proyectos?select=${columnas}&deleted_at=is.null&titulo=eq.${encodeURIComponent(titulo)}`,
    { accessToken },
  )) as ContactoLeido[];
  return filas[0];
}

export async function contarHijos(
  { entorno, accessToken }: SesionDePrueba,
  tabla: 'pagos' | 'gastos',
  proyectoId: string,
): Promise<number> {
  const filas = (await pedir(
    entorno,
    `/rest/v1/${tabla}?select=id&deleted_at=is.null&proyecto_id=eq.${proyectoId}`,
    { accessToken },
  )) as { id: string }[];
  return filas.length;
}

export async function montosDe(
  { entorno, accessToken }: SesionDePrueba,
  tabla: 'pagos' | 'gastos',
  proyectoId: string,
): Promise<number[]> {
  const filas = (await pedir(
    entorno,
    `/rest/v1/${tabla}?select=monto_centavos&deleted_at=is.null&proyecto_id=eq.${proyectoId}&order=monto_centavos`,
    { accessToken },
  )) as { monto_centavos: number }[];
  return filas.map((fila) => fila.monto_centavos);
}

export interface FilaDePago {
  id: string;
  fecha: string;
  concepto: string;
  monto_centavos: number;
}

export async function pagosDe(
  { entorno, accessToken }: SesionDePrueba,
  proyectoId: string,
): Promise<FilaDePago[]> {
  return (await pedir(
    entorno,
    `/rest/v1/pagos?select=id,fecha,concepto,monto_centavos&deleted_at=is.null&proyecto_id=eq.${proyectoId}&order=id`,
    { accessToken },
  )) as FilaDePago[];
}

export interface ContactoDePrueba {
  id: string;
  clienteId: string;
  titulo: string;
}

export async function contactoPorRpc(
  sesion: SesionDePrueba,
  datos: {
    titulo: string;
    estado?: string;
    sena?: number;
    gasto?: number;
    visita?: string | null;
    telefono?: string;
  },
): Promise<ContactoDePrueba> {
  const { titulo, estado = 'contacto', sena = 0, gasto = 0, visita = null, telefono = '' } = datos;
  const clienteId = await crearCliente(sesion, `Cliente de ${titulo}`, { telefono });
  const id = crypto.randomUUID();
  const hoy = new Date().toISOString().slice(0, 10);

  await guardarProyectoPorRpc(sesion, {
    proyecto: {
      id,
      version: null,
      cliente_id: clienteId,
      titulo,
      estado,
      presupuesto_centavos: null,
      comprobante: 'sin_comprobante',
      fecha_visita: visita,
    },
    pagos:
      sena === 0
        ? []
        : [
            {
              id: crypto.randomUUID(),
              fecha: hoy,
              concepto: 'Seña de la visita',
              monto_centavos: sena,
            },
          ],
    gastos:
      gasto === 0
        ? []
        : [
            {
              id: crypto.randomUUID(),
              fecha: hoy,
              descripcion: 'Nafta de la visita',
              monto_centavos: gasto,
            },
          ],
  });
  return { id, clienteId, titulo };
}

export interface DistribucionCongelada {
  estado: string;
  version: number;
  fecha_cobro: string | null;
  dist_cobrado_centavos: number | null;
  dist_gastos_centavos: number | null;
  dist_diezmo_centavos: number | null;
  dist_sueldo_centavos: number | null;
  dist_fijos_centavos: number | null;
  dist_remanente_centavos: number | null;
  dist_tope_fijos_centavos: number | null;
  dist_fijos_previo_centavos: number | null;
  dist_sueldo_previo_centavos: number | null;
}

export async function distribucionDe(
  { entorno, accessToken }: SesionDePrueba,
  proyectoId: string,
): Promise<DistribucionCongelada | undefined> {
  const filas = (await pedir(
    entorno,
    `/rest/v1/proyectos?select=estado,version,fecha_cobro,dist_cobrado_centavos,dist_gastos_centavos,dist_diezmo_centavos,dist_sueldo_centavos,dist_fijos_centavos,dist_remanente_centavos,dist_tope_fijos_centavos,dist_fijos_previo_centavos,dist_sueldo_previo_centavos&id=eq.${proyectoId}`,
    { accessToken },
  )) as DistribucionCongelada[];
  return filas[0];
}

export async function cobrarPorRpc(
  { entorno, accessToken }: SesionDePrueba,
  argumentos: Record<string, unknown>,
): Promise<unknown> {
  return pedir(entorno, '/rest/v1/rpc/cobrar_proyecto', {
    method: 'POST',
    accessToken,
    body: JSON.stringify(argumentos),
  });
}

export async function ajustarTaller(
  { entorno, accessToken }: SesionDePrueba,
  cambios: Record<string, number>,
): Promise<void> {
  await pedir(entorno, '/rest/v1/ajustes?deleted_at=is.null', {
    method: 'PATCH',
    accessToken,
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(cambios),
  });
}

export async function guardarProyectoPorRpc(
  { entorno, accessToken }: SesionDePrueba,
  pedido: { proyecto: Record<string, unknown>; pagos: unknown[]; gastos: unknown[] },
): Promise<unknown> {
  return pedir(entorno, '/rest/v1/rpc/guardar_proyecto', {
    method: 'POST',
    accessToken,
    body: JSON.stringify({
      p_proyecto: pedido.proyecto,
      p_pagos: pedido.pagos,
      p_gastos: pedido.gastos,
    }),
  });
}

export interface PreferenciasDeAvisosDePrueba {
  zona: string;
  hora: string;
  avisos: Record<string, { activo: boolean; anticipacion: number }>;
}

export interface EstadoDeLosAvisosDePrueba {
  suscripto: boolean;
  dispositivos: number;
  preferencias: PreferenciasDeAvisosDePrueba | null;
}

export async function estadoDeLosAvisosPorRpc(
  { entorno, accessToken }: SesionDePrueba,
  endpoint: string | null,
): Promise<EstadoDeLosAvisosDePrueba> {
  return (await pedir(entorno, '/rest/v1/rpc/estado_de_mis_avisos', {
    method: 'POST',
    accessToken,
    body: JSON.stringify(endpoint === null ? {} : { p_endpoint: endpoint }),
  })) as EstadoDeLosAvisosDePrueba;
}

export async function darDeBajaAvisosPorRpc(
  { entorno, accessToken }: SesionDePrueba,
  endpoint: string,
): Promise<void> {
  await pedir(entorno, '/rest/v1/rpc/dar_de_baja_suscripcion', {
    method: 'POST',
    accessToken,
    body: JSON.stringify({ p_endpoint: endpoint }),
  });
}

export async function guardarPreferenciasDeAvisosPorRpc(
  { entorno, accessToken }: SesionDePrueba,
  preferencias: PreferenciasDeAvisosDePrueba,
): Promise<void> {
  await pedir(entorno, '/rest/v1/rpc/guardar_preferencias_de_avisos', {
    method: 'POST',
    accessToken,
    body: JSON.stringify({
      p_zona: preferencias.zona,
      p_hora: preferencias.hora,
      p_avisos: preferencias.avisos,
    }),
  });
}
