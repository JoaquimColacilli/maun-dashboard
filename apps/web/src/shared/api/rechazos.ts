import { rechazoDeLaBase, SIN_PERMISO } from '@maun/db';

export type OperacionRechazada =
  | 'cobro'
  | 'cierre'
  | 'reapertura'
  | 'reactivacion'
  | 'proyecto'
  | 'baja-de-proyecto'
  | 'baja-de-cliente'
  | 'guardado';

export interface ContextoDelRechazo {
  operacion: OperacionRechazada;
  sujeto?: string;
  estado?: 'cobrado' | 'perdido';
}

export interface RechazoTraducido {
  titulo: string;
  queHacer: string;
  codigo: string;
}

const CONTEXTO_GENERICO: ContextoDelRechazo = { operacion: 'guardado' };

function elTrabajo(contexto: ContextoDelRechazo): string {
  return contexto.sujeto === undefined || contexto.sujeto.trim() === ''
    ? 'Este trabajo'
    : `«${contexto.sujeto}»`;
}

function comoQuedo(contexto: ContextoDelRechazo): string {
  return contexto.estado === 'perdido' ? 'cerrado como perdido' : 'cobrado';
}

// La salida de un liquidado depende de cómo se cerró: un cobro se reabre, un perdido se reactiva y
// se vuelve a cerrar. Es el hint que ya da la base, dicho sin la palabra «distribución».
function laSalida(contexto: ContextoDelRechazo): string {
  return contexto.estado === 'perdido'
    ? 'Reactivá el presupuesto, cargá lo que falte y volvé a cerrarlo: el reparto de la seña se hace de nuevo.'
    : 'Reabrí el cobro, corregí lo que haga falta y volvé a cobrarlo: el reparto se hace de nuevo con los números corregidos.';
}

function yaEstaLiquidado(contexto: ContextoDelRechazo): RechazoTraducido {
  if (contexto.operacion === 'cobro' || contexto.operacion === 'cierre') {
    return {
      titulo: `${elTrabajo(contexto)} ya estaba ${comoQuedo(contexto)}.`,
      queHacer:
        'Puede que lo hayas cerrado desde el celular o desde la PC. Fijate cómo quedó el reparto: si no es el que esperabas, reabrilo.',
      codigo: '',
    };
  }

  if (contexto.operacion === 'baja-de-proyecto') {
    return {
      titulo: `${elTrabajo(contexto)} tiene pagos o gastos y está ${comoQuedo(contexto)}: no se puede borrar.`,
      queHacer:
        'Borrar esta plata la sacaría del libro. Si el reparto está mal, corregilo reabriéndolo.',
      codigo: '',
    };
  }

  return {
    titulo: `${elTrabajo(contexto)} está ${comoQuedo(contexto)} y sus números quedaron cerrados.`,
    queHacer: laSalida(contexto),
    codigo: '',
  };
}

function cambioDesdeQueLoViste(contexto: ContextoDelRechazo): RechazoTraducido {
  if (contexto.operacion === 'cobro' || contexto.operacion === 'cierre') {
    return {
      titulo: 'Los números cambiaron desde que viste el reparto.',
      queHacer:
        'Se cargó un pago o un gasto, o cambiaron el sueldo o los costos fijos. Abrí el cobro otra vez: el reparto se calcula de nuevo con lo que hay ahora, y lo revisás antes de confirmar.',
      codigo: '',
    };
  }

  if (contexto.operacion === 'reapertura' || contexto.operacion === 'reactivacion') {
    return {
      titulo: `${elTrabajo(contexto)} cambió desde que lo abriste.`,
      queHacer: 'Abrí la ficha de nuevo para ver cómo quedó, y probá otra vez desde ahí.',
      codigo: '',
    };
  }

  return {
    titulo: `${elTrabajo(contexto)} cambió desde que lo abriste.`,
    queHacer:
      'Se guardó algo desde otro lado. Abrilo de nuevo para ver lo que hay ahora y volvé a cargar lo que te falte.',
    codigo: '',
  };
}

