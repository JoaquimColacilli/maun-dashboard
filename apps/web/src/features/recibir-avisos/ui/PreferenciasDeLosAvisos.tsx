import {
  ANTICIPACIONES,
  AVISOS_DE_LA_AGENDA,
  type AvisoDeLaAgenda,
  type PreferenciasDeAvisos,
} from '@maun/domain';
import { useId } from 'react';

import { MarcaDeCategoria } from '@/entities/agenda';
import type { EstadoDeLosAvisos, PreferenciasDeLaPersona } from '@/shared/api';
import { Button, Icono, Interruptor } from '@/shared/ui';

import {
  ANTICIPACION_EN_PALABRAS,
  anticipacionesDe,
  cuandoSalio,
  esHora,
  HORAS_SUGERIDAS,
  otrosDispositivos,
  QUE_AVISA,
} from '../model/textos';
import { OpcionesDeZona } from './OpcionesDeZona';

export interface PreferenciasDeLosAvisosProps {
  estado: EstadoDeLosAvisos;
  preferencias: PreferenciasDeLaPersona;
  probando: boolean;
  apagando: boolean;
  alCambiar: (preferencias: PreferenciasDeLaPersona) => void;
  alProbar: () => void;
  alApagar: () => void;
}

const TITULO_DE_SECCION = 'text-body-lg font-semibold';
const TARJETA = 'rounded-panel border border-hairline bg-paper px-4 py-4 md:px-5';

export function PreferenciasDeLosAvisos({
  estado,
  preferencias,
  probando,
  apagando,
  alCambiar,
  alProbar,
  alApagar,
}: PreferenciasDeLosAvisosProps) {
  const id = useId();

  function cambiarAviso(
    aviso: AvisoDeLaAgenda,
    preferencia: PreferenciasDeAvisos[AvisoDeLaAgenda],
  ) {
    alCambiar({ ...preferencias, avisos: { ...preferencias.avisos, [aviso]: preferencia } });
  }

  return (
    <div className="flex flex-col gap-3 md:gap-4">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 rounded-panel border border-hairline bg-paper px-4 py-3 md:px-5">
        <Icono nombre="bell" tamano={18} className="flex-none" />
        <p className="min-w-[12rem] flex-1 text-body leading-tight">
          Avisos activos en este dispositivo. {cuandoSalio(estado.ultimoEnvio)}
          {otrosDispositivos(estado.dispositivos)}
        </p>
        <Button variant="secundario" size="chico" cargando={probando} onClick={alProbar}>
          Probar
        </Button>
      </div>

      <section aria-labelledby={`${id}-que`} className={TARJETA}>
        <h2 id={`${id}-que`} className={`mb-0.5 ${TITULO_DE_SECCION}`}>
          Qué te avisa
        </h2>
        {AVISOS_DE_LA_AGENDA.map((aviso) => {
          const datos = QUE_AVISA[aviso];
          const preferencia = preferencias.avisos[aviso];
          return (
            <div
              key={aviso}
              className="flex flex-wrap items-center gap-x-3.5 gap-y-2 border-t border-hairline-soft py-3.5"
            >
              <span
                aria-hidden
                className={`flex size-[22px] flex-none items-center justify-center ${
                  preferencia.activo ? '' : 'opacity-45'
                }`}
              >
                <MarcaDeCategoria categoria={datos.categoria} />
              </span>
              <div className="min-w-[150px] flex-1">
                <p className="text-body font-medium">{datos.etiqueta}</p>
                <p className="text-label leading-tight text-text-2">{datos.detalle}</p>
              </div>
              <select
                aria-label={`Anticipación de ${datos.etiqueta}`}
                disabled={!preferencia.activo}
                value={String(preferencia.anticipacion)}
                onChange={(evento) => {
                  const anticipacion = ANTICIPACIONES.find(
                    (posible) => String(posible) === evento.target.value,
                  );
                  if (anticipacion !== undefined) {
                    cambiarAviso(aviso, { ...preferencia, anticipacion });
                  }
                }}
                className="h-10 min-w-[170px] flex-none rounded-field border border-border bg-paper px-2.5 text-body text-ink disabled:text-text-3"
              >
                {anticipacionesDe(aviso, preferencia.anticipacion).map((anticipacion) => (
                  <option key={anticipacion} value={String(anticipacion)}>
                    {ANTICIPACION_EN_PALABRAS[anticipacion]}
                  </option>
                ))}
              </select>
              <Interruptor
                etiqueta={datos.etiqueta}
                activo={preferencia.activo}
                alCambiar={(activo) => {
                  cambiarAviso(aviso, { ...preferencia, activo });
                }}
              />
            </div>
          );
        })}
      </section>

      <section aria-labelledby={`${id}-hora`} className={TARJETA}>
        <h2 id={`${id}-hora`} className={`mb-2.5 ${TITULO_DE_SECCION}`}>
          A qué hora
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {HORAS_SUGERIDAS.map((hora) => {
            const elegida = preferencias.hora === hora;
            return (
              <button
                key={hora}
                type="button"
                aria-pressed={elegida}
                onClick={() => {
                  if (!elegida) alCambiar({ ...preferencias, hora });
                }}
                className={`apretable min-h-tap rounded-pill border px-3.5 text-body font-medium tabular-nums ${
                  elegida
                    ? 'border-ink bg-ink text-paper'
                    : 'border-border bg-paper text-ink hover:bg-surface'
                }`}
              >
                {hora}
              </button>
            );
          })}
          <input
            type="time"
            aria-label="Otra hora"
            value={preferencias.hora}
            onChange={(evento) => {
              const hora = evento.target.value;
              if (esHora(hora) && hora !== preferencias.hora) alCambiar({ ...preferencias, hora });
            }}
            className="min-h-tap rounded-field border border-border bg-paper px-3 text-body text-ink tabular-nums"
          />
        </div>
      </section>

      <section aria-labelledby={`${id}-zona`} className={TARJETA}>
        <h2 id={`${id}-zona`} className={`mb-1.5 ${TITULO_DE_SECCION}`}>
          ¿Dónde vivís?
        </h2>
        <p
          id={`${id}-zona-ayuda`}
          className="mb-2.5 max-w-[520px] text-body leading-relaxed text-text-2"
        >
          El aviso lo manda un servidor, no tu teléfono, así que necesita saber en qué zona horaria
          estás para mandarlo a la hora que elegiste.
        </p>
        <select
          aria-labelledby={`${id}-zona`}
          aria-describedby={`${id}-zona-ayuda`}
          value={preferencias.zona}
          onChange={(evento) => {
            alCambiar({ ...preferencias, zona: evento.target.value });
          }}
          className="h-field w-full max-w-[320px] min-w-0 rounded-field border border-border bg-paper px-3 text-body text-ink"
        >
          <OpcionesDeZona guardada={preferencias.zona} />
        </select>
      </section>

      <section
        aria-labelledby={`${id}-dispositivo`}
        className={`flex flex-col items-start gap-2 ${TARJETA}`}
      >
        <h2 id={`${id}-dispositivo`} className={TITULO_DE_SECCION}>
          En este dispositivo
        </h2>
        <p className="text-body leading-relaxed text-text-2">
          Apagarlos acá no cambia lo que llega a tus otros dispositivos.
        </p>
        <Button variant="secundario" size="chico" cargando={apagando} onClick={alApagar}>
          {!apagando && <Icono nombre="bell-off" tamano={16} />}
          Apagar los avisos en este dispositivo
        </Button>
      </section>
    </div>
  );
}
