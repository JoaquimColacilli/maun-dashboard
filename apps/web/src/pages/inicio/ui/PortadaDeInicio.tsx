import { useEffect, useId, useState, type ReactNode } from 'react';

import { fraseDelCorte, piezasDelCorte, type CorteDelMes } from '@/entities/proyecto';
import {
  formatearPesos,
  mesDeLaFecha,
  nombreDelMes,
  useAnchoDePantalla,
  useIr,
} from '@/shared/lib';
import {
  Button,
  FilaDeAcciones,
  TableroCortado,
  TableroEntero,
  TarjetaConLamina,
  TITULO_DE_LAMINA,
} from '@/shared/ui';

let laPortadaYaSeCorto = false;

export interface PortadaDeInicioProps {
  hoy: string;
  corte: CorteDelMes | null;
  arranque: boolean;
}

export function PortadaDeInicio({ hoy, corte, arranque }: PortadaDeInicioProps) {
  const titulo = useId();
  const ir = useIr();
  const ancho = useAnchoDePantalla();
  const [animar] = useState(() => !laPortadaYaSeCorto);

  const cortado = !arranque && corte !== null && corte.tablero > 0;
  const seMueve = arranque || cortado;

  useEffect(() => {
    if (seMueve) laPortadaYaSeCorto = true;
  }, [seMueve]);

  const mes = mesDeLaFecha(hoy);
  const formato = ancho === 'movil' ? 'medio' : 'amplio';

  let dibujo: ReactNode = <TableroEntero formato={formato} />;
  if (arranque) {
    dibujo = <TableroEntero formato={formato} herramientas animar={animar} />;
  } else if (cortado) {
    dibujo = (
      <TableroCortado
        piezas={piezasDelCorte(corte)}
        formato={formato}
        medida={ancho === 'movil' ? undefined : formatearPesos(corte.tablero)}
        animar={animar}
      />
    );
  }

  return (
    <TarjetaConLamina
      como="section"
      aria-labelledby={titulo}
      dibujo={dibujo}
      lamina="@min-[64rem]/con-lamina:[&>svg]:w-[400px]"
    >
      {arranque ? (
        <>
          <h2 id={titulo} className={TITULO_DE_LAMINA}>
            El taller arranca acá
          </h2>
          <p className="text-body leading-relaxed text-text-2">
            Cargá el sueldo que te asignás y tus costos fijos para que Inicio te cuente cuánto te
            falta cada mes. Después, el primer proyecto.
          </p>
          <div className="w-full pt-2">
            <FilaDeAcciones>
              <Button
                onClick={() => {
                  ir('/ajustes');
                }}
              >
                Configurar sueldo y metas
              </Button>
              <Button
                variant="secundario"
                onClick={() => {
                  ir('/proyectos');
                }}
              >
                Cargar el primer proyecto
              </Button>
            </FilaDeAcciones>
          </div>
        </>
      ) : (
        <>
          <h2 id={titulo} className="text-label font-semibold text-text-2">
            {`El corte de ${nombreDelMes(mes).toLowerCase()}`}
          </h2>
          <p className="font-display text-firma leading-snug text-pretty @min-[40rem]/con-lamina:text-portada">
            {fraseDelCorte(corte, mes)}
          </p>
        </>
      )}
    </TarjetaConLamina>
  );
}