function noSePuedeDesdeAca(contexto: ContextoDelRechazo): RechazoTraducido {
  switch (contexto.operacion) {
    case 'cobro':
      return {
        titulo: `${elTrabajo(contexto)} todavía no está entregado.`,
        queHacer: 'Se cobra lo que ya entregaste. Marcalo como entregado y después cobralo.',
        codigo: '',
      };
    case 'cierre':
      return {
        titulo: `${elTrabajo(contexto)} ya está entregado: no se da por perdido.`,
        queHacer: 'Un mueble entregado se cobra, aunque el cliente tarde. Cobralo desde la ficha.',
        codigo: '',
      };
    case 'reapertura':
      return {
        titulo: `${elTrabajo(contexto)} no está cobrado.`,
        queHacer: 'Abrí la ficha de nuevo para ver cómo quedó.',
        codigo: '',
      };
    case 'reactivacion':
      return {
        titulo: `${elTrabajo(contexto)} no está cerrado como perdido.`,
        queHacer: 'Abrí la ficha de nuevo para ver cómo quedó.',
        codigo: '',
      };
    default:
      return {
        titulo: 'Ese cambio de estado no se puede hacer desde el formulario.',
        queHacer:
          'Cobrar y dar por perdido son botones propios de la ficha, porque reparten plata. Volvé a la ficha y usá el botón.',
        codigo: '',
      };
  }
}

const PARA_TODOS: Readonly<Record<string, (contexto: ContextoDelRechazo) => RechazoTraducido>> = {
  MN002: (contexto) => ({
    titulo: `${elTrabajo(contexto)} está borrado.`,
    queHacer:
      'Puede que lo hayas borrado desde otro dispositivo. Si lo necesitás, cargalo de nuevo.',
    codigo: '',
  }),
  MN003: (contexto) => ({
    titulo: `${elTrabajo(contexto)} tiene trabajos cargados.`,
    queHacer: 'Borrá esos trabajos, o pasalos a otro cliente, y después borrá el cliente.',
    codigo: '',
  }),
  MN004: () => ({
    titulo: 'La base no aceptó ese cambio.',
    queHacer: 'Es algo que no tendría que pasar. Volvé a cargarlo, y si sigue igual avisá.',
    codigo: '',
  }),
  MN005: () => ({
    titulo: 'El cliente de este trabajo está borrado.',
    queHacer: 'Elegí otro cliente para el trabajo, o volvé a cargar el cliente que borraste.',
    codigo: '',
  }),
  MN008: (contexto) => ({
    titulo: 'Esta app quedó vieja y está sacando otra cuenta que el servidor.',
    queHacer:
      contexto.operacion === 'cobro' || contexto.operacion === 'cierre'
        ? 'No se guardó nada: el reparto quedó como estaba. Cerrá la app y volvé a abrirla para que se actualice, y hacelo de nuevo.'
        : 'Cerrá la app y volvé a abrirla para que se actualice, y probá otra vez.',
    codigo: '',
  }),
};

// Los MN00x son para nosotros, no para el dueño del taller: cada uno se cuenta como lo que pasó y
// qué hacer ahora. El código queda aparte, para cuando haya que pedir ayuda con un rechazo raro.
export function traducirRechazo(
  error: unknown,
  contexto: ContextoDelRechazo = CONTEXTO_GENERICO,
): RechazoTraducido | undefined {
  const rechazo = rechazoDeLaBase(error);
  if (!rechazo) return undefined;

  if (rechazo.codigo === SIN_PERMISO) {
    return {
      titulo: 'Tu cuenta no tiene acceso a esto.',
      queHacer:
        'Puede que el trabajo sea de otro taller, o que tu cuenta haya quedado sin taller. Cerrá sesión y volvé a entrar.',
      codigo: rechazo.codigo,
    };
  }

  if (rechazo.codigo === 'MN001') {
    return { ...yaEstaLiquidado(contexto), codigo: rechazo.codigo };
  }

  if (rechazo.codigo === 'MN006') {
    return { ...cambioDesdeQueLoViste(contexto), codigo: rechazo.codigo };
  }

  if (rechazo.codigo === 'MN007') {
    return { ...noSePuedeDesdeAca(contexto), codigo: rechazo.codigo };
  }

  const conocido = PARA_TODOS[rechazo.codigo];
  if (conocido) return { ...conocido(contexto), codigo: rechazo.codigo };

  // Cualquier otro SQLSTATE es un rechazo definitivo sin traducción: se muestra lo que dice la base,
  // que al menos está en castellano, y el código para poder buscarlo.
  return {
    titulo: rechazo.mensaje,
    queHacer: rechazo.hint === '' ? 'Volvé a intentarlo, y si sigue igual avisá.' : rechazo.hint,
    codigo: rechazo.codigo,
  };
}
