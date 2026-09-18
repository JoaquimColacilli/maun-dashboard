import { Icono, type NombreDeIcono } from '@maun/ui';

export interface EstadoDeGuardadoProps {
  enPausa: boolean;
  enVuelo: boolean;
  conError: boolean;
  guardado: boolean;
  sinGuardar?: boolean;
}

interface Aspecto {
  texto: string;
  icono: NombreDeIcono;
  tono: string;
}

function aspectoDe({
  enPausa,
  enVuelo,
  conError,
  guardado,
  sinGuardar,
}: EstadoDeGuardadoProps): Aspecto | undefined {
  if (sinGuardar === true) return { texto: 'Sin guardar', icono: 'clock', tono: 'text-text-2' };
  if (enPausa) {
    return { texto: 'Sin señal: se guarda cuando vuelva', icono: 'cloud-off', tono: 'text-text-2' };
  }
  if (enVuelo) return { texto: 'Guardando…', icono: 'arrow-up-down', tono: 'text-text-2' };
  if (conError)
    return { texto: 'No se pudo guardar', icono: 'triangle-alert', tono: 'text-alerta' };
  if (guardado) return { texto: 'Guardado', icono: 'check', tono: 'text-hogar' };
  return undefined;
}

export function EstadoDeGuardado(props: EstadoDeGuardadoProps) {
  const aspecto = aspectoDe(props);
  if (aspecto === undefined) return null;

  return (
    <span role="status" className={`flex items-center gap-1.5 text-meta ${aspecto.tono}`}>
      <Icono nombre={aspecto.icono} tamano={13} />
      {aspecto.texto}
    </span>
  );
}
