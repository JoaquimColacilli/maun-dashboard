import {
  revisarBorrador,
  TIPOS_DE_PREGUNTA_PROPIA,
  TOPE_PROPIAS,
  type TipoDePreguntaPropia,
} from '@maun/domain';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';

import { preguntaGuardada, TIPO } from '@/entities/opinion';
import { useReplicaDelTaller } from '@/entities/replica';
import { filasDe } from '@/shared/api';
import { useAlgoEnCurso } from '@/shared/lib';
import { Button, FilaDeAcciones, Icono } from '@/shared/ui';

import { agregarPropia, sacarPropia } from '../model/acciones';
import { siguienteOrdenDePropia } from '../model/encuesta';

export type SituacionDeLasPropias = 'abiertas' | 'mandada' | 'contestada';

const MENSAJE_DEL_TEXTO = {
  'sin-texto': 'Escribí la pregunta.',
  'texto-largo': 'La pregunta es muy larga: tiene que entrar en 300 letras.',
} as const;

function cuantas(n: number): string {
  return n === 0 ? 'ninguna todavía' : `${String(n)} de ${String(TOPE_PROPIAS)}`;
}

export function PreguntasDelTrabajo({
  proyectoId,
  nombre,
  situacion,
}: {
  proyectoId: string;
  nombre: string;
  situacion: SituacionDeLasPropias;
}) {
  const replica = useReplicaDelTaller();
  const cliente = useQueryClient();
  const id = useId();
  const [agregando, setAgregando] = useState(false);
  const [texto, setTexto] = useState('');
  const [tipo, setTipo] = useState<TipoDePreguntaPropia>('escala5');
  const [problema, setProblema] = useState<keyof typeof MENSAJE_DEL_TEXTO | null>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  useAlgoEnCurso(agregando && texto.trim() !== '');

  const propias = filasDe(replica, 'preguntas')
    .filter((fila) => fila.proyecto_id === proyectoId)
    .sort((a, b) => a.orden - b.orden);
  const abiertas = situacion !== 'contestada';

  useEffect(() => {
    if (agregando) campo.current?.focus();
  }, [agregando]);

  function cerrar(): void {
    setAgregando(false);
    setTexto('');
    setTipo('escala5');
    setProblema(null);
  }

  function agregar(): void {
    const encontrado = revisarBorrador({
      texto,
      tipo,
      escala: null,
      obligatoria: false,
      opciones: null,
    });
    if (encontrado === 'sin-texto' || encontrado === 'texto-largo') {
      setProblema(encontrado);
      campo.current?.focus();
      return;
    }
    agregarPropia(
      cliente,
      proyectoId,
      { texto, tipo },
      siguienteOrdenDePropia(propias.map(preguntaGuardada)),
    );
    cerrar();
  }

  return (
    <section
      aria-labelledby={`${id}-titulo`}
      className="rounded-panel border border-hairline bg-paper px-4 py-4 md:px-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2.5">
        <h2 id={`${id}-titulo`} className="text-body-lg font-semibold">
          Algo puntual de este trabajo
        </h2>
        <span className="text-label text-text-3">{cuantas(propias.length)}</span>
      </div>
      <p className="mt-1.5 mb-3 max-w-[560px] text-body-sm leading-relaxed text-text-2">
        Se suma solo a la encuesta de este cliente. No entra en el promedio general.
      </p>

      {propias.length > 0 && (
        <ul className="list-none p-0">
          {propias.map((propia) => (
            <li
              key={propia.id}
              className="flex items-start gap-3 border-t border-hairline-soft py-3.25"
            >
              <span className="flex size-8 flex-none items-center justify-center rounded-field bg-surface">
                <Icono nombre={TIPO[propia.tipo].icono} tamano={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-body leading-snug">{propia.texto}</span>
                <span className="mt-0.5 block text-label text-text-3">
                  {TIPO[propia.tipo].etiqueta}
                </span>
              </span>
              {abiertas && (
                <button
                  type="button"
                  aria-label={`Sacar la pregunta «${propia.texto}»`}
                  onClick={() => {
                    sacarPropia(cliente, propia);
                  }}
                  className="flex size-9.5 flex-none items-center justify-center rounded-pill text-text-3 hover:bg-surface hover:text-alerta"
                >
                  <Icono nombre="x" tamano={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {abiertas && agregando && (
        <div className="mt-3.5 flex flex-col gap-3.5 rounded-field border border-border p-4">
          <div className="flex flex-col gap-1.75 text-label text-text-2">
            <label htmlFor={`${id}-texto`}>Qué le querés preguntar a {nombre}</label>
            <textarea
              ref={campo}
              id={`${id}-texto`}
              value={texto}
              rows={2}
              placeholder="¿La altura de la alacena te quedó cómoda?"
              aria-invalid={problema !== null || undefined}
              aria-describedby={problema === null ? undefined : `${id}-error`}
              onChange={(evento) => {
                setTexto(evento.target.value);
                setProblema(null);
              }}
              className={`resize-y rounded-field border bg-paper px-3 py-2.5 text-body-lg leading-normal text-ink placeholder:text-text-3 focus:border-ink ${
                problema === null ? 'border-border' : 'border-alerta'
              }`}
            />
            {problema !== null && (
              <span id={`${id}-error`} role="alert" className="font-medium text-alerta">
                {MENSAJE_DEL_TEXTO[problema]}
              </span>
            )}
          </div>
          <fieldset className="m-0 flex min-w-0 flex-col gap-1.75 border-0 p-0">
            <legend className="mb-1.75 p-0 text-label text-text-2">Cómo contesta</legend>
            <div className="flex flex-wrap gap-2">
              {TIPOS_DE_PREGUNTA_PROPIA.map((opcion) => {
                const elegida = tipo === opcion;
                return (
                  <label
                    key={opcion}
                    className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-field border px-3.5 text-body-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink ${
                      elegida
                        ? 'border-ink bg-surface font-semibold'
                        : 'border-border bg-paper font-medium'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`${id}-tipo`}
                      value={opcion}
                      checked={elegida}
                      onChange={() => {
                        setTipo(opcion);
                      }}
                      className="sr-only"
                    />
                    <Icono nombre={TIPO[opcion].icono} tamano={16} />
                    {TIPO[opcion].etiqueta}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <FilaDeAcciones>
            <Button onClick={agregar}>Agregarla a esta encuesta</Button>
            <Button variant="secundario" onClick={cerrar}>
              Cancelar
            </Button>
          </FilaDeAcciones>
        </div>
      )}

      {abiertas && !agregando && propias.length < TOPE_PROPIAS && (
        <button
          type="button"
          onClick={() => {
            setAgregando(true);
          }}
          className="mt-3.5 flex h-12 items-center gap-2 rounded-pill border border-dashed border-border bg-transparent px-4 text-body font-medium hover:bg-surface"
        >
          <Icono nombre="plus" tamano={18} />
          Agregar una pregunta para este trabajo
        </button>
      )}

      {situacion === 'contestada' && (
        <p className="mt-3.5 max-w-[520px] text-label leading-relaxed text-text-2">
          {nombre} ya contestó, así que estas preguntas quedan como están. Para preguntarle algo
          nuevo, escribile.
        </p>
      )}
    </section>
  );
}
