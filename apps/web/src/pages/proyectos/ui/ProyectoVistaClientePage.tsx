import { Link, useParams } from 'react-router';

import { resumenDeProyecto, rutaDelProyecto } from '@/entities/proyecto';
import { useReplicaDelTaller } from '@/entities/replica';
import { PantallaDeLaVista, useVistaDelTrabajo } from '@/entities/vista-cliente';
import { hoyLocal, useEstadoSync } from '@/shared/lib';
import { Icono } from '@/shared/ui';

export function ProyectoVistaClientePage() {
  const replica = useReplicaDelTaller();
  const { id = '' } = useParams();
  const resumen = resumenDeProyecto(replica, id, hoyLocal());
  const resultado = useVistaDelTrabajo(id);
  const sync = useEstadoSync();
  const desactualizada = sync.tipo === 'sin-conexion' && resultado.estado === 'lista';

  return (
    <>
      <div className="mx-auto flex w-full max-w-content flex-col gap-2 px-(--page-pad-mobile) pt-3 md:px-(--page-pad-tablet) lg:px-(--page-pad-desktop)">
        <Link
          to={rutaDelProyecto(id)}
          className="flex min-h-tap w-fit items-center gap-1 rounded-field pr-2 text-body font-medium text-text-2 hover:bg-surface"
        >
          <Icono nombre="chevron-left" tamano={20} />
          Volver {resumen === undefined ? 'al trabajo' : `a «${resumen.proyecto.titulo}»`}
        </Link>
        {desactualizada && (
          <p
            role="status"
            className="flex items-center gap-2 rounded-field bg-surface px-3 py-2 text-label font-medium text-text-2"
          >
            <Icono nombre="cloud-off" tamano={16} />
            Sin señal: esto es lo último que trajimos. Puede no estar al día.
          </p>
        )}
      </div>
      <PantallaDeLaVista
        resultado={resultado}
        tituloMuerto="Ese trabajo no está"
        textoMuerto="Puede que lo hayas borrado, o que el enlace apunte a un trabajo de otro taller."
      />
    </>
  );
}
