import { comoLaVeElCliente, duracion, TOPE_PREGUNTAS, type TonoDelLargo } from '@maun/domain';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';

import { cuantasRespuestas, preguntaGuardada, TIPO } from '@/entities/opinion';
import { useReplicaDelTaller } from '@/entities/replica';
import { ajustesDe, householdDe } from '@/shared/api';
import { diaLocal, haceCuanto, rutaDeLaPregunta, rutaDelProyecto, Ir } from '@/shared/lib';
import { ConSalida, FilaDeAcciones, Icono } from '@/shared/ui';

import {
  agregarPregunta,
  cambiarPregunta,
  dejarDePreguntar,
  mover,
  volverAPreguntar,
} from '../model/acciones';
import { encuestaDelEditor, type PreguntaDelEditor } from '../model/lista';
import { EditorDeUnaPregunta } from './EditorDeUnaPregunta';
import { VistaPrevia } from './VistaPrevia';

const FONDO_DEL_LARGO: Readonly<Record<TonoDelLargo, string>> = {
  ok: 'border-hairline bg-paper',
  atencion: 'border-transparent bg-atencion-tint',
  alerta: 'border-transparent bg-alerta-tint',
};

const NUEVA = 'nueva';

const AGREGAR = 'agregar';

const ESPERA_DEL_FOCO_MS = 2000;

const SIN_USO = { respuestas: 0, enviada: false } as const;

type Control = 'texto' | 'subir' | 'bajar';

interface FocoPendiente {
  clave: string;
  id: string | null;
  posicion: number | null;
}

function claveDe(id: string, control: Control): string {
  return `${id}:${control}`;
}

const BOTON_CHICO =
  'flex flex-none items-center justify-center rounded-pill bg-transparent hover:bg-surface';

interface FilaDeLaPreguntaProps {
  id: string;
  texto: string;
  sinEscribir: boolean;
  meta: ReactNode;
  abierta: boolean;
  primera: boolean;
  ultima: boolean;
  alAbrir: () => void;
  alSubir: () => void;
  alBajar: () => void;
  alArchivar: (() => void) | null;
  children: ReactNode;
}

function FilaDeLaPregunta({
  id,
  texto,
  sinEscribir,
  meta,
  abierta,
  primera,
  ultima,
  alAbrir,
  alSubir,
  alBajar,
  alArchivar,
  children,
}: FilaDeLaPreguntaProps) {
  const unico = useId();
  const idDelTexto = `${unico}-texto`;

  return (
    <li className="border-t border-hairline-soft first:border-t-0">
      <div className="flex items-start gap-3 py-3.5">
        <span className="flex flex-none flex-col gap-px pt-0.5">
          <button
            type="button"
            data-foco={claveDe(id, 'subir')}
            aria-label="Subir"
            aria-describedby={idDelTexto}
            disabled={primera}
            onClick={alSubir}
            className={`${BOTON_CHICO} h-6 w-7 text-text-3 hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent`}
          >
            <Icono nombre="chevron-up" tamano={16} />
          </button>
          <button
            type="button"
            data-foco={claveDe(id, 'bajar')}
            aria-label="Bajar"
            aria-describedby={idDelTexto}
            disabled={ultima}
            onClick={alBajar}
            className={`${BOTON_CHICO} h-6 w-7 text-text-3 hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent`}
          >
            <Icono nombre="chevron-down" tamano={16} />
          </button>
        </span>
        <button
          type="button"
          data-foco={claveDe(id, 'texto')}
          aria-expanded={abierta}
          onClick={alAbrir}
          className="flex min-w-0 flex-1 flex-col items-start gap-1.25 text-left"
        >
          <span
            id={idDelTexto}
            className={`text-body-lg leading-snug text-pretty ${sinEscribir ? 'text-text-3' : 'text-ink'}`}
          >
            {texto}
          </span>
          <span className="flex flex-wrap items-center gap-2.25 text-label text-text-2">
            {meta}
          </span>
        </button>
        <span className="flex flex-none gap-0.5">
          <button
            type="button"
            aria-label="Editar"
            aria-describedby={idDelTexto}
            onClick={alAbrir}
            className={`${BOTON_CHICO} size-9.5 text-text-2 hover:text-ink`}
          >
            <Icono nombre="pencil" tamano={16} />
          </button>
          {alArchivar !== null && (
            <button
              type="button"
              aria-label="Dejar de preguntarla"
              aria-describedby={idDelTexto}
              title="Dejar de preguntarla"
              onClick={alArchivar}
              className={`${BOTON_CHICO} size-9.5 text-text-3 hover:text-alerta`}
            >
              <Icono nombre="archive" tamano={16} />
            </button>
          )}
        </span>
      </div>
      {children}
    </li>
  );
}

