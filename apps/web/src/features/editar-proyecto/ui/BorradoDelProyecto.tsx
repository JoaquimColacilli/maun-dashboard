import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import { hijosDelProyecto, MUTACION_DE_BAJA_DE_PROYECTO, type Proyecto } from '@/entities/proyecto';
import { useReplicaDelTaller } from '@/entities/replica';
import { metaDeAvisos } from '@/shared/lib';
import { Button, ConSalida, FilaDeAcciones, Hoja, Icono } from '@/shared/ui';

export interface BorradoDelProyectoProps {
  proyecto: Proyecto;
  sustantivo: 'proyecto' | 'contacto';
  alBorrar: () => void;
}

export function BorradoDelProyecto({ proyecto, sustantivo, alBorrar }: BorradoDelProyectoProps) {
  const replica = useReplicaDelTaller();
  const borrar = useMutation({
    ...MUTACION_DE_BAJA_DE_PROYECTO,
    meta: metaDeAvisos(sustantivo === 'contacto' ? 'contactoBorrado' : 'proyectoBorrado', {
      sujeto: proyecto.titulo,
    }),
  });
  const [confirmando, setConfirmando] = useState(false);
  const { pagos, gastos } = hijosDelProyecto(replica, proyecto.id);

  return (
    <>
      <Button
        variant="secundario"
        size="chico"
        onClick={() => {
          setConfirmando(true);
        }}
      >
        <Icono nombre="trash-2" tamano={16} />
        Borrar
      </Button>

      <ConSalida valor={confirmando}>
        {() => (
          <Hoja
            titulo={`¿Borrás «${proyecto.titulo}»?`}
            rol="alertdialog"
            ancho="angosto"
            alCerrar={() => {
              setConfirmando(false);
            }}
          >
            <div className="flex flex-col gap-3.5 px-5 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:px-6 md:pb-5">
              <p className="text-label leading-relaxed text-text-2">
                {pagos.length === 0 && gastos.length === 0
                  ? sustantivo === 'contacto'
                    ? 'No tiene seña ni gastos cargados, así que no se mueve plata.'
                    : 'No tiene pagos ni gastos cargados, así que no se mueve plata.'
                  : `Se va a llevar sus ${String(pagos.length)} pagos y sus ${String(gastos.length)} gastos, y con eso salen del libro mayor.`}
              </p>
              <FilaDeAcciones>
                <Button
                  variant="secundario"
                  onClick={() => {
                    setConfirmando(false);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  variant="peligro"
                  onClick={() => {
                    borrar.mutate({
                      id: proyecto.id,
                      borradoEn: new Date().toISOString(),
                      previos: { proyecto, pagos, gastos },
                    });
                    setConfirmando(false);
                    alBorrar();
                  }}
                >
                  {sustantivo === 'contacto' ? 'Borrar el contacto' : 'Borrar el proyecto'}
                </Button>
              </FilaDeAcciones>
            </div>
          </Hoja>
        )}
      </ConSalida>
    </>
  );
}
