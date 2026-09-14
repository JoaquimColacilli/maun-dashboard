import { ESTADOS_DE_SEGUIMIENTO } from '@maun/domain';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { useNavigate } from 'react-router';

import {
  datosActualesDelProyecto,
  ESTADO,
  MUTACION_DE_PROYECTO,
  pasoSiguiente,
  rutaDeAprobacion,
  ultimoContactoAlGuardar,
  type EtapaDeSeguimiento,
  type Proyecto,
  type SituacionDelContacto,
} from '@/entities/proyecto';
import { mensajeDeSincronizacion, type CambiosDeProyecto } from '@/shared/api';
import { hoyLocal, metaDeAvisos, useAlgoEnCurso } from '@/shared/lib';
import { Button, Icono, MoneyInput } from '@/shared/ui';

export interface AvanceDelContactoProps {
  proyecto: Proyecto;
  etapa: EtapaDeSeguimiento;
  situacion: SituacionDelContacto;
  alAgendar: () => void;
}

export function AvanceDelContacto({
  proyecto,
  etapa,
  situacion,
  alAgendar,
}: AvanceDelContactoProps) {
  const navegar = useNavigate();
  const guardar = useMutation({
    ...MUTACION_DE_PROYECTO,
    meta: metaDeAvisos('contactoAvanzado', { errorEnPantalla: true, sujeto: proyecto.titulo }),
  });
  const [rechazo, setRechazo] = useState<unknown>(null);
  const [presupuestando, setPresupuestando] = useState(false);
  const [presupuesto, setPresupuesto] = useState<number | null>(null);
  const campoDelPresupuesto = useRef<HTMLInputElement>(null);
  useAlgoEnCurso(presupuestando);

  const paso = pasoSiguiente(etapa);

  useEffect(() => {
    if (presupuestando) campoDelPresupuesto.current?.focus();
  }, [presupuestando]);

  function mover(cambios: CambiosDeProyecto, dia?: string): void {
    setRechazo(null);
    const datos = { ...datosActualesDelProyecto(proyecto), ...cambios };
    guardar.mutate(
      {
        pedido: {
          id: proyecto.id,
          version: proyecto.version,
          datos: {
            ...datos,
            ultimo_contacto: ultimoContactoAlGuardar(proyecto, datos.estado, hoyLocal(), dia),
          },
          pagos: [],
          gastos: [],
        },
        previos: { proyecto, pagos: [], gastos: [] },
      },
      { onError: setRechazo },
    );
  }

  function aprobar(): void {
    void navegar(rutaDeAprobacion(proyecto.id));
  }

  function avanzar(): void {
    switch (etapa) {
      case 'contacto':
        alAgendar();
        return;
      case 'relevamiento': {
        const visita = proyecto.fecha_visita ?? hoyLocal();
        mover({ estado: 'a_presupuestar', fecha_visita: visita }, visita);
        return;
      }
      case 'a_presupuestar':
        setPresupuestando(true);
        return;
      case 'presupuesto_enviado':
        aprobar();
        return;
    }
  }

  function marcarEnviado(evento: SyntheticEvent<HTMLFormElement>): void {
    evento.preventDefault();
    mover(
      presupuesto === null
        ? { estado: 'presupuesto_enviado' }
        : { estado: 'presupuesto_enviado', presupuesto_centavos: presupuesto },
    );
    setPresupuestando(false);
    setPresupuesto(null);
  }

  return (
    <section
      aria-label="Qué falta"
      className="@container rounded-panel border border-hairline px-4 py-3.5"
    >
      <h2 className="text-meta font-medium text-text-2">Qué falta</h2>
      <p className="mt-0.5 text-body-lg leading-snug font-semibold">{situacion.proximoPaso}</p>
      <p
        className={`mt-1 flex items-center gap-1.5 text-label ${
          situacion.fria ? 'font-semibold text-atencion' : 'text-text-2'
        }`}
      >
        <Icono nombre={situacion.agendada ? 'calendar' : 'clock'} tamano={15} />
        {situacion.espera}
      </p>

      {presupuestando ? (
        <form noValidate onSubmit={marcarEnviado} className="mt-3 flex flex-col gap-2.5">
          <MoneyInput
            ref={campoDelPresupuesto}
            etiqueta="Cuánto presupuestaste"
            placeholder="Opcional"
            value={presupuesto}
            onChange={setPresupuesto}
            ayuda="Si lo dejás vacío, lo cargás cuando lo apruebe."
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit">Marcar como enviado</Button>
            <Button
              variant="secundario"
              onClick={() => {
                setPresupuestando(false);
              }}
            >
              Todavía no
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={avanzar}>{paso.etiqueta}</Button>
          {etapa !== 'presupuesto_enviado' && (
            <Button variant="secundario" onClick={aprobar}>
              Ya lo aprobó
            </Button>
          )}
        </div>
      )}

      <div className="mt-4">
        <span className="text-meta text-text-2">Etapa</span>
        <div
          role="radiogroup"
          aria-label="Etapa"
          className="mt-1 grid grid-cols-2 gap-0.5 rounded-field bg-surface p-1 @md:grid-cols-4"
        >
          {ESTADOS_DE_SEGUIMIENTO.map((estado) => (
            <button
              key={estado}
              type="button"
              role="radio"
              aria-checked={estado === etapa}
              onClick={() => {
                if (estado !== etapa) mover({ estado });
              }}
              className={`min-h-tap rounded-control px-1 text-label leading-tight ${
                estado === etapa
                  ? 'bg-elevado font-semibold text-ink shadow-float'
                  : 'font-medium text-text-2'
              }`}
            >
              {ESTADO[estado].etiqueta}
            </button>
          ))}
        </div>
      </div>

      {rechazo !== null && (
        <p role="alert" className="mt-2.5 text-label font-medium text-alerta">
          {mensajeDeSincronizacion(rechazo)}
        </p>
      )}
    </section>
  );
}
