import {
  descartarDePantalla,
  useAvisosEnPantalla,
  type AvisoEnPantalla,
  type TonoDelAviso,
} from '@/shared/lib';
import { Icono, type NombreDeIcono } from '@/shared/ui';

import { AvisoDeRechazo } from './AvisoDeRechazo';

const ASPECTO: Readonly<
  Record<TonoDelAviso, { icono: NombreDeIcono; tono: string; borde: string }>
> = {
  hecho: { icono: 'check', tono: 'text-hogar', borde: 'border-hairline' },
  'en-cola': { icono: 'cloud-off', tono: 'text-atencion', borde: 'border-atencion' },
  error: { icono: 'triangle-alert', tono: 'text-alerta', borde: 'border-alerta' },
};

function Tarjeta({ aviso }: { aviso: AvisoEnPantalla }) {
  const aspecto = ASPECTO[aviso.tono];
  return (
    <div
      className={`pointer-events-auto flex items-start gap-2.5 rounded-panel border bg-paper py-2.5 pr-1.5 pl-3.5 shadow-toast ${aspecto.borde}`}
    >
      <span className={`mt-0.5 flex-none ${aspecto.tono}`}>
        <Icono nombre={aspecto.icono} tamano={18} />
      </span>
      <div className="min-w-0 flex-1 py-0.5">
        <p
          className={`text-label leading-snug font-semibold ${aviso.tono === 'error' ? 'text-alerta' : ''}`}
        >
          {aviso.texto}
        </p>
        {aviso.detalle !== null && (
          <p className="mt-0.5 text-meta leading-relaxed text-text-2">{aviso.detalle}</p>
        )}
      </div>
      <button
        type="button"
        aria-label="Cerrar el aviso"
        onClick={() => {
          descartarDePantalla(aviso.id);
        }}
        className="flex size-9 flex-none items-center justify-center rounded-field text-text-3 hover:bg-surface"
      >
        <Icono nombre="x" tamano={16} />
      </button>
    </div>
  );
}

export function Avisos() {
  const avisos = useAvisosEnPantalla();
  const transitorios = avisos.filter((aviso) => aviso.tono !== 'error');
  const errores = avisos.filter((aviso) => aviso.tono === 'error');

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-[calc(var(--bottom-nav-clearance)+3.25rem+env(safe-area-inset-bottom))] z-20 mx-auto flex max-w-[420px] flex-col gap-2 md:bottom-[calc(14px+3.25rem+env(safe-area-inset-bottom))]">
      <div role="status" className="flex flex-col gap-2">
        {transitorios.map((aviso) => (
          <Tarjeta key={aviso.id} aviso={aviso} />
        ))}
      </div>
      {errores.map((aviso) => (
        <div key={aviso.id} role="alert">
          <Tarjeta aviso={aviso} />
        </div>
      ))}
      <AvisoDeRechazo />
    </div>
  );
}
