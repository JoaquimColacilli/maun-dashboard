import {
  armarRespuesta,
  faltantes,
  LARGO_MAXIMO_DE_LA_RESPUESTA,
  pasosDe,
  primeraPalabra,
  type Paso,
  type PreguntaDeLaEncuesta,
  type RespuestaDelFormulario,
  type ValorDelFormulario,
} from '@maun/domain';
import { useId, useRef, useState, type ReactNode, type SyntheticEvent } from 'react';

import {
  ESCENA_EN_LA_LAMINA,
  Icono,
  Ilustracion,
  TarjetaConLamina,
  TITULO_DE_LAMINA,
} from '@/shared/ui';

import { colorDelPaso, ICONO_DE_LA_CARA } from '../model/polos';
import {
  AVISO_DE_FIRMA,
  AYUDA_DEL_COMENTARIO,
  bajadaDeLaEncuesta,
  faltanPreguntas,
  tituloDeLaEncuesta,
} from '../model/textos';

export function MarcaDelTaller({ taller, conLema = false }: { taller: string; conLema?: boolean }) {
  return (
    <span className="flex items-baseline gap-2.25">
      <span className={`font-display text-firma ${conLema ? '' : 'text-text-2'}`}>{taller}</span>
      {conLema && <span className="text-meta text-text-3">Muebles a medida</span>}
    </span>
  );
}

function marcoDeLaOpcion(elegida: boolean): string {
  return `relative flex cursor-pointer rounded-field border-[1.5px] bg-paper transition-colors duration-(--dur-fast) has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink ${
    elegida ? 'border-ink' : 'border-border hover:border-text-3'
  }`;
}

interface ControlProps {
  pregunta: PreguntaDeLaEncuesta;
  valor: ValorDelFormulario | undefined;
  nombre: string;
  descripcion: string | undefined;
  alCambiar: (valor: ValorDelFormulario) => void;
  primerControl: (elemento: HTMLInputElement | HTMLTextAreaElement | null) => void;
}

function Escala({ pregunta, valor, nombre, descripcion, alCambiar, primerControl }: ControlProps) {
  return (
    <div className="grid grid-cols-5 gap-1.25 @lg:gap-2">
      {pasosDe(pregunta).map((paso, indice) => {
        const elegida = valor === paso.valor;
        return (
          <label
            key={paso.valor}
            className={`${marcoDeLaOpcion(elegida)} min-h-19 flex-col items-center justify-center gap-1.75 px-0.5 pt-2.5 pb-2.25 @lg:min-h-21`}
          >
            <input
              ref={indice === 0 ? primerControl : undefined}
              type="radio"
              name={nombre}
              value={paso.valor}
              checked={elegida}
              aria-describedby={descripcion}
              onChange={() => {
                alCambiar(paso.valor);
              }}
              className="sr-only"
            />
            {paso.cara !== null && (
              <span className={elegida ? colorDelPaso(paso) : 'text-text-3'}>
                <Icono nombre={ICONO_DE_LA_CARA[paso.cara]} tamano={elegida ? 30 : 26} />
              </span>
            )}
            <span
              className={`text-center text-badge leading-tight ${
                elegida ? 'font-semibold text-ink' : 'text-text-2'
              }`}
            >
              {paso.corta}
            </span>
          </label>
        );
      })}
    </div>
  );
}

