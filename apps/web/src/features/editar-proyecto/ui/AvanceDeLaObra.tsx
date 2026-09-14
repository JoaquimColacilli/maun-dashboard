import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import {
  cambiosAlPasar,
  cambiosDeEstado,
  guardadoDeUnPaso,
  MUTACION_DE_PROYECTO,
  rutaDeAprobacion,
  situacionDeLaObra,
  type CambioDeEstado,
  type ResumenDeProyecto,
} from '@/entities/proyecto';
import { mensajeDeSincronizacion } from '@/shared/api';
import { metaDeAvisos } from '@/shared/lib';
import { Button, PanelDePaso } from '@/shared/ui';

export interface AvanceDeLaObraProps {
  resumen: ResumenDeProyecto;
  hoy: string;
}

export function AvanceDeLaObra({ resumen, hoy }: AvanceDeLaObraProps) {
  const { proyecto } = resumen;
  const navegar = useNavigate();
  const guardar = useMutation({
    ...MUTACION_DE_PROYECTO,
    meta: metaDeAvisos('proyectoAvanzado', { errorEnPantalla: true, sujeto: proyecto.titulo }),
  });
  const [rechazo, setRechazo] = useState<unknown>(null);

  const cambios = cambiosDeEstado(proyecto.estado);
  const situacion = situacionDeLaObra(resumen, hoy);
  if (cambios.length === 0 || situacion === undefined) return null;

  const adelante = cambios.filter((cambio) => cambio.sentido === 'adelante');
  const atras = cambios.filter((cambio) => cambio.sentido === 'atras');

  function pasar(cambio: CambioDeEstado): void {
    if (cambio.camino === 'pasaje') {
      void navegar(rutaDeAprobacion(proyecto.id));
      return;
    }
    setRechazo(null);
    guardar.mutate(guardadoDeUnPaso(proyecto, cambiosAlPasar(proyecto, cambio.hacia, hoy), hoy), {
      onError: setRechazo,
    });
  }

  return (
    <div className="mt-4 max-w-[520px]">
      <PanelDePaso
        titulo="Qué falta"
        paso={situacion.proximoPaso}
        detalle={situacion.detalle}
        icono={situacion.icono}
        tono={situacion.tono}
      >
        <div className="mt-3 flex flex-wrap items-start gap-2">
          {adelante.map((cambio) => (
            <Button
              key={cambio.hacia}
              onClick={() => {
                pasar(cambio);
              }}
            >
              {cambio.etiqueta}
            </Button>
          ))}
          {atras.length > 0 && (
            <div className="ml-auto flex flex-wrap justify-end gap-2">
              {atras.map((cambio) => (
                <Button
                  key={cambio.hacia}
                  variant="secundario"
                  onClick={() => {
                    pasar(cambio);
                  }}
                >
                  {cambio.etiqueta}
                </Button>
              ))}
            </div>
          )}
        </div>

        {rechazo !== null && (
          <p role="alert" className="mt-2.5 text-label font-medium text-alerta">
            {mensajeDeSincronizacion(rechazo)}
          </p>
        )}
      </PanelDePaso>
    </div>
  );
}
