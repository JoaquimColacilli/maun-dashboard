import type { QueryClient } from '@tanstack/react-query';

import { mensajeDeSincronizacion, type OperacionRechazada } from '@/shared/api';
import { avisarEnPantalla, avisosDeLaMeta, type QueSeGuarda } from '@/shared/lib';

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
  contactoBorrado: 'baja-de-proyecto',
  perfil: 'guardado',
};

function lasQueEstabanSinSenal(veces: number): string {
  return `Se guardaron las ${String(veces)} cosas que estaban anotadas sin señal.`;
}

function lasAnotadasSinSenal(veces: number): string {
  return `${String(veces)} cosas anotadas sin señal: se guardan solas cuando vuelva.`;
}

export function avisarDesdeLaCola(queryClient: QueryClient): () => void {
  const observadores = new Map<number, number>();
  const sinSenal = new Set<number>();

  return queryClient.getMutationCache().subscribe((evento) => {
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
      sinSenal.delete(id);
      return;
    }
    if (evento.type !== 'updated') return;

    const avisos = avisosDeLaMeta(mutation.meta);
    if (!avisos) return;

    switch (evento.action.type) {
      case 'pause':
        if (sinSenal.has(id)) return;
        sinSenal.add(id);
        avisarEnPantalla({
          clave: 'sin-senal',
          tono: 'en-cola',
          texto: avisos.enCola,
          textoParaVarios: lasAnotadasSinSenal,
        });
        return;
      case 'continue':
        sinSenal.add(id);
        return;
      case 'success':
        if (sinSenal.delete(id)) {
          avisarEnPantalla({
            clave: 'pendientes',
            tono: 'hecho',
            texto: `${avisos.hecho} Estaba anotado sin señal.`,
            textoParaVarios: lasQueEstabanSinSenal,
          });
          return;
        }
        avisarEnPantalla({ clave: avisos.hecho, tono: 'hecho', texto: avisos.hecho });
        return;
      case 'error':
        sinSenal.delete(id);
        if (avisos.errorEnPantalla && (observadores.get(id) ?? 0) > 0) return;
        avisarEnPantalla({
          clave: `error-${String(id)}`,
          tono: 'error',
          texto: avisos.error,
          detalle: mensajeDeSincronizacion(mutation.state.error, {
            operacion: OPERACION[avisos.que],
            ...(avisos.sujeto === null ? {} : { sujeto: avisos.sujeto }),
          }),
        });
        return;
      default:
        return;
    }
  });
}
