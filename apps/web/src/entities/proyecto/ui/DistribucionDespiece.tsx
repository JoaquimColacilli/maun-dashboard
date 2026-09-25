import { formatearPesos, TESORO, useAnchoDePantalla } from '@/shared/lib';
import { Lamina, TableroCortado, type PiezaDelTablero } from '@/shared/ui';

import type { Despiece, PiezaDelDespiece } from '../model/despiece';
import { porcentaje } from '../model/porcentaje';

const NOMBRE_EN_EL_TABLERO = {
  diezmo: 'Diezmo',
  sueldo: 'Sueldo',
  fijos: 'Costos fijos',
  remanente: 'Remanente',
} as const satisfies Record<PiezaDelDespiece['id'], string>;

export interface DistribucionDespieceProps {
  despiece: Despiece;
  animar?: boolean;
  provisoria?: boolean;
}

export function DistribucionDespiece({
  despiece,
  animar = false,
  provisoria = false,
}: DistribucionDespieceProps) {
  const ancho = useAnchoDePantalla();
  const enProyeccion = despiece.modo === 'proyeccion';

  const piezas: PiezaDelTablero[] = despiece.piezas
    .filter((pieza) => pieza.monto > 0)
    .map((pieza) => ({
      id: pieza.id,
      tono: pieza.tesoro,
      parte: pieza.parte,
      nombre: NOMBRE_EN_EL_TABLERO[pieza.id],
      porcentaje: porcentaje(pieza.parte),
      detalle: `${pieza.etiqueta}: ${formatearPesos(pieza.monto)}`,
    }));

  return (
    <section
      aria-label="Distribución de la ganancia"
      className="flex flex-col gap-3 rounded-panel border border-hairline bg-paper p-1.5 tabular-nums"
    >
      <div className="flex flex-wrap items-end justify-between gap-3 px-3.5 pt-3">
        <div>
          <h2 className="text-section font-semibold">Distribución de la ganancia</h2>
          <p className="mt-0.5 text-meta text-text-2">
            {formatearPesos(despiece.cobrado)} cobrados menos {formatearPesos(despiece.gastos)} de
            gastos
          </p>
        </div>
        <div className="text-right">
          <span className="block text-meta text-text-2">Ganancia neta</span>
          <span
            className={`block text-money-lg leading-tight font-semibold ${
              despiece.neta < 0 ? 'text-alerta' : enProyeccion ? 'text-text-2' : 'text-ink'
            }`}
          >
            {formatearPesos(despiece.neta)}
          </span>
        </div>
      </div>

      {despiece.neta <= 0 ? (
        <p className="rounded-lamina border border-dashed border-border px-4 py-5 text-center text-label leading-relaxed text-text-2">
          {despiece.cobrado === 0
            ? 'Todavía no entró plata de este trabajo. Cuando se cobre, acá se ve cómo se corta la ganancia entre los cuatro tesoros.'
            : 'Los gastos se comieron lo cobrado: no hay ganancia que repartir y la pérdida queda en el remanente del taller.'}
        </p>
      ) : (
        <>
          <Lamina className="h-[176px] md:h-[216px]">
            <TableroCortado
              piezas={piezas}
              formato={ancho === 'movil' ? 'medio' : 'amplio'}
              proyectado={enProyeccion}
              animar={animar}
            />
          </Lamina>
          <ul className="list-none px-3.5 pb-1">
            {despiece.piezas.map((pieza) => {
              const tesoro = TESORO[pieza.tesoro];
              return (
                <li
                  key={pieza.id}
                  className="flex items-center gap-2.5 border-t border-hairline-soft py-2 text-label first:border-t-0"
                >
                  <span
                    aria-hidden
                    className={`size-3 flex-none rounded-[3px] ${
                      despiece.modo === 'real' ? tesoro.barra : tesoro.fondo
                    }`}
                  />
                  <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
                    <span className="font-medium">{pieza.etiqueta}</span>
                    <span className={`text-meta font-semibold ${tesoro.texto}`}>
                      a {tesoro.nombre.toUpperCase()}
                    </span>
                    {pieza.falta > 0 && (
                      <span className="text-meta text-alerta">
                        faltan {formatearPesos(pieza.falta)}
                      </span>
                    )}
                  </span>
                  <span className="flex-none text-right font-semibold">
                    {formatearPesos(pieza.monto)}
                  </span>
                  <span className="w-10 flex-none text-right text-meta text-text-3">
                    {porcentaje(pieza.parte)}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {enProyeccion && (
        <p className="px-3.5 pb-3 text-meta leading-normal text-text-3">
          Proyección sobre lo cobrado hasta hoy. El corte se hace efectivo cuando el proyecto se
          cobre.
        </p>
      )}

      {provisoria && (
        <p className="mx-2 mb-2 rounded-field bg-atencion-tint px-3 py-2 text-meta leading-normal text-atencion">
          Este reparto todavía no lo confirmó el servidor: es el que va a quedar si nada cambió del
          otro lado. Se confirma solo cuando vuelva la señal.
        </p>
      )}
    </section>
  );
}
