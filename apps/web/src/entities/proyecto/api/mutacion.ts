import type { MutationOptions, QueryClient } from '@tanstack/react-query';

import {
  aplicarFilaLocal,
  darDeBajaProyecto,
  debeReintentarse,
  editarProyecto,
  filaPorId,
  filasDe,
  guardarElProyecto,
  guardarLasFormasDeCobro,
  guardarLosCostosEstimados,
  householdDe,
  marcarEnLaAgenda,
  marcarTareasDelPresupuesto,
  quitarFilaLocal,
  type CambiosDeCostos,
  type CambiosDeFormasDeCobro,
  type CambiosDeMarcas,
  type CambiosDeProyecto,
  type CambiosDeTareas,
  type FilaDe,
  type NecesidadParaGuardar,
  type PagoParaGuardar,
  type ProyectoGuardado,
  type ProyectoParaGuardar,
  type Replica,
} from '@/shared/api';
import { claveDeTodaReplica, COLA_DE_SALIDA, guardarCacheAhora } from '@/shared/lib';

import { cambiaLaFila, versionDelGuardado } from '../model/formulario';
import { datosActualesDelProyecto } from '../model/liquidacion';
import { cambiaAlgunaForma } from '../model/cobro';
import { cambiaAlgunCosto } from '../model/costos';
import { cambiaAlgunaMarca } from '../model/marcas';
import { ultimoContactoAlGuardar } from '../model/consultas';
import { cambiaAlgunaTarea } from '../model/tareas';

export const CLAVE_DE_PROYECTO = ['proyectos', 'guardar'] as const;
export const CLAVE_DE_NOTAS = ['proyectos', 'notas'] as const;
export const CLAVE_DE_TAREAS = ['proyectos', 'tareas'] as const;
export const CLAVE_DE_MARCAS = ['proyectos', 'marcas'] as const;
export const CLAVE_DE_COSTOS = ['proyectos', 'costos'] as const;
export const CLAVE_DE_FORMAS_DE_COBRO = ['proyectos', 'formas-de-cobro'] as const;
export const CLAVE_DE_BAJA_DE_PROYECTO = ['proyectos', 'borrar'] as const;

const REINTENTOS = 5;

const DURACION_DEL_RECHAZO_MS = 24 * 60 * 60 * 1000;

export interface GuardadoDeProyecto {
  pedido: ProyectoParaGuardar;
  previos: {
    proyecto: FilaDe<'proyectos'> | null;
    pagos: readonly FilaDe<'pagos'>[];
    gastos: readonly FilaDe<'gastos'>[];
    opciones: readonly FilaDe<'opciones_de_presupuesto'>[];
    necesidades: readonly FilaDe<'necesidades'>[];
  };
}

export interface EdicionDeProyecto {
  id: string;
  cambios: CambiosDeProyecto;
  previos: CambiosDeProyecto;
  version?: number;
}

export interface MarcaDeTareas {
  id: string;
  cambios: CambiosDeTareas;
  previos: CambiosDeTareas;
  version: number;
}

export interface MarcaDeLaAgenda {
  id: string;
  cambios: CambiosDeMarcas;
  previos: CambiosDeMarcas;
  version: number;
}

export interface CostosDelTrabajo {
  id: string;
  cambios: CambiosDeCostos;
  previos: CambiosDeCostos;
  version: number;
}

export interface BajaDeProyecto {
  id: string;
  borradoEn: string;
  previos: {
    proyecto: FilaDe<'proyectos'>;
    pagos: readonly FilaDe<'pagos'>[];
    gastos: readonly FilaDe<'gastos'>[];
    opciones: readonly FilaDe<'opciones_de_presupuesto'>[];
    necesidades: readonly FilaDe<'necesidades'>[];
  };
}

function cambiarReplicas(cliente: QueryClient, cambio: (replica: Replica) => Replica): void {
  cliente.setQueriesData<Replica>({ queryKey: claveDeTodaReplica() }, (previa) =>
    previa ? cambio(previa) : previa,
  );
}