function MetaDeLaPregunta({ item }: { item: PreguntaDelEditor }) {
  const { fila, uso, versionada } = item;
  return (
    <>
      <span className="inline-flex items-center gap-1.5">
        <Icono nombre={TIPO[fila.tipo].icono} tamano={14} />
        {TIPO[fila.tipo].etiqueta}
      </span>
      {fila.obligatoria && <span className="text-text-3">Obligatoria</span>}
      {uso.respuestas > 0 && (
        <span className="text-text-3">{cuantasRespuestas(uso.respuestas)}</span>
      )}
      {versionada && (
        <span className="rounded-pill border border-border px-2 py-px font-semibold text-text-2">
          versión {fila.numero}
        </span>
      )}
    </>
  );
}

function Archivada({
  item,
  bloqueada,
  alVolver,
}: {
  item: PreguntaDelEditor;
  bloqueada: boolean;
  alVolver: () => void;
}) {
  const unico = useId();
  const idDelTexto = `${unico}-texto`;
  const { fila, uso } = item;
  const cuando =
    fila.archivada_at === null
      ? ''
      : ` · dejaste de preguntarla ${haceCuanto(diaLocal(fila.archivada_at))}`;

  return (
    <li className="flex flex-wrap items-start gap-x-3 gap-y-2 border-t border-hairline-soft py-3.5 first:border-t-0">
      <span className="flex size-8.5 flex-none items-center justify-center rounded-field bg-surface text-text-3">
        <Icono nombre="archive" tamano={17} />
      </span>
      <span className="min-w-0 flex-1 basis-24">
        <span id={idDelTexto} className="block text-body leading-snug text-text-2">
          {fila.texto}
        </span>
        <span className="mt-0.75 block text-label text-text-3">
          {TIPO[fila.tipo].etiqueta} ·{' '}
          {uso.respuestas > 0 ? cuantasRespuestas(uso.respuestas) : 'sin respuestas'}
          {cuando}
        </span>
      </span>
      <span className="ml-auto flex flex-none gap-0.5">
        {uso.respuestas > 0 && (
          <Ir
            a={rutaDeLaPregunta(fila.id)}
            aria-describedby={idDelTexto}
            className="flex h-9.5 items-center rounded-pill border border-border bg-paper px-2.75 text-label font-medium no-underline hover:bg-surface"
          >
            Ver respuestas
          </Ir>
        )}
        <button
          type="button"
          aria-label="Volver a preguntarla"
          aria-describedby={idDelTexto}
          title={
            bloqueada
              ? `Ya preguntás ${String(TOPE_PREGUNTAS)}: para volver a preguntarla, sacá otra.`
              : 'Volver a preguntarla'
          }
          disabled={bloqueada}
          onClick={alVolver}
          className={`${BOTON_CHICO} size-9.5 text-text-3 hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent`}
        >
          <Icono nombre="rotate-ccw" tamano={16} />
        </button>
      </span>
    </li>
  );
}

