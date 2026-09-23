import { faseDe, type CategoriaDeCosto, type MargenDelTrabajo } from '@maun/domain';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { mensajeDeSincronizacion } from '@/shared/api';
import { formatearPesos, metaDeAvisos, useAlgoEnCurso } from '@/shared/lib';
import { BloquePlegable, EstadoDeGuardado, MoneyInput } from '@/shared/ui';

import { MUTACION_DE_COSTOS } from '../api/mutacion';
import type { Proyecto } from '../model/catalogos';
import {
  cambiosDeCostos,
  costoGuardado,
  COSTOS_DEL_TRABAJO,
  margenDelTrabajo,
} from '../model/costos';

const DEMORA_DE_LOS_COSTOS_MS = 900;

type Escritos = Record<CategoriaDeCosto, number | null>;

function loGuardado(proyecto: Proyecto): Escritos {
  const escritos = {} as Escritos;
  for (const costo of COSTOS_DEL_TRABAJO) {
    escritos[costo.categoria] = costoGuardado(proyecto, costo.columna);
  }
  return escritos;
}

function Renglon({ clave, valor, tono = '' }: { clave: string; valor: string; tono?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-hairline py-2">
      <span className="text-label text-text-2">{clave}</span>
      <span className={`text-money font-semibold tabular-nums whitespace-nowrap ${tono}`}>
        {valor}
      </span>
    </div>
  );
}

function Margen({ margen, enSeguimiento }: { margen: MargenDelTrabajo; enSeguimiento: boolean }) {
  if (margen.situacion === 'sin-estimar') return null;

  if (margen.situacion === 'sin-presupuesto') {
    return (
      <>
        <Renglon clave="Costo estimado" valor={formatearPesos(margen.estimado)} />
        <p className="pt-1.5 text-meta leading-normal text-text-3">
          Cuando el trabajo tenga presupuesto, acá va lo que te queda.
        </p>
      </>
    );
  }

  const enContra = margen.margen < 0;
  return (
    <>
      <Renglon clave="Costo estimado" valor={formatearPesos(margen.estimado)} />
      <Renglon clave="Presupuesto" valor={formatearPesos(margen.presupuesto)} />
      <Renglon
        clave={enSeguimiento ? 'Te queda, si te lo aprueban' : 'Te queda'}
        valor={formatearPesos(margen.margen)}
        tono={enContra ? 'text-alerta' : 'text-hogar'}
      />
      {enContra && (
        <p className="pt-1.5 text-meta leading-normal font-medium text-alerta">
          Estás estimando más gasto que presupuesto.
        </p>
      )}
    </>
  );
}

export interface CostosDeCotizarProps {
  proyecto: Proyecto;
  abiertoAlPrincipio?: boolean;
}

export function CostosDeCotizar({ proyecto, abiertoAlPrincipio = true }: CostosDeCotizarProps) {
  const guardar = useMutation({
    ...MUTACION_DE_COSTOS,
    meta: metaDeAvisos('costosEstimados', { silencioso: true, sujeto: proyecto.titulo }),
  });
  const [escritos, setEscritos] = useState<Escritos | null>(null);
  const [sinGuardar, setSinGuardar] = useState(false);
  const reloj = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useAlgoEnCurso(sinGuardar);

  useEffect(
    () => () => {
      clearTimeout(reloj.current);
    },
    [],
  );

  const visibles = escritos ?? loGuardado(proyecto);
  const margen = margenDelTrabajo(
    escritos === null
      ? proyecto
      : ({ ...proyecto, ...cambiosDeCostos(escritos) } satisfies Proyecto),
  );
  const cargadas = COSTOS_DEL_TRABAJO.filter((costo) => visibles[costo.categoria] !== null).length;

  function alEscribir(categoria: CategoriaDeCosto, valor: number | null): void {
    const siguientes = { ...visibles, [categoria]: valor };
    setEscritos(siguientes);
    setSinGuardar(true);
    clearTimeout(reloj.current);
    reloj.current = setTimeout(() => {
      setSinGuardar(false);
      guardar.mutate({
        id: proyecto.id,
        cambios: cambiosDeCostos(siguientes),
        previos: cambiosDeCostos(loGuardado(proyecto)),
        version: proyecto.version,
      });
    }, DEMORA_DE_LOS_COSTOS_MS);
  }

  return (
    <BloquePlegable
      titulo="Costos estimados"
      abiertoAlPrincipio={abiertoAlPrincipio}
      ayuda="Lo que calculás que vas a gastar. No toca el presupuesto: ese lo ponés vos, con tu ganancia adentro."
      resumen={
        <span className="flex items-center gap-2.5">
          {cargadas > 0 && (
            <span>
              {String(cargadas)} de {String(COSTOS_DEL_TRABAJO.length)}
            </span>
          )}
          <EstadoDeGuardado
            sinGuardar={sinGuardar}
            enPausa={guardar.isPaused}
            enVuelo={guardar.isPending && !guardar.isPaused}
            conError={guardar.isError}
            guardado={guardar.isSuccess}
          />
        </span>
      }
    >
      <div className="@container/costos">
        <div className="grid grid-cols-1 gap-3 @sm/costos:grid-cols-2">
          {COSTOS_DEL_TRABAJO.map((costo) => (
            <MoneyInput
              key={costo.columna}
              etiqueta={costo.etiqueta}
              placeholder="Sin estimar"
              value={visibles[costo.categoria]}
              onChange={(valor) => {
                alEscribir(costo.categoria, valor);
              }}
            />
          ))}
        </div>
      </div>

      <div className="mt-3.5">
        <Margen
          margen={margen}
          enSeguimiento={
            faseDe(proyecto.estado) === 'consultas' || faseDe(proyecto.estado) === 'seguimiento'
          }
        />
      </div>

      {guardar.isError && (
        <p role="alert" className="mt-1.5 text-label font-medium text-alerta">
          {mensajeDeSincronizacion(guardar.error)}
        </p>
      )}
    </BloquePlegable>
  );
}
