import { Icono } from '@/shared/ui';

import { avisoDePendientes, useSalir } from './useSalir';

export function FilaParaSalir({ className = '' }: { className?: string }) {
  const { pendientes, confirmando, saliendo, error, confirmar, cerrar } = useSalir();
  const pideConfirmar = pendientes > 0 && !confirmando;

  return (
    <>
      <button
        type="button"
        aria-busy={saliendo || undefined}
        onClick={() => {
          if (pideConfirmar) confirmar();
          else void cerrar();
        }}
        className={className}
      >
        <span className="flex size-9 flex-none items-center justify-center rounded-panel bg-surface text-text-2">
          <Icono nombre="log-out" tamano={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-body-lg leading-snug font-medium text-text-2">
            {saliendo ? 'Cerrando…' : confirmando ? 'Cerrar sesión igual' : 'Cerrar sesión'}
          </span>
          {pendientes > 0 && (
            <span className="mt-px block text-label leading-snug text-atencion">
              {avisoDePendientes(pendientes)}
            </span>
          )}
        </span>
      </button>
      {error !== '' && (
        <p role="alert" className="py-2 text-meta font-medium text-alerta">
          {error}
        </p>
      )}
    </>
  );
}