export function EditorDeLaEncuesta() {
  const replica = useReplicaDelTaller();
  const cliente = useQueryClient();
  const [abierta, setAbierta] = useState<string | null>(null);
  const [previa, setPrevia] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const pendiente = useRef<FocoPendiente | null>(null);

  const encuesta = useMemo(() => encuestaDelEditor(replica), [replica]);
  const { vigentes, archivadas, propias, siguienteOrden } = encuesta;
  const ids = vigentes.map((item) => item.fila.id);
  const largo = duracion(vigentes.map((item) => item.fila.tipo));
  const enElTope = vigentes.length >= TOPE_PREGUNTAS;
  const conRenglones = vigentes.length > 0 || abierta === NUEVA;
  const taller = householdDe(replica)?.nombre ?? '';
  const resena = ajustesDe(replica)?.resena_link ?? '';

  useEffect(() => {
    const quiero = pendiente.current;
    if (quiero === null) return;
    if (
      quiero.id !== null &&
      quiero.posicion !== null &&
      ids.indexOf(quiero.id) !== quiero.posicion
    ) {
      return;
    }
    const elemento = raiz.current?.querySelector<HTMLElement>(`[data-foco="${quiero.clave}"]`);
    if (!elemento) return;
    elemento.focus();
    pendiente.current = null;
  });

  function pedirFoco(
    clave: string,
    id: string | null = null,
    posicion: number | null = null,
  ): void {
    const pedido = { clave, id, posicion };
    pendiente.current = pedido;
    window.setTimeout(() => {
      if (pendiente.current === pedido) pendiente.current = null;
    }, ESPERA_DEL_FOCO_MS);
  }

  function moverla(posicion: number, hacia: 'arriba' | 'abajo'): void {
    const destino = hacia === 'arriba' ? posicion - 1 : posicion + 1;
    const item = vigentes[posicion];
    const vecina = vigentes[destino];
    if (!item || !vecina) return;
    mover(cliente, item.fila, vecina.fila, hacia);
    let control: Control = hacia === 'arriba' ? 'subir' : 'bajar';
    if (destino === 0) control = 'bajar';
    if (destino === vigentes.length - 1) control = 'subir';
    pedirFoco(claveDe(item.fila.id, control), item.fila.id, destino);
  }

  function archivar(posicion: number): void {
    const item = vigentes[posicion];
    if (!item) return;
    const siguiente = vigentes[posicion + 1] ?? vigentes[posicion - 1];
    dejarDePreguntar(cliente, item.fila, item.borrable);
    if (abierta === item.fila.id) setAbierta(null);
    pedirFoco(siguiente ? claveDe(siguiente.fila.id, 'texto') : AGREGAR);
  }

  function abrir(id: string): void {
    setAbierta((actual) => (actual === id ? null : id));
  }

  return (
    <div ref={raiz} className="flex flex-col gap-3 md:gap-4">
      <p className="max-w-[560px] text-body leading-relaxed text-text-2">
        Esto es lo que se le pregunta a todos los clientes cuando terminás un trabajo. Ya está
        escrita: cambiá lo que quieras o dejala como está.
      </p>

      <div
        className={`flex flex-wrap items-center gap-3 rounded-panel border px-4 py-4 md:px-5 ${FONDO_DEL_LARGO[largo.tono]}`}
      >
        <span className="flex flex-none items-center gap-2.25">
          <Icono nombre="clock" tamano={18} />
          <span className="text-subtitulo font-semibold tabular-nums">{largo.texto}</span>
        </span>
        <span className="min-w-[180px] flex-1 text-label leading-normal text-text-2">
          {largo.nota}
        </span>
        <span className="flex-none text-label text-text-2 tabular-nums">
          {vigentes.length} de {TOPE_PREGUNTAS}
        </span>
      </div>

      <div>
        <ul
          aria-label="Lo que se pregunta"
          className={
            conRenglones
              ? 'list-none rounded-panel border border-hairline bg-paper px-4'
              : 'list-none p-0'
          }
        >
          {vigentes.map((item, posicion) => {
            const { fila } = item;
            const estaAbierta = abierta === fila.id;
            return (
              <FilaDeLaPregunta
                key={fila.id}
                id={fila.id}
                texto={fila.texto}
                sinEscribir={false}
                meta={<MetaDeLaPregunta item={item} />}
                abierta={estaAbierta}
                primera={posicion === 0}
                ultima={posicion === vigentes.length - 1}
                alAbrir={() => {
                  abrir(fila.id);
                }}
                alSubir={() => {
                  moverla(posicion, 'arriba');
                }}
                alBajar={() => {
                  moverla(posicion, 'abajo');
                }}
                alArchivar={() => {
                  archivar(posicion);
                }}
              >
                {estaAbierta && (
                  <EditorDeUnaPregunta
                    pregunta={fila}
                    uso={item.uso}
                    alGuardar={(borrador, modo) => {
                      const id = cambiarPregunta(
                        cliente,
                        fila,
                        borrador,
                        modo,
                        item.uso.respuestas > 0,
                      );
                      setAbierta(null);
                      pedirFoco(claveDe(id, 'texto'));
                    }}
                    alCancelar={() => {
                      setAbierta(null);
                      pedirFoco(claveDe(fila.id, 'texto'));
                    }}
                  />
                )}
              </FilaDeLaPregunta>
            );
          })}
          {abierta === NUEVA && (
            <FilaDeLaPregunta
              id={NUEVA}
              texto="Pregunta nueva, sin escribir"
              sinEscribir
              meta={
                <span className="inline-flex items-center gap-1.5">
                  <Icono nombre={TIPO.escala5.icono} tamano={14} />
                  {TIPO.escala5.etiqueta}
                </span>
              }
              abierta
              primera
              ultima
              alAbrir={() => undefined}
              alSubir={() => undefined}
              alBajar={() => undefined}
              alArchivar={null}
            >
              <EditorDeUnaPregunta
                pregunta={null}
                uso={SIN_USO}
                enfocarAlAbrir
                alGuardar={(borrador) => {
                  const id = agregarPregunta(cliente, borrador, siguienteOrden);
                  setAbierta(null);
                  pedirFoco(claveDe(id, 'texto'));
                }}
                alCancelar={() => {
                  setAbierta(null);
                  pedirFoco(AGREGAR);
                }}
              />
            </FilaDeLaPregunta>
          )}
        </ul>

        {!conRenglones && (
          <p className="rounded-panel border border-hairline bg-paper px-4 py-4 text-body leading-relaxed text-text-2 md:px-5">
            Por ahora no le preguntás nada a nadie. Agregá una pregunta o volvé a preguntar una de
            las de abajo.
          </p>
        )}
      </div>

      <div>
        <FilaDeAcciones>
          <button
            type="button"
            data-foco={AGREGAR}
            disabled={enElTope}
            onClick={() => {
              setAbierta(NUEVA);
            }}
            className={`flex h-12 items-center justify-center gap-2 rounded-pill border border-dashed bg-transparent px-4 text-body font-medium ${
              enElTope ? 'border-hairline text-text-3' : 'border-border text-ink hover:bg-ink/5'
            }`}
          >
            <Icono nombre="plus" tamano={18} />
            Agregar una pregunta
          </button>
          <button
            type="button"
            disabled={vigentes.length === 0}
            onClick={() => {
              setPrevia(true);
            }}
            className="flex h-12 items-center justify-center gap-2 rounded-pill border border-border bg-paper px-4 text-body font-medium hover:bg-ink/5 disabled:text-text-3 disabled:hover:bg-paper"
          >
            <Icono nombre="eye" tamano={18} />
            Verla como la ve el cliente
          </button>
        </FilaDeAcciones>
        {enElTope && (
          <p className="mt-2.5 max-w-[520px] text-label leading-relaxed text-text-2">
            Llegaste a {TOPE_PREGUNTAS} preguntas. Es el largo hasta donde la gente contesta sin
            abandonar: para agregar una, sacá otra.
          </p>
        )}
      </div>

      {archivadas.length > 0 && (
        <section aria-labelledby="las-que-ya-no" className="flex flex-col gap-2">
          <div className="px-1">
            <h2 id="las-que-ya-no" className="mb-1 text-body-lg font-semibold">
              Las que ya no preguntás
            </h2>
            <p className="text-label leading-relaxed text-text-3">
              No se preguntan más, pero lo que contestaron queda guardado y se puede ver en
              Resultados.
            </p>
          </div>
          <ul className="list-none rounded-panel border border-hairline bg-paper px-4">
            {archivadas.map((item) => (
              <Archivada
                key={item.fila.id}
                item={item}
                bloqueada={enElTope}
                alVolver={() => {
                  volverAPreguntar(cliente, item.fila);
                  pedirFoco(claveDe(item.fila.id, 'texto'));
                }}
              />
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="de-un-trabajo" className="flex flex-col gap-2">
        <div className="px-1">
          <h2 id="de-un-trabajo" className="mb-1 text-body-lg font-semibold">
            Preguntas de un trabajo puntual
          </h2>
          <p className="max-w-[560px] text-label leading-relaxed text-text-3">
            Se agregan desde el trabajo, no desde acá, y se suman solo a esa encuesta. No entran en
            el promedio general: una pregunta que contestó una persona no es una estadística.
          </p>
        </div>
        {propias.length > 0 && (
          <ul className="list-none rounded-panel border border-hairline bg-paper px-4">
            {propias.map(({ fila, trabajo }) => (
              <li key={fila.id} className="border-t border-hairline-soft first:border-t-0">
                <Ir
                  a={rutaDelProyecto(trabajo.proyectoId)}
                  className="flex min-h-15 w-full items-center gap-3 py-3 text-left no-underline hover:bg-surface"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-body leading-snug">{fila.texto}</span>
                    <span className="mt-0.5 block text-label text-text-3">
                      {trabajo.cliente === ''
                        ? trabajo.trabajo
                        : `${trabajo.trabajo} — ${trabajo.cliente}`}
                    </span>
                  </span>
                  <Icono nombre="chevron-right" tamano={18} />
                </Ir>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConSalida valor={previa}>
        {() => (
          <VistaPrevia
            taller={taller}
            preguntas={vigentes.map((item) => comoLaVeElCliente(preguntaGuardada(item.fila)))}
            resena={resena === '' ? null : resena}
            alCerrar={() => {
              setPrevia(false);
            }}
          />
        )}
      </ConSalida>
    </div>
  );
}
