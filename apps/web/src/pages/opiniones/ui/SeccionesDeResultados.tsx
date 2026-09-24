import {
  modoDeMostrar,
  PUNTOS_DE_LA_TASA,
  UMBRAL_BARRAS,
  UMBRAL_EVOLUCION,
  type Comentario,
  type Conteo,
  type FilaDeTrabajo,
  type ModoDeMostrar,
  type ResultadoDePregunta,
  type ResumenDeOpiniones,
  type TipoDePregunta,
  type VersionAnterior,
} from '@maun/domain';
import { useId, useState } from 'react';

import { iniciales } from '@/entities/cliente';
import { BORDE_DEL_POLO, Carita, cuantasRespuestas } from '@/entities/opinion';
import { diaYMes, haceCuanto, rutaDelProyecto, Ir } from '@/shared/lib';
import { Icono, Tablero } from '@/shared/ui';

import {
  BarraDivergente,
  PuntosDeLaTasa,
  PuntosPorPersona,
  TablaDeNumeros,
  TiraEnElTiempo,
} from './Graficos';

type AlAbrir = (respuestaId: string) => void;

const TITULO_DE_SECCION = 'text-subtitulo font-semibold';

export function Titular({ resumen }: { resumen: ResumenDeOpiniones }) {
  const promedio = resumen.titular?.promedio ?? null;
  const { enviadas, contestadas } = resumen;

  return (
    <section aria-label="El titular" className="@container mt-5.5">
      <div className="grid grid-cols-1 items-end gap-4.5 @xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] @xl:gap-x-10 @xl:gap-y-0">
        <div className="min-w-0">
          <div className="text-body-sm text-text-2">Qué tan conformes quedaron</div>
          <div className="mt-0.5 flex flex-wrap items-baseline gap-2.5">
            <span className="text-cifra leading-none font-semibold tracking-[-0.02em] tabular-nums @xl:text-cifra-lg">
              {promedio === null ? '—' : promedio.texto}
            </span>
            <span className="text-subtitulo text-text-2">de 5</span>
          </div>
          <div className="mt-1.5 text-body text-text-2">
            {promedio === null
              ? 'Todavía nadie contestó esta pregunta.'
              : promedio.n === 1
                ? 'Es el promedio de 1 respuesta'
                : `Es el promedio de ${String(promedio.n)} respuestas, una por persona`}
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-1.75 pb-1">
          <div className="text-body-sm text-text-2">Contestaron {resumen.tasa}</div>
          <PuntosDeLaTasa enviadas={enviadas} contestadas={contestadas} />
          <div className="text-label leading-snug text-text-3">
            {contestadas === 1
              ? 'Cada punto es un cliente al que le preguntaste. El lleno contestó.'
              : `Cada punto es un cliente. Los llenos contestaron.${
                  enviadas > PUNTOS_DE_LA_TASA
                    ? ` Se muestran los primeros ${String(PUNTOS_DE_LA_TASA)}.`
                    : ''
                }`}
          </div>
        </div>
      </div>
    </section>
  );
}

function UnComentario({
  comentario,
  hoy,
  alAbrir,
}: {
  comentario: Comentario;
  hoy: string;
  alAbrir: AlAbrir;
}) {
  const { titular, trabajo } = comentario;
  const filo = titular?.polo ? BORDE_DEL_POLO[titular.polo] : 'border-hairline';

  return (
    <li className={`flex min-w-0 flex-col gap-2.5 border-t-2 pt-3.5 ${filo}`}>
      <p className="max-w-[42rem] text-body-lg leading-relaxed whitespace-pre-line text-pretty @lg:text-subtitulo">
        {comentario.texto}
      </p>
      <div className="flex flex-wrap items-center gap-2.5 text-label">
        {titular !== null && (
          <span className="flex items-center gap-1.75">
            <Carita paso={titular} tamano={17} />
            <span className="font-semibold text-ink">{titular.etiqueta}</span>
          </span>
        )}
        {titular !== null && (
          <span aria-hidden className="text-text-2">
            ·
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            alAbrir(comentario.respuestaId);
          }}
          className="font-medium underline underline-offset-3"
        >
          {trabajo.cliente === '' ? 'Ver la respuesta' : trabajo.cliente}
        </button>
        <span className="min-w-0 truncate text-text-3">{trabajo.trabajo}</span>
        <span className="text-text-3">{haceCuanto(comentario.dia, hoy)}</span>
      </div>
    </li>
  );
}

