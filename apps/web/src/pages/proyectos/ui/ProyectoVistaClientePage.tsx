import { useParams } from 'react-router';

import { resumenDeProyecto, rutaDelProyecto } from '@/entities/proyecto';
import { useReplicaDelTaller } from '@/entities/replica';
import { PantallaDeLaVista, useVistaDelTrabajo } from '@/entities/vista-cliente';
import { BotonDelQr } from '@/features/compartir-con-el-cliente';
import { hoyLocal, Ir, useEstadoSync, useVolver } from '@/shared/lib';
import { Icono } from '@/shared/ui';

export function ProyectoVistaClientePage() {
  const replica = useReplicaDelTaller();
  const { id = '' } = useParams();
  const resumen = resumenDeProyecto(replica, id, hoyLocal());
  const resultado = useVistaDelTrabajo(id);
  const sync = useEstadoSync();
  const desactualizada = sync.tipo === 'sin-conexion' && resultado.estado === 'lista';
  const vuelta = useVolver(
    rutaDelProyecto(id),
    `Volver ${resumen === undefined ? 'al trabajo' : `a «${resumen.proyecto.titulo}»`}`,
    { fija: true },
  );

  return (
    <>
      <div className="mx-auto flex w-full max-w-content flex-col gap-3 px-(--page-pad-mobile) pt-4 md:px-(--page-pad-tablet) lg:px-(--page-pad-desktop)">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Ir
            a={rutaDelProyecto(id)}
            alTocar={vuelta.volver}
            className="-ml-1 flex min-h-tap w-fit items-center gap-1 rounded-pill pr-3 pl-1 text-body font-medium text-text-2 hover:bg-ink/5"
          >
            <Icono nombre="chevron-left" tamano={20} />
            {vuelta.etiqueta}
          </Ir>
          {resumen !== undefined && (
            <BotonDelQr proyectoId={id} trabajo={resumen.proyecto.titulo} />
          )}
        </div>
        {desactualizada && (
          <p
            role="status"
            className="flex items-center gap-2 rounded-panel border border-hairline bg-paper px-4 py-2.5 text-label font-medium text-text-2"
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