export function hijosDelProyecto(
  replica: Replica,
  proyectoId: string,
): {
  pagos: FilaDe<'pagos'>[];
  gastos: FilaDe<'gastos'>[];
  opciones: FilaDe<'opciones_de_presupuesto'>[];
  necesidades: FilaDe<'necesidades'>[];
} {
  return {
    pagos: filasDe(replica, 'pagos').filter((pago) => pago.proyecto_id === proyectoId),
    gastos: filasDe(replica, 'gastos').filter((gasto) => gasto.proyecto_id === proyectoId),
    opciones: filasDe(replica, 'opciones_de_presupuesto').filter(
      (opcion) => opcion.proyecto_id === proyectoId,
    ),
    necesidades: filasDe(replica, 'necesidades').filter(
      (necesidad) => necesidad.proyecto_id === proyectoId,
    ),
  };
}

export function guardadoDeUnPaso(
  proyecto: FilaDe<'proyectos'>,
  cambios: CambiosDeProyecto,
  hoy: string,
  dia?: string,
  pagos: readonly PagoParaGuardar[] = [],
): GuardadoDeProyecto {
  const datos = { ...datosActualesDelProyecto(proyecto), ...cambios };
  return {
    pedido: {
      id: proyecto.id,
      version: proyecto.version,
      datos: {
        ...datos,
        ultimo_contacto: ultimoContactoAlGuardar(proyecto, datos.estado, hoy, dia),
      },
      pagos,
      gastos: [],
    },
    previos: { proyecto, pagos: [], gastos: [], opciones: [], necesidades: [] },
  };
}

export function aprobacionDeUnaOpcion(
  proyecto: FilaDe<'proyectos'>,
  opciones: readonly FilaDe<'opciones_de_presupuesto'>[],
  id: string,
  aprobada: boolean,
): GuardadoDeProyecto {
  const quedan = opciones.map((opcion) => ({
    id: opcion.id,
    descripcion: opcion.descripcion,
    monto_centavos: opcion.monto_centavos,
    aprobada: aprobada && opcion.id === id,
  }));
  const elegida = quedan.find((opcion) => opcion.aprobada);

  return {
    pedido: {
      id: proyecto.id,
      version: proyecto.version,
      datos: {
        ...datosActualesDelProyecto(proyecto),
        presupuesto_centavos: elegida?.monto_centavos ?? null,
      },
      pagos: [],
      gastos: [],
      opciones: quedan,
    },
    previos: { proyecto, pagos: [], gastos: [], opciones, necesidades: [] },
  };
}

export function guardadoDeLoQueHaceFalta(
  proyecto: FilaDe<'proyectos'>,
  necesidades: readonly FilaDe<'necesidades'>[],
  quedan: readonly NecesidadParaGuardar[],
): GuardadoDeProyecto {
  return {
    pedido: {
      id: proyecto.id,
      version: proyecto.version,
      datos: datosActualesDelProyecto(proyecto),
      pagos: [],
      gastos: [],
      necesidades: quedan,
    },
    previos: { proyecto, pagos: [], gastos: [], opciones: [], necesidades },
  };
}

