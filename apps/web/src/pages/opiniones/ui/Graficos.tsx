import {
  PUNTOS_DE_LA_TASA,
  porcentaje,
  type Conteo,
  type Paso,
  type PuntoDeLaEvolucion,
  type TipoDePregunta,
} from '@maun/domain';

import { Carita, FONDO_DEL_POLO } from '@/entities/opinion';
import { diaYMesCorto } from '@/shared/lib';

const COLUMNAS: Readonly<Record<TipoDePregunta, string>> = {
  escala5: 'grid-cols-2 @lg:grid-cols-5',
  sitalvezno: 'grid-cols-2 @lg:grid-cols-3',
  una: 'grid-cols-2 @lg:grid-cols-4',
  varias: 'grid-cols-2 @lg:grid-cols-4',
  texto: 'grid-cols-2',
};

function fondoDelPaso(paso: Paso): string {
  return paso.polo === null ? 'bg-ink' : FONDO_DEL_POLO[paso.polo];
}

export function PuntosPorPersona({
  conteos,
  tipo,
}: {
  conteos: readonly Conteo[];
  tipo: TipoDePregunta;
}) {
  return (
    <div className="@container">
      <ul className={`grid list-none gap-x-2 gap-y-2.5 p-0 ${COLUMNAS[tipo]}`}>
        {conteos.map(({ paso, n }) => (
          <li key={paso.valor} className="flex min-w-0 flex-col gap-1.75">
            <span aria-hidden className="flex min-h-3.5 flex-wrap items-center gap-0.75">
              {n === 0 ? (
                <span className="h-px w-2.5 bg-border" />
              ) : (
                Array.from({ length: n }, (_, indice) => (
                  <span
                    key={indice}
                    className={`size-2.5 flex-none rounded-pill ${fondoDelPaso(paso)}`}
                  />
                ))
              )}
            </span>
            <span className="flex items-center gap-1.5">
              <Carita paso={paso} tamano={15} />
              <span className="text-meta leading-tight text-text-2">{paso.etiqueta}</span>
            </span>
            <span
              className={`text-label font-semibold tabular-nums ${n > 0 ? 'text-ink' : 'text-text-3'}`}
            >
              {n}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface Tramo {
  conteo: Conteo;
  ancho: number;
  debil: boolean;
}

function tramos(conteos: readonly Conteo[]): { izquierda: Tramo[]; derecha: Tramo[] } {
  const total = Math.max(
    1,
    conteos.reduce((suma, { n }) => suma + n, 0),
  );
  const ordenados = [...conteos].sort((a, b) => a.paso.valor - b.paso.valor);
  const mal = ordenados.filter(({ paso }) => paso.polo === 'mal');
  const bien = ordenados.filter(({ paso }) => paso.polo === 'bien');
  const neutro = ordenados.find(({ paso }) => paso.polo === 'neutro');
  const medio = (conteo: Conteo | undefined): Tramo[] =>
    conteo === undefined ? [] : [{ conteo, ancho: (conteo.n / total) * 50, debil: false }];
  return {
    izquierda: [
      ...mal.map((conteo, indice) => ({
        conteo,
        ancho: (conteo.n / total) * 100,
        debil: mal.length > 1 && indice === mal.length - 1,
      })),
      ...medio(neutro),
    ],
    derecha: [
      ...medio(neutro),
      ...bien.map((conteo, indice) => ({
        conteo,
        ancho: (conteo.n / total) * 100,
        debil: bien.length > 1 && indice === 0,
      })),
    ],
  };
}

function Segmento({ tramo }: { tramo: Tramo }) {
  const { paso } = tramo.conteo;
  if (tramo.ancho === 0 || paso.polo === null) return null;
  return (
    <span
      style={{ width: `${String(tramo.ancho)}%` }}
      className={`h-full ${FONDO_DEL_POLO[paso.polo]} ${tramo.debil ? 'opacity-55' : ''}`}
    />
  );
}

export function BarraDivergente({ conteos }: { conteos: readonly Conteo[] }) {
  const { izquierda, derecha } = tramos(conteos);
  const debiles = new Set(
    [...izquierda, ...derecha]
      .filter((tramo) => tramo.debil)
      .map((tramo) => tramo.conteo.paso.valor),
  );

  return (
    <div>
      <div aria-hidden className="grid h-6.5 grid-cols-2 items-center">
        <div className="flex h-full justify-end gap-0.5">
          {izquierda.map((tramo) => (
            <Segmento key={tramo.conteo.paso.valor} tramo={tramo} />
          ))}
        </div>
        <div className="flex h-full justify-start gap-0.5">
          {derecha.map((tramo) => (
            <Segmento key={tramo.conteo.paso.valor} tramo={tramo} />
          ))}
        </div>
      </div>
      <div aria-hidden className="relative h-3">
        <span className="absolute -top-7.5 left-1/2 h-8.5 w-px bg-text-3" />
      </div>
      <ul className="mt-0.5 flex list-none flex-wrap gap-x-4 gap-y-2 p-0">
        {conteos.map(({ paso, n }) => (
          <li key={paso.valor} className="flex items-center gap-1.5 text-meta text-text-2">
            <span
              aria-hidden
              className={`size-2.75 flex-none ${fondoDelPaso(paso)} ${
                debiles.has(paso.valor) ? 'opacity-55' : ''
              } ${paso.polo === 'neutro' ? 'rounded-pill' : ''}`}
            />
            {paso.etiqueta} ({n})
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TablaDeNumeros({ conteos, total }: { conteos: readonly Conteo[]; total: number }) {
  return (
    <table className="mt-3 w-full border-collapse text-label">
      <tbody>
        {conteos.map(({ paso, n }) => (
          <tr key={paso.valor}>
            <th
              scope="row"
              className="border-t border-hairline-soft py-1.5 text-left font-normal text-text-2"
            >
              {paso.etiqueta}
            </th>
            <td className="border-t border-hairline-soft py-1.5 text-right font-medium tabular-nums">
              {porcentaje(n, total)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function PuntosDeLaTasa({
  enviadas,
  contestadas,
}: {
  enviadas: number;
  contestadas: number;
}) {
  return (
    <span aria-hidden className="flex flex-wrap items-center gap-0.75">
      {Array.from({ length: Math.min(enviadas, PUNTOS_DE_LA_TASA) }, (_, indice) => (
        <span
          key={indice}
          className={`size-2.25 flex-none rounded-pill ${
            indice < contestadas ? 'bg-ink' : 'border border-border'
          }`}
        />
      ))}
    </span>
  );
}

const ALTO_CON_EVOLUCION = 92;

const ALTO_SIN_EVOLUCION = 64;

export function TiraEnElTiempo({
  puntos,
  conEvolucion,
}: {
  puntos: readonly PuntoDeLaEvolucion[];
  conEvolucion: boolean;
}) {
  const alto = conEvolucion ? ALTO_CON_EVOLUCION : ALTO_SIN_EVOLUCION;
  const primero = puntos[0];
  const ultimo = puntos[puntos.length - 1];
  const descripcion =
    primero && ultimo
      ? `${String(puntos.length)} ${puntos.length === 1 ? 'respuesta' : 'respuestas'}, del ${diaYMesCorto(primero.dia)} al ${diaYMesCorto(ultimo.dia)}`
      : 'Sin respuestas';

  return (
    <>
      <div
        role="img"
        aria-label={descripcion}
        style={{ height: `${String(alto)}px` }}
        className={`flex items-end overflow-hidden border-b border-hairline pb-2 ${
          conEvolucion ? 'gap-1' : 'gap-2'
        }`}
      >
        {puntos.map((punto) => (
          <span
            key={punto.respuestaId}
            title={`${punto.cliente}: ${punto.paso.etiqueta}, ${diaYMesCorto(punto.dia)}`}
            style={{
              height: `${String(Math.round(14 + (punto.paso.valor - 1) * ((alto - 22) / 4)))}px`,
            }}
            className={`min-w-1.5 flex-1 rounded-control ${fondoDelPaso(punto.paso)} ${
              conEvolucion ? 'max-w-4' : 'max-w-5.5'
            }`}
          />
        ))}
      </div>
      {primero && ultimo && (
        <div className="mt-1.75 flex justify-between text-meta text-text-3">
          <span>{diaYMesCorto(primero.dia)}</span>
          <span>{diaYMesCorto(ultimo.dia)}</span>
        </div>
      )}
    </>
  );
}
