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

// El taller de la cuenta de prueba existe para esto: cada corrida arranca sin clientes, así la
// lista vacía y los contadores de la lista son los mismos siempre. No hay grant de delete: la baja
// es lógica, igual que en la app.
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

// El mismo upsert por id que manda la cola de salida: reenviarlo tiene que ser inofensivo.
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

// Los proyectos se borran antes que los clientes: la base rechaza con MN003 la baja de un cliente
// que todavía tiene proyectos vivos.
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

export async function vaciarTaller(sesion: SesionDePrueba): Promise<void> {
  await vaciarProyectos(sesion);
  await vaciarClientes(sesion);
}

export async function crearCliente(
  { entorno, accessToken }: SesionDePrueba,
  nombre: string,
): Promise<string> {
  const filas = (await pedir(entorno, '/rest/v1/clientes', {
    method: 'POST',
    accessToken,
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ nombre }),
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
    `/rest/v1/proyectos?select=id,titulo,estado,version,presupuesto_centavos&deleted_at=is.null&titulo=eq.${encodeURIComponent(titulo)}`,
    { accessToken },
  )) as FilaDeProyecto[];
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

// El mismo pedido que manda la cola de salida, para probar el conflicto de versión desde afuera.
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
