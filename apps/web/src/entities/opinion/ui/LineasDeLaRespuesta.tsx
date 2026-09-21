import type { LineaDeLaRespuesta } from '@maun/domain';

import { diaYMes } from '@/shared/lib';

import { Carita } from './Carita';
import { MarcaDelTaller } from './EncuestaDelCliente';

function MarcaDePropia() {
  return (
    <span className="mt-1.5 inline-block rounded-control border border-border px-1.75 py-0.5 text-badge font-semibold text-text-2">
      Pregunta propia de este trabajo
    </span>
  );
}

export interface LineasDeLaRespuestaProps {
  lineas: readonly LineaDeLaRespuesta[];
  conPropias?: boolean;
}

export function LineasDeLaRespuesta({ lineas, conPropias = false }: LineasDeLaRespuestaProps) {
  const elegidas = lineas.filter((linea) => linea.texto === null);
  const escritas = lineas.filter((linea) => linea.texto !== null);
  return (
    <>
      {elegidas.length > 0 && (
        <ul className="m-0 list-none p-0">
          {elegidas.map((linea) => (
            <li key={linea.pregunta.id} className="border-b border-hairline-soft py-3.25">
              <div className="mb-1.25 text-label leading-snug text-text-2">
                {linea.pregunta.texto}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {linea.pasos.map((paso) => (
                  <span key={paso.valor} className="flex items-center gap-2.25">
                    <Carita paso={paso} tamano={19} />
                    <span className="text-body-lg font-semibold text-ink">{paso.etiqueta}</span>
                  </span>
                ))}
              </div>
              {conPropias && linea.pregunta.propia && <MarcaDePropia />}
            </li>
          ))}
        </ul>
      )}
      {escritas.map((linea) => (
        <div key={linea.pregunta.id} className="mt-4">
          <div className="mb-1.75 text-label text-text-2">{linea.pregunta.texto}</div>
          <p className="papel-rayado m-0 rounded-field px-4 py-3.5 text-body-lg leading-7 whitespace-pre-line text-pretty">
            {linea.texto}
          </p>
          {conPropias && linea.pregunta.propia && <MarcaDePropia />}
        </div>
      ))}
    </>
  );
}

export interface LoQueContestasteProps {
  taller: string;
  fecha: string;
  hoy: string;
  lineas: readonly LineaDeLaRespuesta[];
}

export function LoQueContestaste({ taller, fecha, hoy, lineas }: LoQueContestasteProps) {
  return (
    <div className="@container w-full">
      <div className="mx-auto w-full max-w-[560px] px-5 pt-5.5 pb-11 @lg:px-7 @lg:pt-10 @lg:pb-14">
        <MarcaDelTaller taller={taller} />
        <h1 className="mt-2 font-display text-h1 leading-tight font-normal @lg:text-h1-lg">
          Ya nos contaste, gracias
        </h1>
        <p className="mt-2 text-body leading-relaxed text-text-2">
          Contestaste el {diaYMes(fecha, hoy)}. Esto es lo que pusiste. No se puede cambiar, pero si
          te quedó algo en el tintero, escribinos.
        </p>
        <div className="mt-5.5">
          <LineasDeLaRespuesta lineas={lineas} />
        </div>
      </div>
    </div>
  );
}