function conElAgregado(replica: Replica, pedido: ProyectoParaGuardar): Replica {
  const household = householdDe(replica);
  if (!household) return replica;

  const ahora = new Date().toISOString();
  const actual = filaPorId(replica, 'proyectos', pedido.id);
  const fila: FilaDe<'proyectos'> = actual
    ? {
        ...actual,
        ...pedido.datos,
        version: versionDelGuardado(actual, pedido.datos),
        updated_at: cambiaLaFila(actual, pedido.datos) ? ahora : actual.updated_at,
      }
    : ({
        ...pedido.datos,
        id: pedido.id,
        household_id: household.id,
        created_at: ahora,
        updated_at: ahora,
        deleted_at: null,
        version: 1,
        vencimiento_presupuesto: null,
        sena_bp: null,
        presupuesto_diseno: false,
        presupuesto_despiece: false,
        presupuesto_cotizacion: false,
        presupuesto_pdf: false,
        visita_importante: false,
        entrega_importante: false,
        presupuesto_importante: false,
        costo_madera_centavos: null,
        costo_herrajes_centavos: null,
        costo_flete_centavos: null,
        costo_ayudante_centavos: null,
        cobro_sena: null,
        cobro_saldo: null,
        fecha_cobro: null,
        dist_cobrado_centavos: null,
        dist_gastos_centavos: null,
        dist_diezmo_bp: null,
        dist_tope_sueldo_centavos: null,
        dist_tope_fijos_centavos: null,
        dist_diezmo_centavos: null,
        dist_sueldo_centavos: null,
        dist_fijos_centavos: null,
        dist_remanente_centavos: null,
        dist_objetivo_sueldo_centavos: null,
        dist_objetivo_fijos_centavos: null,
        dist_sueldo_mensual: null,
        dist_sueldo_previo_centavos: null,
        dist_fijos_previo_centavos: null,
        dist_liquidado_at: null,
        reapertura_objetivo_sueldo_centavos: null,
        reapertura_objetivo_fijos_centavos: null,
        reapertura_sueldo_mensual: null,
        reapertura_fecha_cobro: null,
        reparto_ya_en_la_apertura: false,
      } satisfies FilaDe<'proyectos'>);

  let siguiente = aplicarFilaLocal(replica, 'proyectos', fila);

  for (const pago of pedido.pagos) {
    if (pago.borrado === true) {
      siguiente = quitarFilaLocal(siguiente, 'pagos', pago.id);
      continue;
    }
    const previo = filaPorId(siguiente, 'pagos', pago.id);
    siguiente = aplicarFilaLocal(siguiente, 'pagos', {
      id: pago.id,
      household_id: household.id,
      proyecto_id: pedido.id,
      fecha: pago.fecha,
      concepto: pago.concepto,
      monto_centavos: pago.monto_centavos,
      ya_en_la_apertura: pago.ya_en_la_apertura ?? previo?.ya_en_la_apertura ?? false,
      created_at: previo?.created_at ?? ahora,
      updated_at: ahora,
      deleted_at: null,
      version: previo?.version ?? 1,
    });
  }

  for (const gasto of pedido.gastos) {
    if (gasto.borrado === true) {
      siguiente = quitarFilaLocal(siguiente, 'gastos', gasto.id);
      continue;
    }
    const previo = filaPorId(siguiente, 'gastos', gasto.id);
    siguiente = aplicarFilaLocal(siguiente, 'gastos', {
      id: gasto.id,
      household_id: household.id,
      proyecto_id: pedido.id,
      fecha: gasto.fecha,
      descripcion: gasto.descripcion,
      monto_centavos: gasto.monto_centavos,
      created_at: previo?.created_at ?? ahora,
      updated_at: ahora,
      deleted_at: null,
      version: previo?.version ?? 1,
    });
  }

  for (const opcion of pedido.opciones ?? []) {
    if (opcion.borrado === true) {
      siguiente = quitarFilaLocal(siguiente, 'opciones_de_presupuesto', opcion.id);
      continue;
    }
    const previo = filaPorId(siguiente, 'opciones_de_presupuesto', opcion.id);
    siguiente = aplicarFilaLocal(siguiente, 'opciones_de_presupuesto', {
      id: opcion.id,
      household_id: household.id,
      proyecto_id: pedido.id,
      descripcion: opcion.descripcion,
      monto_centavos: opcion.monto_centavos,
      aprobada: opcion.aprobada,
      created_at: previo?.created_at ?? ahora,
      updated_at: ahora,
      deleted_at: null,
      version: previo?.version ?? 1,
    });
  }

  for (const necesidad of pedido.necesidades ?? []) {
    if (necesidad.borrado === true) {
      siguiente = quitarFilaLocal(siguiente, 'necesidades', necesidad.id);
      continue;
    }
    const previo = filaPorId(siguiente, 'necesidades', necesidad.id);
    siguiente = aplicarFilaLocal(siguiente, 'necesidades', {
      id: necesidad.id,
      household_id: household.id,
      proyecto_id: pedido.id,
      tipo: necesidad.tipo,
      nombre: necesidad.nombre,
      cantidad: necesidad.cantidad,
      listo: necesidad.listo,
      created_at: previo?.created_at ?? ahora,
      updated_at: ahora,
      deleted_at: null,
      version: previo?.version ?? 1,
    });
  }

  return siguiente;
}

function aplicarSiNoEsVieja(replica: Replica, fila: FilaDe<'proyectos'>): Replica {
  const actual = filaPorId(replica, 'proyectos', fila.id);
  if (actual && actual.version > fila.version) return replica;
  return aplicarFilaLocal(replica, 'proyectos', fila);
}

