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

// Los proyectos se borran antes que los clientes: la base rechaza con MN003 la baja de un cliente
// que todavía tiene proyectos vivos. Un proyecto liquidado con pagos o gastos no se puede borrar
// (MN001); hoy nada de la suite los crea, y si aparecieran, el vaciado de clientes fallaría con un
// mensaje claro en vez de en silencio.
export async function vaciarProyectos({ entorno, accessToken }: SesionDePrueba): Promise<number> {
  const vivos = (await pedir(entorno, '/rest/v1/proyectos?select=id&deleted_at=is.null', {
    accessToken,
  })) as { id: string }[];
  if (vivos.length === 0) return 0;

  await pedir(entorno, '/rest/v1/proyectos?deleted_at=is.null&estado=not.in.(cobrado,perdido)', {
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
