import { useId, useRef, useState } from 'react';

import { MarcaDeCategoria } from '@/entities/agenda';
import { pedirPermisoDeAvisos } from '@/shared/lib';
import { Button } from '@/shared/ui';

import { FALTA_LA_ZONA } from '../model/textos';
import { OpcionesDeZona } from './OpcionesDeZona';

export interface ActivarLosAvisosProps {
  hora: string;
  zonaGuardada: string | null;
  activando: boolean;
  mensaje: string | null;
  alActivar: (permiso: Promise<NotificationPermission>, zona: string) => void;
}

export function ActivarLosAvisos({
  hora,
  zonaGuardada,
  activando,
  mensaje,
  alActivar,
}: ActivarLosAvisosProps) {
  const id = useId();
  const idTitulo = `${id}-titulo`;
  const idAyuda = `${id}-ayuda`;
  const idError = `${id}-error`;
  const selector = useRef<HTMLSelectElement>(null);
  const [zona, setZona] = useState(zonaGuardada ?? '');
  const [faltaLaZona, setFaltaLaZona] = useState(false);

  function activar(): void {
    if (zona === '') {
      setFaltaLaZona(true);
      selector.current?.focus();
      return;
    }
    alActivar(pedirPermisoDeAvisos(), zona);
  }

  return (
    <section
      aria-labelledby={idTitulo}
      className="flex flex-col gap-4 rounded-panel border border-ink p-5"
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="flex flex-none flex-col items-center gap-1.5 pt-1">
          <MarcaDeCategoria categoria="entrega" />
          <MarcaDeCategoria categoria="presupuesto" />
          <MarcaDeCategoria categoria="visita" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={idTitulo} className="text-section leading-tight font-semibold">
            Que te avise a la mañana
          </h2>
          <p className="mt-1.5 text-body leading-relaxed text-text-2">
            A las {hora} te llega un aviso con las entregas, las visitas y los presupuestos que
            vencen. Podés elegir qué te avisa y con cuánta anticipación después de activarlo.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-body font-semibold">
          ¿Dónde vivís?
        </label>
        <p id={idAyuda} className="text-label leading-relaxed text-text-2">
          El aviso lo manda un servidor, no tu teléfono, así que necesita saber en qué zona horaria
          estás para mandarlo a la hora que elegiste.
        </p>
        <select
          ref={selector}
          id={id}
          value={zona}
          aria-invalid={faltaLaZona || undefined}
          aria-describedby={faltaLaZona ? `${idAyuda} ${idError}` : idAyuda}
          onChange={(evento) => {
            setZona(evento.target.value);
            setFaltaLaZona(false);
          }}
          className={`h-field w-full max-w-[320px] min-w-0 rounded-field border bg-paper px-3 text-body text-ink ${
            faltaLaZona ? 'border-alerta' : 'border-border'
          }`}
        >
          {zona === '' && (
            <option value="" disabled>
              Elegí tu zona horaria
            </option>
          )}
          <OpcionesDeZona guardada={zonaGuardada} />
        </select>
        {faltaLaZona && (
          <span id={idError} role="alert" className="text-label font-medium text-alerta">
            {FALTA_LA_ZONA}
          </span>
        )}
      </div>

      <div className="flex flex-col items-start gap-2">
        <Button size="grande" cargando={activando} onClick={activar}>
          {activando ? 'Activando…' : 'Activar los avisos'}
        </Button>
        <p className="max-w-[320px] text-label leading-relaxed text-text-3">
          El sistema te va a preguntar si los permitís. Si decís que no, después hay que habilitarlo
          a mano.
        </p>
      </div>

      {mensaje !== null && (
        <p role="alert" className="text-label leading-relaxed font-medium text-alerta">
          {mensaje}
        </p>
      )}
    </section>
  );
}