function Punto({ elegida, cuadrado }: { elegida: boolean; cuadrado: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex size-5.5 flex-none items-center justify-center border-[1.5px] ${
        cuadrado ? 'rounded-[4px]' : 'rounded-pill'
      } ${elegida ? 'border-ink' : 'border-border'} ${cuadrado && elegida ? 'bg-ink text-paper' : ''}`}
    >
      {cuadrado
        ? elegida && <Icono nombre="check" tamano={14} grosor={2.5} />
        : elegida && <span className="size-2.75 rounded-pill bg-ink" />}
    </span>
  );
}

function Botones({ pregunta, valor, nombre, descripcion, alCambiar, primerControl }: ControlProps) {
  const varias = pregunta.tipo === 'varias';
  const elegidas: readonly number[] = Array.isArray(valor) ? valor : [];
  return (
    <div className="flex flex-col gap-2.25">
      {pasosDe(pregunta).map((paso: Paso, indice) => {
        const elegida = varias ? elegidas.includes(paso.valor) : valor === paso.valor;
        return (
          <label
            key={paso.valor}
            className={`${marcoDeLaOpcion(elegida)} min-h-14.5 items-center gap-3 px-4 py-3 text-left text-body-lg ${
              elegida ? 'font-semibold' : ''
            }`}
          >
            <input
              ref={indice === 0 ? primerControl : undefined}
              type={varias ? 'checkbox' : 'radio'}
              name={nombre}
              value={paso.valor}
              checked={elegida}
              aria-describedby={descripcion}
              onChange={() => {
                if (!varias) {
                  alCambiar(paso.valor);
                  return;
                }
                alCambiar(
                  elegida
                    ? elegidas.filter((otra) => otra !== paso.valor)
                    : [...elegidas, paso.valor].sort((a, b) => a - b),
                );
              }}
              className="sr-only"
            />
            <Punto elegida={elegida} cuadrado={varias} />
            {paso.etiqueta}
          </label>
        );
      })}
    </div>
  );
}

function Comentario({
  valor,
  descripcion,
  alCambiar,
  primerControl,
  etiqueta,
}: Omit<ControlProps, 'pregunta' | 'nombre'> & { etiqueta: string }) {
  return (
    <textarea
      ref={primerControl}
      value={typeof valor === 'string' ? valor : ''}
      rows={4}
      maxLength={LARGO_MAXIMO_DE_LA_RESPUESTA}
      aria-labelledby={etiqueta}
      aria-describedby={descripcion}
      placeholder="Lo que se te ocurra. Si no, dejalo vacío y mandá igual."
      onChange={(evento) => {
        alCambiar(evento.target.value);
      }}
      className="papel-rayado w-full resize-y rounded-field border-[1.5px] border-border bg-position-[0_11px] px-3.5 py-3 text-body-lg leading-7 text-ink placeholder:text-text-3 focus:border-ink"
    />
  );
}

interface PreguntaDelFormularioProps {
  pregunta: PreguntaDeLaEncuesta;
  valor: ValorDelFormulario | undefined;
  falta: boolean;
  alCambiar: (valor: ValorDelFormulario) => void;
  primerControl: (elemento: HTMLInputElement | HTMLTextAreaElement | null) => void;
}

function PreguntaDelFormulario({
  pregunta,
  valor,
  falta,
  alCambiar,
  primerControl,
}: PreguntaDelFormularioProps) {
  const id = useId();
  const idDelTexto = `${id}-texto`;
  const idDeLaAyuda = `${id}-ayuda`;
  const idDelError = `${id}-error`;
  const esTexto = pregunta.tipo === 'texto';
  const ayuda = esTexto && !pregunta.obligatoria ? AYUDA_DEL_COMENTARIO : null;
  const descripcion =
    [ayuda === null ? null : idDeLaAyuda, falta ? idDelError : null]
      .filter((parte) => parte !== null)
      .join(' ') || undefined;
  const props: ControlProps = {
    pregunta,
    valor,
    nombre: id,
    descripcion,
    alCambiar,
    primerControl,
  };

  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="mb-3 flex flex-col gap-0.75 p-0">
        <span
          id={idDelTexto}
          className="text-subtitulo leading-snug font-semibold text-pretty @lg:text-subtitulo-lg"
        >
          {pregunta.texto}
        </span>
        {ayuda !== null && (
          <span id={idDeLaAyuda} className="text-label font-normal text-text-3">
            {ayuda}
          </span>
        )}
        {falta && (
          <span id={idDelError} className="text-label font-medium text-alerta">
            {esTexto
              ? 'Falta esta. Escribí algo para seguir.'
              : 'Falta esta. Tocá una opción para seguir.'}
          </span>
        )}
      </legend>
      {pregunta.tipo === 'escala5' && <Escala {...props} />}
      {(pregunta.tipo === 'sitalvezno' ||
        pregunta.tipo === 'una' ||
        pregunta.tipo === 'varias') && <Botones {...props} />}
      {esTexto && <Comentario {...props} etiqueta={idDelTexto} />}
    </fieldset>
  );
}

export interface FormularioDeLaEncuestaProps {
  taller: string;
  trabajo: string;
  preguntas: readonly PreguntaDeLaEncuesta[];
  idDeLaRespuesta: string;
  alMandar: (respuesta: RespuestaDelFormulario) => Promise<string | null>;
  arriba?: ReactNode;
}

export function FormularioDeLaEncuesta({
  taller,
  trabajo,
  preguntas,
  idDeLaRespuesta,
  alMandar,
  arriba,
}: FormularioDeLaEncuestaProps) {
  const [valores, setValores] = useState<Record<string, ValorDelFormulario | undefined>>({});
  const [conFalta, setConFalta] = useState<readonly string[]>([]);
  const [errorGeneral, setErrorGeneral] = useState('');
  const [enviando, setEnviando] = useState(false);
  const controles = useRef(new Map<string, HTMLInputElement | HTMLTextAreaElement>());

  function cambiar(id: string, valor: ValorDelFormulario): void {
    setValores((previos) => ({ ...previos, [id]: valor }));
    setConFalta((previas) => previas.filter((otra) => otra !== id));
    setErrorGeneral('');
  }

  async function mandar(evento: SyntheticEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault();
    if (enviando) return;
    const faltan = faltantes(preguntas, valores);
    if (faltan.length > 0) {
      setConFalta(faltan);
      setErrorGeneral(faltanPreguntas(faltan.length));
      controles.current.get(faltan[0] ?? '')?.focus();
      return;
    }
    setEnviando(true);
    const problema = await alMandar(armarRespuesta(idDeLaRespuesta, preguntas, valores));
    setEnviando(false);
    if (problema !== null) setErrorGeneral(problema);
  }

  return (
    <div className="@container w-full">
      <div className="mx-auto w-full max-w-[560px] px-5 pt-5.5 pb-11 @lg:px-7 @lg:pt-10 @lg:pb-14">
        {arriba}
        <header className="flex flex-col gap-0.75">
          <MarcaDelTaller taller={taller} conLema />
        </header>

        <h1 className="mt-4.5 font-display text-h1 leading-tight font-normal tracking-[-0.01em] text-pretty @lg:text-h1-lg">
          {tituloDeLaEncuesta(trabajo)}
        </h1>
        <p className="mt-2.5 text-body-lg leading-relaxed text-text-2">
          {bajadaDeLaEncuesta(preguntas)}
        </p>
        <p className="mt-3 text-label leading-relaxed text-text-3">{AVISO_DE_FIRMA}</p>

        <form
          noValidate
          aria-label="Encuesta"
          onSubmit={(evento) => {
            void mandar(evento);
          }}
          className="mt-6.5 flex flex-col gap-7.5"
        >
          {preguntas.map((pregunta) => (
            <PreguntaDelFormulario
              key={pregunta.id}
              pregunta={pregunta}
              valor={valores[pregunta.id]}
              falta={conFalta.includes(pregunta.id)}
              alCambiar={(valor) => {
                cambiar(pregunta.id, valor);
              }}
              primerControl={(elemento) => {
                if (elemento) controles.current.set(pregunta.id, elemento);
                else controles.current.delete(pregunta.id);
              }}
            />
          ))}

          <div className="flex flex-col gap-3">
            {errorGeneral !== '' && (
              <div
                role="alert"
                className="flex items-start gap-2.25 rounded-panel bg-alerta-tint px-3.5 py-3 text-body-sm leading-normal text-ink"
              >
                <span className="mt-0.5 flex-none text-alerta">
                  <Icono nombre="triangle-alert" tamano={17} />
                </span>
                <span>{errorGeneral}</span>
              </div>
            )}
            <button
              type="submit"
              aria-disabled={enviando}
              className={`flex min-h-14 w-full items-center justify-center gap-2.5 rounded-pill bg-ink text-subtitulo font-medium text-paper ${
                enviando ? 'opacity-70' : 'hover:bg-ink-hover'
              }`}
            >
              {enviando && (
                <span className="animate-maun-spin">
                  <Icono nombre="loader-circle" tamano={18} />
                </span>
              )}
              {enviando ? 'Mandando…' : 'Mandar mi opinión'}
            </button>
            <p className="text-center text-label leading-relaxed text-text-3">
              Se manda una sola vez y no se puede editar después.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

export interface GraciasPorContestarProps {
  taller: string;
  cliente: string | null;
  resena: string | null;
}

export function GraciasPorContestar({ taller, cliente, resena }: GraciasPorContestarProps) {
  const nombre = cliente === null ? '' : primeraPalabra(cliente);
  return (
    <div className="@container w-full">
      <div className="mx-auto flex w-full max-w-[520px] flex-col gap-3 px-5 pt-5.5 pb-11 @lg:px-7 @lg:pt-10 @lg:pb-14">
        <MarcaDelTaller taller={taller} />
        <TarjetaConLamina
          como="div"
          dibujo={<Ilustracion nombre="gracias" animar />}
          lamina={ESCENA_EN_LA_LAMINA}
          className="mt-1"
        >
          <h1 className={TITULO_DE_LAMINA}>{nombre === '' ? 'Gracias' : `Gracias, ${nombre}`}</h1>
          <p className="text-body-lg leading-relaxed text-text-2">
            Lo leemos nosotros, no un sistema. Lo que nos marcaste nos sirve para el próximo mueble.
          </p>
        </TarjetaConLamina>
        {resena !== null && (
          <div className="flex w-full flex-col gap-2.5 rounded-panel border border-hairline bg-paper px-4 py-4">
            <span className="text-body font-semibold">¿Nos dejás la misma reseña en Google?</span>
            <span className="text-body-sm leading-relaxed text-text-2">
              Se lo pedimos a todos los clientes, contesten lo que contesten. A un taller chico le
              cambia bastante.
            </span>
            <a
              href={resena}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-12 w-fit items-center gap-2 rounded-pill border border-border px-4.5 text-body font-medium no-underline hover:bg-surface"
            >
              <Icono nombre="star" tamano={17} />
              Dejar una reseña
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
