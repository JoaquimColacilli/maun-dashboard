import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import {
  cambiosAlPasar,
  cambiosDeEstado,
  guardadoDeUnPaso,
  listoDelTrabajo,
  MUTACION_DE_LA_ENTREGA,
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

interface Accion {
  clave: string;
  etiqueta: string;
  principal: boolean;
  hacer: () => void;
}

const YA_ESTA_LISTO = 'Ya está listo';

const TODAVIA_NO_ESTA_LISTO = 'Todavía no está listo';

export function AvanceDeLaObra({ resumen, hoy }: AvanceDeLaObraProps) {
  const { proyecto } = resumen;
  const ir = useIr();
  const guardar = useMutation({
    ...MUTACION_DE_PROYECTO,
    meta: metaDeAvisos('proyectoAvanzado', { errorEnPantalla: true, sujeto: proyecto.titulo }),
  });
  const terminar = useMutation({
    ...MUTACION_DE_LA_ENTREGA,
    meta: metaDeAvisos('yaEstaListo', { errorEnPantalla: true, sujeto: proyecto.titulo }),
  });
  const reabrir = useMutation({
    ...MUTACION_DE_LA_ENTREGA,
    meta: metaDeAvisos('todaviaNoEstaListo', { errorEnPantalla: true, sujeto: proyecto.titulo }),
  });
  const [rechazo, setRechazo] = useState<unknown>(null);

  const cambios = cambiosDeEstado(proyecto.estado);
  const situacion = situacionDeLaObra(resumen, hoy);
  if (cambios.length === 0 || situacion === undefined) return null;

  const enCurso = proyecto.estado === 'en_curso';
  const listo = listoDelTrabajo(proyecto);

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

  function marcarListo(valor: string | null): void {
    setRechazo(null);
    (valor === null ? reabrir : terminar).mutate(
      {
        id: proyecto.id,
        cambios: { listo_el: valor },
        previos: { listo_el: listo },
        version: proyecto.version,
      },
      { onError: setRechazo },
    );
  }

  const deEstado = (cambio: CambioDeEstado, principal: boolean): Accion => ({
    clave: cambio.hacia,
    etiqueta: cambio.etiqueta,
    principal,
    hacer: () => {
      pasar(cambio);
    },
  });

  const adelante = cambios.filter((cambio) => cambio.sentido === 'adelante');
  const atras = cambios.filter((cambio) => cambio.sentido === 'atras');

  const acciones: Accion[] = [];
  if (enCurso && listo === null) {
    acciones.push({
      clave: 'listo',
      etiqueta: YA_ESTA_LISTO,
      principal: true,
      hacer: () => {
        marcarListo(hoy);
      },
    });
    acciones.push(...adelante.map((cambio) => deEstado(cambio, false)));
  } else {
    acciones.push(...adelante.map((cambio) => deEstado(cambio, true)));
    if (enCurso) {
      acciones.push({
        clave: 'no-listo',
        etiqueta: TODAVIA_NO_ESTA_LISTO,
        principal: false,
        hacer: () => {
          marcarListo(null);
        },
      });
    }
  }
  acciones.push(...atras.map((cambio) => deEstado(cambio, false)));

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
          {acciones.map((accion) => (
            <Button
              key={accion.clave}
              variant={accion.principal ? 'primario' : 'secundario'}
              onClick={accion.hacer}
            >
              {accion.etiqueta}
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