function conLoQueVolvio(
  replica: Replica,
  guardado: ProyectoGuardado,
  { pedido, previos }: GuardadoDeProyecto,
): Replica {
  const esperada = versionDelGuardado(previos.proyecto, pedido.datos);
  const actual = filaPorId(replica, 'proyectos', guardado.proyecto.id);
  const hayAlgoMasNuevo =
    actual !== undefined && actual.version > Math.max(esperada, guardado.proyecto.version);
  let siguiente = hayAlgoMasNuevo
    ? replica
    : aplicarFilaLocal(replica, 'proyectos', guardado.proyecto);
  for (const pago of guardado.pagos) siguiente = aplicarFilaLocal(siguiente, 'pagos', pago);
  for (const gasto of guardado.gastos) siguiente = aplicarFilaLocal(siguiente, 'gastos', gasto);
  for (const opcion of guardado.opciones) {
    siguiente = aplicarFilaLocal(siguiente, 'opciones_de_presupuesto', opcion);
  }
  for (const necesidad of guardado.necesidades) {
    siguiente = aplicarFilaLocal(siguiente, 'necesidades', necesidad);
  }
  return siguiente;
}

function comoEstaba(replica: Replica, { pedido, previos }: GuardadoDeProyecto): Replica {
  let siguiente =
    previos.proyecto === null
      ? quitarFilaLocal(replica, 'proyectos', pedido.id)
      : aplicarFilaLocal(replica, 'proyectos', previos.proyecto);

  for (const pago of pedido.pagos) siguiente = quitarFilaLocal(siguiente, 'pagos', pago.id);
  for (const gasto of pedido.gastos) siguiente = quitarFilaLocal(siguiente, 'gastos', gasto.id);
  for (const opcion of pedido.opciones ?? []) {
    siguiente = quitarFilaLocal(siguiente, 'opciones_de_presupuesto', opcion.id);
  }
  for (const necesidad of pedido.necesidades ?? []) {
    siguiente = quitarFilaLocal(siguiente, 'necesidades', necesidad.id);
  }
  for (const pago of previos.pagos) siguiente = aplicarFilaLocal(siguiente, 'pagos', pago);
  for (const gasto of previos.gastos) siguiente = aplicarFilaLocal(siguiente, 'gastos', gasto);
  for (const opcion of previos.opciones) {
    siguiente = aplicarFilaLocal(siguiente, 'opciones_de_presupuesto', opcion);
  }
  for (const necesidad of previos.necesidades) {
    siguiente = aplicarFilaLocal(siguiente, 'necesidades', necesidad);
  }
  return siguiente;
}

export const MUTACION_DE_PROYECTO: MutationOptions<ProyectoGuardado, unknown, GuardadoDeProyecto> =
  {
    mutationKey: CLAVE_DE_PROYECTO,
    mutationFn: ({ pedido }) => guardarElProyecto(pedido),
    scope: COLA_DE_SALIDA,
    gcTime: DURACION_DEL_RECHAZO_MS,
    retry: (intentos, error) => intentos < REINTENTOS && debeReintentarse(error),
    onMutate: async ({ pedido }, { client }) => {
      await client.cancelQueries({ queryKey: claveDeTodaReplica() });
      cambiarReplicas(client, (replica) => conElAgregado(replica, pedido));
      await guardarCacheAhora();
    },
    onSuccess: (guardado, variables, _contexto, { client }) => {
      cambiarReplicas(client, (replica) => conLoQueVolvio(replica, guardado, variables));
    },
    onError: (_error, variables, _contexto, { client }) => {
      cambiarReplicas(client, (replica) => comoEstaba(replica, variables));
    },
  };

function conCambios(replica: Replica, id: string, cambios: CambiosDeProyecto): Replica {
  const actual = filaPorId(replica, 'proyectos', id);
  if (!actual) return replica;
  return aplicarFilaLocal(replica, 'proyectos', {
    ...actual,
    ...cambios,
    version: versionDelGuardado(actual, cambios),
    updated_at: cambiaLaFila(actual, cambios) ? new Date().toISOString() : actual.updated_at,
  });
}

function sinLosCambios(replica: Replica, { id, previos, version }: EdicionDeProyecto): Replica {
  const actual = filaPorId(replica, 'proyectos', id);
  if (!actual) return replica;
  return aplicarFilaLocal(replica, 'proyectos', {
    ...actual,
    ...previos,
    version: version ?? actual.version,
  });
}

