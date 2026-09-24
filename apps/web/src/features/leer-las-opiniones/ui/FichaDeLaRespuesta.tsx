import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';

import { enlaceDeWhatsapp } from '@/entities/cliente';
import { fichaDeLaRespuesta, LineasDeLaRespuesta } from '@/entities/opinion';
import { useReplicaDelTaller } from '@/entities/replica';
import { diaYMes, hoyLocal, rutaDelProyecto, Ir } from '@/shared/lib';
import { FilaDeAcciones, Hoja, Icono } from '@/shared/ui';

import { marcarLeida } from '../model/acciones';

const BOTON =
  'inline-flex min-h-button items-center justify-center gap-2 rounded-pill border border-border bg-paper px-3.5 text-body-sm font-medium text-ink no-underline hover:bg-surface';

export interface FichaDeLaRespuestaProps {
  respuestaId: string;
  alCerrar: () => void;
}

export function FichaDeLaRespuesta({ respuestaId, alCerrar }: FichaDeLaRespuestaProps) {
  const replica = useReplicaDelTaller();
  const cliente = useQueryClient();
  const ficha = useMemo(() => fichaDeLaRespuesta(replica, respuestaId), [replica, respuestaId]);
  const marcada = useRef(false);

  useEffect(() => {
    if (ficha === null || marcada.current) return;
    marcada.current = true;
    marcarLeida(cliente, ficha.respuesta);
  }, [cliente, ficha]);

  if (ficha === null) {
    return (
      <Hoja titulo="Esta respuesta ya no está" alCerrar={alCerrar} alCostado>
        <p className="px-5 py-4 text-body leading-relaxed text-text-2 md:px-6">
          Puede que hayan borrado el trabajo desde otro lado. Lo que contestaron los demás sigue en
          Resultados.
        </p>
      </Hoja>
    );
  }

  const whatsapp = enlaceDeWhatsapp(ficha.telefono);
  const { trabajo } = ficha;

  return (
    <Hoja
      titulo={trabajo.cliente === '' ? 'Un cliente' : trabajo.cliente}
      tituloGrande
      alCostado
      alCerrar={alCerrar}
      bajada={
        <>
          <span className="text-label leading-snug text-text-2">{trabajo.trabajo}</span>
          <span className="text-label text-text-3">
            Contestó el {diaYMes(ficha.contestadaEl, hoyLocal())}
          </span>
        </>
      }
    >
      <div className="min-h-0 flex-1 overflow-auto px-5 pt-1 pb-4 md:px-6 md:pb-5">
        <LineasDeLaRespuesta lineas={ficha.lineas} conPropias />
      </div>
      <div className="flex-none border-t border-hairline px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:px-6 md:py-3.5">
        <FilaDeAcciones>
          <Ir a={rutaDelProyecto(trabajo.proyectoId)} className={BOTON}>
            <Icono nombre="folder-kanban" tamano={16} />
            Abrir el trabajo
          </Ir>
          {whatsapp !== null && (
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={BOTON}>
              <Icono nombre="message-circle" tamano={16} />
              Escribirle
            </a>
          )}
        </FilaDeAcciones>
      </div>
    </Hoja>
  );
}
