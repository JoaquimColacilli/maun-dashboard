import type { PreguntaDeLaEncuesta } from '@maun/domain';
import { useState } from 'react';

import { FormularioDeLaEncuesta, GraciasPorContestar } from '@/entities/opinion';
import { Hoja } from '@/shared/ui';

export interface VistaPreviaProps {
  taller: string;
  preguntas: readonly PreguntaDeLaEncuesta[];
  resena: string | null;
  alCerrar: () => void;
}

export function VistaPrevia({ taller, preguntas, resena, alCerrar }: VistaPreviaProps) {
  const [contestada, setContestada] = useState(false);

  return (
    <Hoja
      titulo="Así la ve tu cliente"
      bajada="No se guarda nada de lo que toques acá"
      alCerrar={alCerrar}
    >
      <div className="flex min-h-0 flex-1 justify-center overflow-auto bg-surface p-4.5">
        <div className="h-fit w-[390px] max-w-full flex-none overflow-hidden rounded-telefono border border-border bg-paper shadow-float">
          {contestada ? (
            <GraciasPorContestar taller={taller} cliente={null} resena={resena} />
          ) : (
            <FormularioDeLaEncuesta
              taller={taller}
              trabajo=""
              preguntas={preguntas}
              idDeLaRespuesta="vista-previa"
              alMandar={() => {
                setContestada(true);
                return Promise.resolve(null);
              }}
            />
          )}
        </div>
      </div>
    </Hoja>
  );
}