export const MUTACION_DE_NOTAS: MutationOptions<FilaDe<'proyectos'>, unknown, EdicionDeProyecto> = {
  mutationKey: CLAVE_DE_NOTAS,
  mutationFn: ({ id, cambios }) => editarProyecto(id, cambios),
  scope: COLA_DE_SALIDA,
  gcTime: DURACION_DEL_RECHAZO_MS,
  retry: (intentos, error) => intentos < REINTENTOS && debeReintentarse(error),
  onMutate: async ({ id, cambios }, { client }) => {
    await client.cancelQueries({ queryKey: claveDeTodaReplica() });
    cambiarReplicas(client, (replica) => conCambios(replica, id, cambios));
    await guardarCacheAhora();
  },
  onSuccess: (fila, _variables, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => aplicarSiNoEsVieja(replica, fila));
  },
  onError: (_error, variables, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => sinLosCambios(replica, variables));
  },
};

export interface FormasDeCobroDelTrabajo {
  id: string;
  cambios: CambiosDeFormasDeCobro;
  previos: CambiosDeFormasDeCobro;
  version: number;
}

type CambiosDeUnaColumnaSuelta =
  CambiosDeTareas | CambiosDeMarcas | CambiosDeCostos | CambiosDeFormasDeCobro;

function conUnaColumnaSuelta(
  replica: Replica,
  id: string,
  cambios: CambiosDeUnaColumnaSuelta,
  cambia: (actual: FilaDe<'proyectos'>) => boolean,
): Replica {
  const actual = filaPorId(replica, 'proyectos', id);
  if (!actual) return replica;
  const cambiaAlgo = cambia(actual);
  return aplicarFilaLocal(replica, 'proyectos', {
    ...actual,
    ...cambios,
    version: cambiaAlgo ? actual.version + 1 : actual.version,
    updated_at: cambiaAlgo ? new Date().toISOString() : actual.updated_at,
  });
}

function sinLaColumnaSuelta(
  replica: Replica,
  id: string,
  previos: CambiosDeUnaColumnaSuelta,
  version: number,
): Replica {
  const actual = filaPorId(replica, 'proyectos', id);
  if (!actual) return replica;
  return aplicarFilaLocal(replica, 'proyectos', { ...actual, ...previos, version });
}

export const MUTACION_DE_TAREAS: MutationOptions<FilaDe<'proyectos'>, unknown, MarcaDeTareas> = {
  mutationKey: CLAVE_DE_TAREAS,
  mutationFn: ({ id, cambios }) => marcarTareasDelPresupuesto(id, cambios),
  scope: COLA_DE_SALIDA,
  gcTime: DURACION_DEL_RECHAZO_MS,
  retry: (intentos, error) => intentos < REINTENTOS && debeReintentarse(error),
  onMutate: async ({ id, cambios }, { client }) => {
    await client.cancelQueries({ queryKey: claveDeTodaReplica() });
    cambiarReplicas(client, (replica) =>
      conUnaColumnaSuelta(replica, id, cambios, (actual) => cambiaAlgunaTarea(actual, cambios)),
    );
    await guardarCacheAhora();
  },
  onSuccess: (fila, _variables, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => aplicarSiNoEsVieja(replica, fila));
  },
  onError: (_error, { id, previos, version }, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => sinLaColumnaSuelta(replica, id, previos, version));
  },
};

export const MUTACION_DE_MARCAS: MutationOptions<FilaDe<'proyectos'>, unknown, MarcaDeLaAgenda> = {
  mutationKey: CLAVE_DE_MARCAS,
  mutationFn: ({ id, cambios }) => marcarEnLaAgenda(id, cambios),
  scope: COLA_DE_SALIDA,
  gcTime: DURACION_DEL_RECHAZO_MS,
  retry: (intentos, error) => intentos < REINTENTOS && debeReintentarse(error),
  onMutate: async ({ id, cambios }, { client }) => {
    await client.cancelQueries({ queryKey: claveDeTodaReplica() });
    cambiarReplicas(client, (replica) =>
      conUnaColumnaSuelta(replica, id, cambios, (actual) => cambiaAlgunaMarca(actual, cambios)),
    );
    await guardarCacheAhora();
  },
  onSuccess: (fila, _variables, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => aplicarSiNoEsVieja(replica, fila));
  },
  onError: (_error, { id, previos, version }, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => sinLaColumnaSuelta(replica, id, previos, version));
  },
};

