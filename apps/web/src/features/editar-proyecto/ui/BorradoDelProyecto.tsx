import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import { hijosDelProyecto, MUTACION_DE_BAJA_DE_PROYECTO, type Proyecto } from '@/entities/proyecto';
import { useReplicaDelTaller } from '@/entities/replica';
import { Button, Icono } from '@/shared/ui';

export interface BorradoDelProyectoProps {
  proyecto: Proyecto;
  sustantivo: 'proyecto' | 'contacto';
  alBorrar: () => void;
}

export function BorradoDelProyecto({ proyecto, sustantivo, alBorrar }: BorradoDelProyectoProps) {
  const replica = useReplicaDelTaller();
  const borrar = useMutation(MUTACION_DE_BAJA_DE_PROYECTO);
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

      {confirmando && (
        <div className="fixed inset-0 z-40">
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => {
              setConfirmando(false);
            }}
            className="absolute inset-0 cursor-default bg-velo"
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label="Confirmar el borrado"
            className="absolute inset-x-0 bottom-0 flex flex-col gap-3.5 rounded-t-sheet bg-paper p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-sheet md:inset-auto md:top-1/2 md:left-1/2 md:w-[min(440px,calc(100%-40px))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-dialog"
          >
            <h2 className="text-body-lg leading-snug font-semibold">
              ¿Borrás «{proyecto.titulo}»?
            </h2>
            <p className="text-label leading-relaxed text-text-2">
              {pagos.length === 0 && gastos.length === 0
                ? sustantivo === 'contacto'
                  ? 'No tiene seña ni gastos cargados, así que no se mueve plata.'
                  : 'No tiene pagos ni gastos cargados, así que no se mueve plata.'
                : `Se va a llevar sus ${String(pagos.length)} pagos y sus ${String(gastos.length)} gastos, y con eso salen del libro mayor.`}
            </p>
            <div className="flex gap-2.5">
              <Button
                variant="secundario"
                className="flex-1"
                onClick={() => {
                  setConfirmando(false);
                }}
              >
                Cancelar
              </Button>
              <Button
                variant="peligro"
                className="flex-1"
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
            </div>
          </div>
        </div>
      )}
    </>
  );
}
