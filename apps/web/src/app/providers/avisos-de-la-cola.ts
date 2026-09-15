import { onlineManager, type QueryClient } from '@tanstack/react-query';

import { mensajeDeSincronizacion, type OperacionRechazada } from '@/shared/api';
import {
  avisarEnPantalla,
  avisoEnPantalla,
  avisosDeLaMeta,
  descartarDePantalla,
  type AvisosDeUnaMutacion,
  type QueSeGuarda,
} from '@/shared/lib';

const OPERACION: Readonly<Record<QueSeGuarda, OperacionRechazada>> = {
  movimientoNuevo: 'guardado',
  movimientoEditado: 'guardado',
  movimientoBorrado: 'guardado',
  clienteNuevo: 'guardado',
  clienteEditado: 'guardado',
  clienteBorrado: 'baja-de-cliente',
  proyectoGuardado: 'proyecto',
  proyectoBorrado: 'baja-de-proyecto',
  proyectoAvanzado: 'proyecto',
  contactoGuardado: 'proyecto',
  contactoAvanzado: 'proyecto',
  tareaDelPresupuesto: 'proyecto',
  contactoBorrado: 'baja-de-proyecto',
  perfil: 'guardado',
  anotacion: 'guardado',
  anotacionBorrada: 'guardado',
};

const CLAVE_DE_LO_ANOTADO = 'anotado-sin-senal';

function lasQueEstabanSinSenal(veces: number): string {
  return `Se guardaron las ${String(veces)} cosas que estaban anotadas sin señal.`;
}

function lasAnotadasSinSenal(veces: number): string {
  return `${String(veces)} cosas anotadas sin señal: se guardan solas cuando vuelva.`;
}

interface AvisoDeLoAnotado {
  id: number;
  mutaciones: Set<number>;
}

export function avisarDesdeLaCola(queryClient: QueryClient): () => void {
  const observadores = new Map<number, number>();
  const vistas = new Set<number>();
  const esperandoTurno = new Set<number>();
  const sinSenal = new Set<number>();
  let anotado: AvisoDeLoAnotado | null = null;

  function anotadoVigente(): AvisoDeLoAnotado | null {
    return anotado !== null && avisoEnPantalla(anotado.id)?.tono === 'en-cola' ? anotado : null;
  }

  function anotarSinSenal(id: number, avisos: AvisosDeUnaMutacion): void {
    esperandoTurno.delete(id);
    if (avisos.silencioso || sinSenal.has(id)) return;
    sinSenal.add(id);
    const previas = anotadoVigente()?.mutaciones ?? new Set<number>();
    const aviso = avisarEnPantalla({
      clave: CLAVE_DE_LO_ANOTADO,
      tono: 'en-cola',
      texto: avisos.enCola,
      textoParaVarios: lasAnotadasSinSenal,
    });
    anotado = { id: aviso, mutaciones: new Set([...previas, id]) };
  }

  function alGuardarse(id: number, avisos: AvisosDeUnaMutacion): void {
    esperandoTurno.delete(id);
    if (avisos.silencioso) {
      sinSenal.delete(id);
      return;
    }
    if (!sinSenal.delete(id)) {
      avisarEnPantalla({ clave: avisos.hecho, tono: 'hecho', texto: avisos.hecho });
      return;
    }
    anotado = null;
    avisarEnPantalla({
      clave: CLAVE_DE_LO_ANOTADO,
      tono: 'hecho',
      texto: `${avisos.hecho} Estaba anotado sin señal.`,
      textoParaVarios: lasQueEstabanSinSenal,
    });
  }

  function alRebotar(id: number, error: unknown, avisos: AvisosDeUnaMutacion): void {
    esperandoTurno.delete(id);
    const vigente = sinSenal.delete(id) ? anotadoVigente() : null;
    const suAviso = vigente?.mutaciones.size === 1 && vigente.mutaciones.has(id) ? vigente : null;
    vigente?.mutaciones.delete(id);
    if (suAviso !== null) anotado = null;

    if (avisos.errorEnPantalla && (observadores.get(id) ?? 0) > 0) {
      if (suAviso !== null) descartarDePantalla(suAviso.id);
      return;
    }
    avisarEnPantalla({
      clave: `error-${String(id)}`,
      tono: 'error',
      texto: avisos.error,
      detalle: mensajeDeSincronizacion(error, {
        operacion: OPERACION[avisos.que],
        ...(avisos.sujeto === null ? {} : { sujeto: avisos.sujeto }),
      }),
      ...(suAviso === null ? {} : { reemplaza: CLAVE_DE_LO_ANOTADO }),
    });
  }

  const dejarLaCola = queryClient.getMutationCache().subscribe((evento) => {
    const { mutation } = evento;
    if (mutation === undefined) return;
    const id = mutation.mutationId;

    if (evento.type === 'observerAdded') {
      observadores.set(id, (observadores.get(id) ?? 0) + 1);
      return;
    }
    if (evento.type === 'observerRemoved') {
      observadores.set(id, Math.max(0, (observadores.get(id) ?? 0) - 1));
      return;
    }
    if (evento.type === 'removed') {
      observadores.delete(id);
      vistas.delete(id);
      esperandoTurno.delete(id);
      sinSenal.delete(id);
      return;
    }
    if (evento.type !== 'updated') return;

    const avisos = avisosDeLaMeta(mutation.meta);
    if (!avisos) return;

    switch (evento.action.type) {
      case 'pending':
        vistas.add(id);
        return;
      case 'pause':
        if (onlineManager.isOnline()) esperandoTurno.add(id);
        else anotarSinSenal(id, avisos);
        return;
      case 'continue':
        esperandoTurno.delete(id);
        if (!vistas.has(id)) sinSenal.add(id);
        return;
      case 'success':
        alGuardarse(id, avisos);
        return;
      case 'error':
        alRebotar(id, mutation.state.error, avisos);
        return;
      default:
        return;
    }
  });

  const dejarLaConexion = onlineManager.subscribe((enLinea) => {
    if (enLinea) return;
    for (const mutacion of queryClient.getMutationCache().getAll()) {
      if (!esperandoTurno.has(mutacion.mutationId)) continue;
      const avisos = avisosDeLaMeta(mutacion.meta);
      if (avisos) anotarSinSenal(mutacion.mutationId, avisos);
    }
  });

  return () => {
    dejarLaCola();
    dejarLaConexion();
  };
}
