import { ESTADOS_DE_SEGUIMIENTO, puedeCambiarEstado } from '@maun/domain';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import {
  ESTADO,
  guardadoDeUnPaso,
  MUTACION_DE_PROYECTO,
  pasosDelContacto,
  rutaDeAprobacion,
  vencimientoPropuesto,
  type EtapaDeSeguimiento,
  type PasoDelContacto,
  type Proyecto,
  type SituacionDelContacto,
} from '@/entities/proyecto';
import {
  mensajeDeSincronizacion,
  type CambiosDeProyecto,
  type PagoParaGuardar,
} from '@/shared/api';
import { hoyLocal, metaDeAvisos, useAlgoEnCurso, uuidv7 } from '@/shared/lib';
import { Button, FilaDeAcciones, PanelDePaso } from '@/shared/ui';

import { cambiosAlPasarAPresupuestar, pagoAntesDePresupuestar } from '../model/relevamiento';
import {
  FormularioDelPago,
  FormularioDelPresupuesto,
  FormularioDelRelevamiento,
} from './FormulariosDelPaso';
import { TareasDelPresupuesto } from './TareasDelPresupuesto';

type FormularioAbierto = 'relevar' | 'presupuesto' | 'pasar-a-presupuestar' | null;

function conElVencimiento(
  proyecto: Proyecto,
  cambios: CambiosDeProyecto,
  hoy: string,
): CambiosDeProyecto {
  if ('vencimiento_presupuesto' in cambios) return cambios;
  const vencimiento = vencimientoPropuesto(
    proyecto,
    cambios.estado ?? proyecto.estado,
    cambios.fecha_visita ?? proyecto.fecha_visita,
    hoy,
  );
  return vencimiento === proyecto.vencimiento_presupuesto
    ? cambios
    : { ...cambios, vencimiento_presupuesto: vencimiento };
}

export interface AvanceDelContactoProps {
  proyecto: Proyecto;
  etapa: EtapaDeSeguimiento;
  situacion: SituacionDelContacto;
  cobrado: number;
  alAgendar: () => void;
}

export function AvanceDelContacto({
  proyecto,
  etapa,
  situacion,
  cobrado,
  alAgendar,
}: AvanceDelContactoProps) {
  const navegar = useNavigate();
  const guardar = useMutation({
    ...MUTACION_DE_PROYECTO,
    meta: metaDeAvisos('contactoAvanzado', { errorEnPantalla: true, sujeto: proyecto.titulo }),
  });
  const [rechazo, setRechazo] = useState<unknown>(null);
  const [formulario, setFormulario] = useState<FormularioAbierto>(null);
  useAlgoEnCurso(formulario !== null);

  const pasos = pasosDelContacto(etapa, situacion);
  const etapas = ESTADOS_DE_SEGUIMIENTO.filter(
    (estado) => estado === etapa || puedeCambiarEstado(etapa, estado),
  );

  function cerrarElFormulario(): void {
    setFormulario(null);
  }

  function mover(
    cambios: CambiosDeProyecto,
    dia?: string,
    pagos: readonly PagoParaGuardar[] = [],
  ): void {
    setRechazo(null);
    setFormulario(null);
    const hoy = hoyLocal();
    guardar.mutate(
      guardadoDeUnPaso(proyecto, conElVencimiento(proyecto, cambios, hoy), hoy, dia, pagos),
      { onError: setRechazo },
    );
  }

  function alTocar(paso: PasoDelContacto): void {
    switch (paso.camino) {
      case 'agendar':
        alAgendar();
        return;
      case 'pasaje':
        void navegar(rutaDeAprobacion(proyecto.id));
        return;
      case 'guardar':
        mover({ estado: paso.hacia });
        return;
      case 'pasar-a-presupuestar':
        if (cobrado > 0) mover(cambiosAlPasarAPresupuestar(proyecto, hoyLocal()));
        else setFormulario('pasar-a-presupuestar');
        return;
      case 'relevar':
      case 'presupuesto':
        setFormulario(paso.camino);
        return;
    }
  }

  return (
    <PanelDePaso
      titulo="Qué falta"
      paso={situacion.proximoPaso}
      detalle={situacion.espera}
      icono={situacion.agendada ? 'calendar' : 'clock'}
      tono={situacion.fria ? 'atencion' : 'normal'}
    >
      {formulario === 'relevar' ? (
        <FormularioDelRelevamiento
          proyecto={proyecto}
          conPago={cobrado === 0}
          alListo={(cambios, dia, pagos) => {
            mover(cambios, dia, pagos);
          }}
          alCancelar={cerrarElFormulario}
        />
      ) : formulario === 'presupuesto' ? (
        <FormularioDelPresupuesto
          alListo={(presupuesto) => {
            mover(
              presupuesto === null
                ? { estado: 'presupuesto_enviado' }
                : { estado: 'presupuesto_enviado', presupuesto_centavos: presupuesto },
            );
          }}
          alCancelar={cerrarElFormulario}
        />
      ) : formulario === 'pasar-a-presupuestar' ? (
        <FormularioDelPago
          alListo={(monto) => {
            const hoy = hoyLocal();
            mover(
              cambiosAlPasarAPresupuestar(proyecto, hoy),
              undefined,
              pagoAntesDePresupuestar(monto, uuidv7(), hoy),
            );
          }}
          alCancelar={cerrarElFormulario}
        />
      ) : (
        <FilaDeAcciones className="mt-3">
          {pasos.map((paso, indice) => (
            <Button
              key={paso.etiqueta}
              variant={indice === 0 ? 'primario' : 'secundario'}
              onClick={() => {
                alTocar(paso);
              }}
            >
              {paso.etiqueta}
            </Button>
          ))}
        </FilaDeAcciones>
      )}

      {etapa === 'a_presupuestar' && <TareasDelPresupuesto proyecto={proyecto} />}

      <div className="mt-4">
        <span className="text-meta text-text-2">Etapa</span>
        <div
          role="radiogroup"
          aria-label="Etapa"
          className="mt-1 grid grid-cols-2 gap-0.5 rounded-field bg-surface p-1 @md:grid-cols-3"
        >
          {etapas.map((estado) => (
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
    </PanelDePaso>
  );
}
