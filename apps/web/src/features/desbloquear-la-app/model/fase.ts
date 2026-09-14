import type { ResultadoDeLaHuella } from '@/shared/lib';

export type OrigenDelPedido = 'al-abrir' | 'usuario';

export type MotivoDelFormulario =
  'eligio-la-contrasena' | 'no-se-confirmo' | 'sin-respuesta' | 'no-disponible' | 'interrumpida';

export type FaseDelBloqueo =
  | { tipo: 'inicial' }
  | {
      tipo: 'pidiendo';
      intento: number;
      origen: OrigenDelPedido;
      motivo: MotivoDelFormulario | null;
    }
  | { tipo: 'formulario'; motivo: MotivoDelFormulario }
  | { tipo: 'desbloqueada' };

export type EventoDelBloqueo =
  | { tipo: 'pedir'; origen: OrigenDelPedido; intento: number }
  | { tipo: 'resultado'; intento: number; resultado: ResultadoDeLaHuella['tipo'] }
  | { tipo: 'usar-la-contrasena' };

export const FASE_INICIAL: FaseDelBloqueo = { tipo: 'inicial' };

const MOTIVO: Readonly<
  Record<Exclude<ResultadoDeLaHuella['tipo'], 'confirmada'>, MotivoDelFormulario>
> = {
  cancelada: 'no-se-confirmo',
  'sin-respuesta': 'sin-respuesta',
  'no-disponible': 'no-disponible',
  interrumpida: 'interrumpida',
};

function motivoAnterior(fase: FaseDelBloqueo): MotivoDelFormulario | null {
  if (fase.tipo === 'formulario') return fase.motivo;
  if (fase.tipo === 'pidiendo') return fase.motivo;
  return null;
}

export function siguienteFase(fase: FaseDelBloqueo, evento: EventoDelBloqueo): FaseDelBloqueo {
  if (fase.tipo === 'desbloqueada') return fase;

  switch (evento.tipo) {
    case 'pedir': {
      if (evento.origen === 'al-abrir') {
        const alAbrir =
          fase.tipo === 'inicial' || (fase.tipo === 'pidiendo' && fase.origen === 'al-abrir');
        return alAbrir
          ? { tipo: 'pidiendo', intento: evento.intento, origen: 'al-abrir', motivo: null }
          : fase;
      }
      return {
        tipo: 'pidiendo',
        intento: evento.intento,
        origen: 'usuario',
        motivo: motivoAnterior(fase),
      };
    }
    case 'resultado':
      if (fase.tipo !== 'pidiendo' || fase.intento !== evento.intento) return fase;
      return evento.resultado === 'confirmada'
        ? { tipo: 'desbloqueada' }
        : { tipo: 'formulario', motivo: MOTIVO[evento.resultado] };
    case 'usar-la-contrasena':
      return { tipo: 'formulario', motivo: 'eligio-la-contrasena' };
  }
}
