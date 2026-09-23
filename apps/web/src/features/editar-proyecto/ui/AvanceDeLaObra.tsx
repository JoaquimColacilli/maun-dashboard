import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

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
import { metaDeAvisos, useIr } from '@/shared/lib';
import { Button, FilaDeAcciones, PanelDePaso } from '@/shared/ui';

export interface AvanceDeLaObraProps {
  resumen: ResumenDeProyecto;
  hoy: string;
}

export function AvanceDeLaObra({ resumen, hoy }: AvanceDeLaObraProps) {
  const { proyecto } = resumen;
  const ir = useIr();
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
      ir(rutaDeAprobacion(proyecto.id));
      return;
    }
    setRechazo(null);
    guardar.mutate(guardadoDeUnPaso(proyecto, cambiosAlPasar(proyecto, cambio.hacia, hoy), hoy), {
      onError: setRechazo,
    });
  }

  return (
    <div>
      <PanelDePaso
        titulo="Qué falta"
        paso={situacion.proximoPaso}
        detalle={situacion.detalle}
        icono={situacion.icono}
        tono={situacion.tono}
      >
        <FilaDeAcciones className="mt-3">
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
        </FilaDeAcciones>

        {rechazo !== null && (
          <p role="alert" className="mt-2.5 text-label font-medium text-alerta">
            {mensajeDeSincronizacion(rechazo)}
          </p>
        )}
      </PanelDePaso>
    </div>
  );
}
