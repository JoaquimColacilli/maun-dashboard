import type { AvisoDeEntrega } from '@/entities/entrega';
import { fechaConSuFranja } from '@/entities/proyecto';

export function tituloDelAviso(aviso: AvisoDeEntrega, hoy: string): string {
  const quien = aviso.cliente === '' ? 'Tu cliente' : aviso.cliente;
  if (aviso.respuesta === 'mis_dias') return `${quien} te pasó sus días`;
  return aviso.fecha === null
    ? `${quien} aceptó el día que le propusiste`
    : `${quien} aceptó el ${fechaConSuFranja(aviso.fecha, aviso.franja, hoy)}`;
}