export const MUTACION_DE_COSTOS: MutationOptions<FilaDe<'proyectos'>, unknown, CostosDelTrabajo> = {
  mutationKey: CLAVE_DE_COSTOS,
  mutationFn: ({ id, cambios }) => guardarLosCostosEstimados(id, cambios),
  scope: COLA_DE_SALIDA,
  gcTime: DURACION_DEL_RECHAZO_MS,
  retry: (intentos, error) => intentos < REINTENTOS && debeReintentarse(error),
  onMutate: async ({ id, cambios }, { client }) => {
    await client.cancelQueries({ queryKey: claveDeTodaReplica() });
    cambiarReplicas(client, (replica) =>
      conUnaColumnaSuelta(replica, id, cambios, (actual) => cambiaAlgunCosto(actual, cambios)),
    );
    await guardarCacheAhora();
  },
  onSuccess: (fila, _variables, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => aplicarSiNoEsVieja(replica, fila));
  },
  onError: (_error, { id, previos, version }, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => sinLaColumnaSuelta(replica, id, previos, version));
  },
};

export const MUTACION_DE_FORMAS_DE_COBRO: MutationOptions<
  FilaDe<'proyectos'>,
  unknown,
  FormasDeCobroDelTrabajo
> = {
  mutationKey: CLAVE_DE_FORMAS_DE_COBRO,
  mutationFn: ({ id, cambios }) => guardarLasFormasDeCobro(id, cambios),
  scope: COLA_DE_SALIDA,
  gcTime: DURACION_DEL_RECHAZO_MS,
  retry: (intentos, error) => intentos < REINTENTOS && debeReintentarse(error),
  onMutate: async ({ id, cambios }, { client }) => {
    await client.cancelQueries({ queryKey: claveDeTodaReplica() });
    cambiarReplicas(client, (replica) =>
      conUnaColumnaSuelta(replica, id, cambios, (actual) => cambiaAlgunaForma(actual, cambios)),
    );
    await guardarCacheAhora();
  },
  onSuccess: (fila, _variables, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => aplicarSiNoEsVieja(replica, fila));
  },
  onError: (_error, { id, previos, version }, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => sinLaColumnaSuelta(replica, id, previos, version));
  },
};

function sinElProyecto(replica: Replica, id: string): Replica {
  const { pagos, gastos, opciones, necesidades } = hijosDelProyecto(replica, id);
  let siguiente = quitarFilaLocal(replica, 'proyectos', id);
  for (const pago of pagos) siguiente = quitarFilaLocal(siguiente, 'pagos', pago.id);
  for (const gasto of gastos) siguiente = quitarFilaLocal(siguiente, 'gastos', gasto.id);
  for (const opcion of opciones) {
    siguiente = quitarFilaLocal(siguiente, 'opciones_de_presupuesto', opcion.id);
  }
  for (const necesidad of necesidades) {
    siguiente = quitarFilaLocal(siguiente, 'necesidades', necesidad.id);
  }
  return siguiente;
}

export const MUTACION_DE_BAJA_DE_PROYECTO: MutationOptions<
  FilaDe<'proyectos'>,
  unknown,
  BajaDeProyecto
> = {
  mutationKey: CLAVE_DE_BAJA_DE_PROYECTO,
  mutationFn: ({ id, borradoEn }) => darDeBajaProyecto(id, borradoEn),
  scope: COLA_DE_SALIDA,
  gcTime: DURACION_DEL_RECHAZO_MS,
  retry: (intentos, error) => intentos < REINTENTOS && debeReintentarse(error),
  onMutate: async ({ id }, { client }) => {
    await client.cancelQueries({ queryKey: claveDeTodaReplica() });
    cambiarReplicas(client, (replica) => sinElProyecto(replica, id));
    await guardarCacheAhora();
  },
  onSuccess: (fila, _variables, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => aplicarFilaLocal(replica, 'proyectos', fila));
  },
  onError: (_error, { previos }, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => {
      let siguiente = aplicarFilaLocal(replica, 'proyectos', previos.proyecto);
      for (const pago of previos.pagos) siguiente = aplicarFilaLocal(siguiente, 'pagos', pago);
      for (const gasto of previos.gastos) siguiente = aplicarFilaLocal(siguiente, 'gastos', gasto);
      for (const opcion of previos.opciones) {
        siguiente = aplicarFilaLocal(siguiente, 'opciones_de_presupuesto', opcion);
      }
      for (const necesidad of previos.necesidades) {
        siguiente = aplicarFilaLocal(siguiente, 'necesidades', necesidad);
      }
      return siguiente;
    });
  },
};