export function LoQueEscribieron({
  resumen,
  hoy,
  alAbrir,
}: {
  resumen: ResumenDeOpiniones;
  hoy: string;
  alAbrir: AlAbrir;
}) {
  const idDelTitulo = useId();
  const { comentarios, contestadas } = resumen;
  const escribieron = new Set(comentarios.map((comentario) => comentario.respuestaId)).size;

  return (
    <section aria-labelledby={idDelTitulo} className="@container mt-8.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2.5">
        <h2 id={idDelTitulo} className={TITULO_DE_SECCION}>
          Lo que escribieron
        </h2>
        {escribieron > 0 && (
          <span className="text-label text-text-3">
            {String(escribieron)} de {String(contestadas)} escribieron algo
          </span>
        )}
      </div>
      {comentarios.length === 0 ? (
        <p className="mt-2.5 border-t border-hairline py-3.5 text-body-sm leading-relaxed text-text-2">
          Nadie escribió nada todavía. El comentario es opcional, así que muchos contestan las
          escalas y listo.
        </p>
      ) : (
        <Tablero
          tarjetaMinima="27rem"
          completar
          como="ul"
          className="mt-3 list-none grid-cols-1 gap-5.5 p-0 @min-[56rem]/tablero:gap-x-8 @min-[56rem]/tablero:gap-y-6.5"
        >
          {comentarios.map((comentario) => (
            <UnComentario
              key={`${comentario.respuestaId}-${comentario.pregunta}`}
              comentario={comentario}
              hoy={hoy}
              alAbrir={alAbrir}
            />
          ))}
        </Tablero>
      )}
    </section>
  );
}

function Distribucion({
  modo,
  conteos,
  tipo,
}: {
  modo: ModoDeMostrar;
  conteos: readonly Conteo[];
  tipo: TipoDePregunta;
}) {
  return modo === 'barras' ? (
    <BarraDivergente conteos={conteos} />
  ) : (
    <PuntosPorPersona conteos={conteos} tipo={tipo} />
  );
}

function LaDeAntes({
  anterior,
  hoy,
  conNumeros,
}: {
  anterior: VersionAnterior;
  hoy: string;
  conNumeros: boolean;
}) {
  const [abierta, setAbierta] = useState(false);
  const idDeLasViejas = useId();
  const { pregunta, n } = anterior;

  return (
    <div className="mt-3 border-l-2 border-border px-3.25 py-2.75 text-label leading-relaxed text-text-2">
      Antes esta pregunta decía <span className="text-ink">«{pregunta.texto}»</span> y la{' '}
      {n === 1 ? 'contestó 1 persona' : `contestaron ${String(n)} personas`} hasta{' '}
      {diaYMes(anterior.hasta, hoy)}. Esas respuestas no se suman acá, porque contestaban otra cosa.
      <button
        type="button"
        aria-expanded={abierta}
        aria-controls={idDeLasViejas}
        onClick={() => {
          setAbierta((actual) => !actual);
        }}
        className="mt-1.5 block font-medium text-ink underline underline-offset-3"
      >
        {abierta ? 'Ocultar las de antes' : 'Ver las de antes'}
      </button>
      {abierta && (
        <div id={idDeLasViejas} className="mt-3">
          <Distribucion
            modo={modoDeMostrar(pregunta, n)}
            conteos={anterior.conteos}
            tipo={pregunta.tipo}
          />
          {conNumeros && <TablaDeNumeros conteos={anterior.conteos} total={n} />}
        </div>
      )}
    </div>
  );
}

