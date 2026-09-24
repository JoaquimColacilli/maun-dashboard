import type { CSSProperties } from 'react';

import { formatearPesos, TESORO } from '@/shared/lib';

import type { Despiece } from '../model/despiece';
import { porcentaje } from '../model/porcentaje';

function animacionDelCorte(indice: number): CSSProperties {
  return {
    animationName: 'maun-corte',
    animationDuration: 'var(--dur-corte)',
    animationTimingFunction: 'var(--ease-out)',
    animationFillMode: 'both',
    animationDelay: `calc(${String(indice)} * var(--dur-corte-stagger))`,
  };
}

function Tablero({ despiece, animar }: { despiece: Despiece; animar: boolean }) {
  const visibles = despiece.piezas.filter((pieza) => pieza.monto > 0);
  if (visibles.length === 0) return null;

  return (
    <div
      aria-hidden
      className={`mt-3 flex h-16 gap-0.5 overflow-hidden rounded-control ${
        despiece.modo === 'real' ? 'bg-ink' : 'bg-border'
      }`}
    >
      {visibles.map((pieza, indice) => {
        const tesoro = TESORO[pieza.tesoro];
        return (
          <div
            key={pieza.id}
            style={{
              flex: `${pieza.parte.toFixed(4)} 1 0`,
              ...(animar ? animacionDelCorte(indice) : {}),
            }}
            title={`${pieza.etiqueta}: ${formatearPesos(pieza.monto)}`}
            className={`flex min-w-[3px] items-end p-1.5 ${
              despiece.modo === 'real'
                ? `${tesoro.barra} text-paper`
                : `${tesoro.fondo} border border-current ${tesoro.texto}`
            }`}
          >
            {pieza.parte >= 0.16 && (
              <span className="truncate text-badge font-semibold">{pieza.etiqueta}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

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
  const enProyeccion = despiece.modo === 'proyeccion';

  return (
    <section aria-label="Distribución de la ganancia" className="tabular-nums">
      <div className="flex flex-wrap items-end justify-between gap-3">
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
        <p className="mt-3 rounded-field border border-dashed border-border px-4 py-5 text-center text-label leading-relaxed text-text-2">
          {despiece.cobrado === 0
            ? 'Todavía no entró plata de este trabajo. Cuando se cobre, acá se ve cómo se corta la ganancia entre los cuatro tesoros.'
            : 'Los gastos se comieron lo cobrado: no hay ganancia que repartir y la pérdida queda en el remanente del taller.'}
        </p>
      ) : (
        <>
          <Tablero despiece={despiece} animar={animar} />
          <ul className="mt-2.5 list-none">
            {despiece.piezas.map((pieza) => {
              const tesoro = TESORO[pieza.tesoro];
              return (
                <li
                  key={pieza.id}
                  className="flex items-center gap-2.5 border-t border-hairline-soft py-2 text-label"
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
        <p className="mt-2.5 text-meta leading-normal text-text-3">
          Proyección sobre lo cobrado hasta hoy. El corte se hace efectivo cuando el proyecto se
          cobre.
        </p>
      )}

      {provisoria && (
        <p className="mt-2.5 rounded-field bg-atencion-tint px-3 py-2 text-meta leading-normal text-atencion">
          Este reparto todavía no lo confirmó el servidor: es el que va a quedar si nada cambió del
          otro lado. Se confirma solo cuando vuelva la señal.
        </p>
      )}
    </section>
  );
}
