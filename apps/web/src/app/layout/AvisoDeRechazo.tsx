import { useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router';

import { descartarAviso, useAvisos } from '@/shared/lib';
import { Icono } from '@/shared/ui';

// Si el usuario está en la app cuando llega el rechazo, se entera en el momento, esté donde esté:
// un cobro que rebota y nadie ve es peor que uno que falla en la cara del usuario (ADR 0016). Se
// muestra el más nuevo, con el camino al proyecto; el resto queda en la ficha y en Ajustes.
export function AvisoDeRechazo() {
  const avisos = useAvisos();
  const queryClient = useQueryClient();
  const navegar = useNavigate();
  const { pathname } = useLocation();

  const rechazo = avisos.findLast((aviso) => aviso.tipo === 'rechazo');
  if (!rechazo) return null;
  if (rechazo.ruta !== null && pathname === rechazo.ruta) return null;

  return (
    <div
      role="alert"
      className="fixed inset-x-4 bottom-[calc(var(--bottom-nav-clearance)+3.25rem+env(safe-area-inset-bottom))] z-20 mx-auto max-w-[420px] rounded-panel border border-alerta bg-paper px-3.5 py-3 shadow-menu md:bottom-[calc(14px+3.25rem+env(safe-area-inset-bottom))]"
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex-none text-alerta">
          <Icono nombre="triangle-alert" tamano={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-label font-semibold text-alerta">
            {rechazo.operacion} rechazado: {rechazo.sujeto}
          </p>
          <p className="mt-0.5 text-meta leading-relaxed text-text-2">{rechazo.titulo}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {rechazo.ruta !== null && (
              <button
                type="button"
                className="text-meta font-semibold text-ink underline underline-offset-3"
                onClick={() => {
                  void navegar(rechazo.ruta ?? '/proyectos');
                }}
              >
                Ver el proyecto
              </button>
            )}
            <button
              type="button"
              className="text-meta font-medium text-text-2 underline underline-offset-3"
              onClick={() => {
                descartarAviso(queryClient, rechazo.id);
              }}
            >
              Descartar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