function UnaPregunta({
  resultado,
  hoy,
  conNumeros,
}: {
  resultado: ResultadoDePregunta;
  hoy: string;
  conNumeros: boolean;
}) {
  const { pregunta, n } = resultado;

  return (
    <div
      id={`pregunta-${pregunta.id}`}
      className="scroll-mt-4 border-t border-hairline-soft py-4.5"
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="text-body leading-snug font-medium text-pretty">{pregunta.texto}</h3>
        <span className="text-label whitespace-nowrap text-text-3">{cuantasRespuestas(n)}</span>
      </div>
      <Distribucion modo={resultado.modo} conteos={resultado.conteos} tipo={pregunta.tipo} />
      {conNumeros && <TablaDeNumeros conteos={resultado.conteos} total={n} />}
      {resultado.anteriores.map((anterior) => (
        <LaDeAntes
          key={anterior.pregunta.id}
          anterior={anterior}
          hoy={hoy}
          conNumeros={conNumeros}
        />
      ))}
    </div>
  );
}

export function PreguntaPorPregunta({
  resumen,
  hoy,
}: {
  resumen: ResumenDeOpiniones;
  hoy: string;
}) {
  const [conNumeros, setConNumeros] = useState(false);
  const idDelTitulo = useId();
  const idDeLasArchivadas = useId();
  const conPolos = [...resumen.preguntas, ...resumen.archivadas].filter(
    ({ pregunta }) => pregunta.tipo === 'escala5' || pregunta.tipo === 'sitalvezno',
  );
  const enBarras = conPolos.filter(({ modo }) => modo === 'barras').length;
  const repartidas =
    'Con esta cantidad de respuestas ya tiene sentido verlas repartidas. El corte del medio es «ni bien ni mal».';
  const nota =
    enBarras === 0
      ? `Cada punto es una persona. Con menos de ${String(UMBRAL_BARRAS)} respuestas no mostramos porcentajes repartidos: se leen mejor de a una.`
      : enBarras === conPolos.length
        ? repartidas
        : `${repartidas} Las que tienen menos de ${String(UMBRAL_BARRAS)} respuestas van de a una: cada punto es una persona.`;

  return (
    <section aria-labelledby={idDelTitulo} className="mt-9">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2.5">
        <h2 id={idDelTitulo} className={TITULO_DE_SECCION}>
          Pregunta por pregunta
        </h2>
        <button
          type="button"
          aria-pressed={conNumeros}
          onClick={() => {
            setConNumeros((actual) => !actual);
          }}
          className="flex h-8.5 items-center gap-1.75 rounded-field border border-border bg-paper px-2.75 text-label font-medium hover:bg-surface"
        >
          <Icono nombre="table" tamano={15} />
          {conNumeros ? 'Ocultar los números' : 'Ver los números'}
        </button>
      </div>
      <p className="mb-2.5 text-label leading-relaxed text-text-3">{nota}</p>
      {resumen.preguntas.map((resultado) => (
        <UnaPregunta
          key={resultado.pregunta.id}
          resultado={resultado}
          hoy={hoy}
          conNumeros={conNumeros}
        />
      ))}
      {resumen.archivadas.length > 0 && (
        <div aria-labelledby={idDeLasArchivadas} role="group" className="mt-6">
          <h3 id={idDeLasArchivadas} className="text-body font-semibold">
            Las que ya no preguntás
          </h3>
          <p className="mt-0.5 mb-2 text-label leading-relaxed text-text-3">
            No se preguntan más, pero lo que contestaron queda acá.
          </p>
          {resumen.archivadas.map((resultado) => (
            <UnaPregunta
              key={resultado.pregunta.id}
              resultado={resultado}
              hoy={hoy}
              conNumeros={conNumeros}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function EnElTiempo({ resumen }: { resumen: ResumenDeOpiniones }) {
  const idDelTitulo = useId();
  const { conEvolucion, puntos } = resumen.evolucion;

  return (
    <section aria-labelledby={idDelTitulo} className="mt-8">
      <h2 id={idDelTitulo} className={`mb-1 ${TITULO_DE_SECCION}`}>
        En el tiempo
      </h2>
      <p className="mb-3.5 text-label leading-relaxed text-text-3">
        {conEvolucion
          ? 'Cada barra es una respuesta, de la más vieja a la más nueva. Alto igual a qué tan conforme quedó.'
          : `Cada barra es una respuesta, en orden. Con ${String(UMBRAL_EVOLUCION)} respuestas y medio año de historia vamos a poder mostrar si mejora o empeora; con menos sería inventar una tendencia.`}
      </p>
      <TiraEnElTiempo puntos={puntos} conEvolucion={conEvolucion} />
    </section>
  );
}

function estadoDeLaFila(fila: FilaDeTrabajo, hoy: string): string {
  const { pedido } = fila;
  if (pedido.estado === 'contestada') {
    return `Contestó ${haceCuanto(pedido.envio.contestadaEl ?? pedido.envio.enviadaEl, hoy)}`;
  }
  if (pedido.estado === 'recordada') return 'Sin contestar, ya le recordaste';
  return `Le mandaste ${haceCuanto(pedido.envio.enviadaEl, hoy)}`;
}

function ContenidoDeLaFila({ fila, hoy }: { fila: FilaDeTrabajo; hoy: string }) {
  const contesto = fila.pedido.estado === 'contestada';
  const { trabajo } = fila;
  return (
    <>
      <span
        aria-hidden
        className={`flex size-8.5 flex-none items-center justify-center rounded-pill text-label font-semibold ${
          contesto ? 'bg-surface text-ink' : 'text-text-3'
        }`}
      >
        {iniciales(trabajo.cliente)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-medium">
          {trabajo.cliente === '' ? 'Sin cliente' : trabajo.cliente}
        </span>
        <span className="block truncate text-label text-text-3">{trabajo.trabajo}</span>
      </span>
      {fila.propias > 0 && (
        <span className="flex-none rounded-control border border-border px-1.75 py-0.5 text-badge font-semibold text-text-2">
          +{fila.propias} {fila.propias === 1 ? 'propia' : 'propias'}
        </span>
      )}
      <span className="flex flex-none items-center gap-2">
        {contesto && <Carita paso={fila.titular} tamano={18} />}
        <span
          className={`text-label whitespace-nowrap ${contesto ? 'font-medium text-ink' : 'text-text-3'}`}
        >
          {estadoDeLaFila(fila, hoy)}
        </span>
      </span>
    </>
  );
}

const FILA =
  'flex min-h-15 w-full items-center gap-3 border-t border-hairline-soft py-2.75 text-left text-ink no-underline hover:bg-surface';

export function TrabajoPorTrabajo({
  trabajos,
  hoy,
  alAbrir,
  id,
}: {
  trabajos: readonly FilaDeTrabajo[];
  hoy: string;
  alAbrir: AlAbrir;
  id?: string;
}) {
  const idDelTitulo = useId();

  return (
    <section id={id} aria-labelledby={idDelTitulo} className="mt-8.5">
      <h2 id={idDelTitulo} className={`mb-2.5 ${TITULO_DE_SECCION}`}>
        Trabajo por trabajo
      </h2>
      <ul className="list-none p-0">
        {trabajos.map((fila) => {
          const respuestaId = fila.pedido.envio.respuestaId;
          return (
            <li key={fila.trabajo.proyectoId}>
              {respuestaId === null ? (
                <Ir a={rutaDelProyecto(fila.trabajo.proyectoId)} className={FILA}>
                  <ContenidoDeLaFila fila={fila} hoy={hoy} />
                </Ir>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    alAbrir(respuestaId);
                  }}
                  className={FILA}
                >
                  <ContenidoDeLaFila fila={fila} hoy={hoy} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
