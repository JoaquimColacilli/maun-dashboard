import { duracion, menosDe, primeraPalabra, queTieneLaEncuesta } from '@maun/domain';
import { onlineManager, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useMemo, useState, type MouseEvent, type ReactNode } from 'react';

import {
  Carita,
  fichaDeLaRespuesta,
  MUTACION_DE_BAJA_DE_ENCUESTA,
  MUTACION_DE_ENCUESTA,
  pedidoDelTrabajo,
  type FilaDeEncuesta,
} from '@/entities/opinion';
import { useReplicaDelTaller } from '@/entities/replica';
import { mensajeDeSincronizacion, type FilaDe } from '@/shared/api';
import {
  avisarEnPantalla,
  copiar,
  diaYMes,
  enlaceDeLaEncuesta,
  haceCuanto,
  hashDelToken,
  hoyLocal,
  metaDeAvisos,
  RUTA_DE_OPINIONES,
  RUTA_DE_PREGUNTAS,
  rutaDeLaRespuesta,
  tokenNuevo,
  uuidv7,
  Ir,
} from '@/shared/lib';
import { Button, ConSalida, FilaDeAcciones, Hoja, Icono, type NombreDeIcono } from '@/shared/ui';

import {
  guardarTokenDelPedido,
  olvidarTokenDelPedido,
  recordar,
  tokenDelPedido,
} from '../model/acciones';
import { loQueVaARecibir } from '../model/encuesta';
import {
  despuesDeLaEntrega,
  mensajeDelPedido,
  mensajeDelRecordatorio,
  whatsappCon,
} from '../model/mensajes';
import { PreguntasDelTrabajo } from './PreguntasDelTrabajo';

const ESPERA_DEL_COPIADO_MS = 2200;

const SIN_SENAL =
  'Para crear el enlace de la encuesta hace falta señal. Cuando vuelva, tocá de nuevo.';

const BOTON =
  'inline-flex min-h-field items-center justify-center gap-2.25 rounded-pill px-4.5 text-body font-medium no-underline';

const PRIMARIO = `${BOTON} bg-ink text-paper hover:bg-ink-hover`;

const SECUNDARIO = `${BOTON} border border-border bg-paper text-ink hover:bg-surface`;

export interface ClienteDelPedido {
  nombre: string;
  telefono: string;
}

function Encabezado({
  id,
  icono,
  titulo,
  chip,
  bajada,
}: {
  id: string;
  icono: NombreDeIcono;
  titulo: string;
  chip: ReactNode;
  bajada: string;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 id={id} className="flex items-center gap-2.25 text-subtitulo font-semibold">
          <Icono nombre={icono} tamano={19} />
          {titulo}
        </h2>
        {chip}
      </div>
      <p className="max-w-[560px] text-body-sm leading-relaxed text-text-2">{bajada}</p>
    </>
  );
}

function useCopiado(): [boolean, (texto: string) => void] {
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!copiado) return;
    const reloj = setTimeout(() => {
      setCopiado(false);
    }, ESPERA_DEL_COPIADO_MS);
    return () => {
      clearTimeout(reloj);
    };
  }, [copiado]);

  return [
    copiado,
    (texto) => {
      void copiar(texto).then((como) => {
        if (como !== 'copiado') return;
        setCopiado(true);
        avisarEnPantalla({ clave: 'enlace-copiado', tono: 'hecho', texto: 'Enlace copiado.' });
      });
    },
  ];
}

function BotonDeCopiar({ copiado, alTocar }: { copiado: boolean; alTocar: () => void }) {
  return (
    <button type="button" onClick={alTocar} className={SECUNDARIO}>
      <Icono nombre={copiado ? 'check' : 'copy'} tamano={18} />
      {copiado ? 'Copiado' : 'Copiar el enlace'}
    </button>
  );
}

function DarDeBaja({ encuesta, nombre }: { encuesta: FilaDeEncuesta; nombre: string }) {
  const [preguntando, setPreguntando] = useState(false);
  const baja = useMutation({
    ...MUTACION_DE_BAJA_DE_ENCUESTA,
    meta: metaDeAvisos('bajaDeLaEncuesta', { errorEnPantalla: true }),
  });

  return (
    <>
      <button
        type="button"
        onClick={() => {
          baja.reset();
          setPreguntando(true);
        }}
        className="self-start text-label font-medium text-text-2 underline underline-offset-3 hover:text-ink"
      >
        Dar de baja este enlace
      </button>
      <ConSalida valor={preguntando}>
        {() => (
          <Hoja
            titulo="¿Dar de baja el enlace?"
            rol="alertdialog"
            ancho="angosto"
            alCerrar={() => {
              setPreguntando(false);
            }}
          >
            <div className="flex flex-col gap-4 px-5 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:px-6 md:pb-6">
              <p className="text-body leading-relaxed text-text-2">
                El enlace que le mandaste a {nombre} deja de andar: si lo abre, le va a decir que no
                funciona. Después podés mandarle uno nuevo desde acá.
              </p>
              {baja.isError && (
                <p role="alert" className="text-label font-medium text-alerta">
                  {onlineManager.isOnline()
                    ? mensajeDeSincronizacion(baja.error)
                    : 'Para darlo de baja hace falta señal.'}
                </p>
              )}
              <FilaDeAcciones>
                <Button
                  variant="peligro"
                  cargando={baja.isPending}
                  onClick={() => {
                    void baja
                      .mutateAsync({ encuesta, momento: new Date().toISOString() })
                      .then(() => {
                        setPreguntando(false);
                      })
                      .catch(() => undefined);
                  }}
                >
                  Dar de baja
                </Button>
                <Button
                  variant="secundario"
                  onClick={() => {
                    setPreguntando(false);
                  }}
                >
                  Cancelar
                </Button>
              </FilaDeAcciones>
            </div>
          </Hoja>
        )}
      </ConSalida>
    </>
  );
}

export interface PedirLaOpinionProps {
  proyecto: FilaDe<'proyectos'>;
  cliente: ClienteDelPedido | undefined;
}

export function PedirLaOpinion({ proyecto, cliente }: PedirLaOpinionProps) {
  const replica = useReplicaDelTaller();
  const queryClient = useQueryClient();
  const idDelBloque = useId();
  const hoy = hoyLocal();
  const [token, setToken] = useState(() => tokenDelPedido(proyecto.id));
  const [sinSenal, setSinSenal] = useState(false);
  const [copiado, copiarTexto] = useCopiado();
  const envio = useMutation({
    ...MUTACION_DE_ENCUESTA,
    meta: metaDeAvisos('encuesta', { errorEnPantalla: true, silencioso: true }),
  });

  const { pedido, encuesta, respuesta } = useMemo(
    () => pedidoDelTrabajo(replica, proyecto.id),
    [replica, proyecto.id],
  );
  const recibe = useMemo(() => loQueVaARecibir(replica, proyecto.id), [replica, proyecto.id]);
  const tipos = recibe.map((pregunta) => pregunta.tipo);
  const nombreCompleto = cliente?.nombre ?? '';
  const nombre = primeraPalabra(nombreCompleto) || 'tu cliente';
  const telefono = cliente?.telefono ?? '';

  function crearElEnlace(): void {
    guardarTokenDelPedido(proyecto.id, token);
    void hashDelToken(token)
      .then((hash) =>
        envio.mutateAsync({
          nueva: { id: uuidv7(), proyecto_id: proyecto.id, token, token_hash: hash },
          revocar: null,
          momento: new Date().toISOString(),
        }),
      )
      .then(() => {
        olvidarTokenDelPedido(proyecto.id);
        setToken(tokenNuevo());
      })
      .catch(() => undefined);
  }

  function conSenal(evento?: MouseEvent): boolean {
    if (onlineManager.isOnline()) {
      setSinSenal(false);
      return true;
    }
    evento?.preventDefault();
    setSinSenal(true);
    return false;
  }

  const pie = (
    <p className="max-w-[560px] px-1 text-label leading-relaxed text-text-3">
      La encuesta que recibe sale de{' '}
      <Ir a={RUTA_DE_PREGUNTAS} className="font-medium text-ink underline underline-offset-3">
        Opiniones › Preguntas
      </Ir>
      , más lo que agregues acá.
    </p>
  );

  if (pedido.estado === 'contestada') {
    const ficha = respuesta === undefined ? null : fichaDeLaRespuesta(replica, respuesta.id);
    return (
      <div className="flex flex-col gap-3 md:gap-4">
        <section
          aria-labelledby={idDelBloque}
          className="flex flex-col gap-3.5 rounded-panel border border-hairline bg-paper px-4 py-4 md:px-5"
        >
          <Encabezado
            id={idDelBloque}
            icono="message-square-quote"
            titulo={`${nombre} ya te contestó`}
            chip={
              <span className="rounded-pill bg-ink px-2 py-0.5 text-badge font-semibold text-paper">
                contestada
              </span>
            }
            bajada={
              ficha === null
                ? 'Contestó la encuesta.'
                : `Contestó el ${diaYMes(ficha.contestadaEl, hoy)}${despuesDeLaEntrega(
                    proyecto.fecha_entrega,
                    ficha.contestadaEl,
                  )}.`
            }
          />
          {respuesta !== undefined && (
            <Ir
              a={rutaDeLaRespuesta(respuesta.id)}
              className="flex items-start gap-3.5 rounded-field border border-hairline bg-paper p-3.5 text-left text-ink no-underline hover:border-ink"
            >
              {ficha?.titular && (
                <span className="flex-none pt-0.5">
                  <Carita paso={ficha.titular} tamano={24} />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-body font-semibold">
                  {ficha?.titular?.etiqueta ?? 'Ver lo que contestó'}
                </span>
                {ficha?.comentario !== null && ficha?.comentario !== undefined && (
                  <span className="mt-1 block text-body-sm leading-relaxed text-text-2">
                    «{ficha.comentario}»
                  </span>
                )}
              </span>
              <span aria-hidden className="flex flex-none">
                <Icono nombre="chevron-right" tamano={18} />
              </span>
            </Ir>
          )}
          <Ir a={RUTA_DE_OPINIONES} className={`${SECUNDARIO} self-start`}>
            Ver todas las opiniones
          </Ir>
        </section>
        <PreguntasDelTrabajo proyectoId={proyecto.id} nombre={nombre} situacion="contestada" />
        {pie}
      </div>
    );
  }

  if (pedido.estado !== 'sin_mandar' && encuesta !== undefined) {
    const enlace = enlaceDeLaEncuesta(encuesta.token);
    const recordada = pedido.estado === 'recordada';
    return (
      <div className="flex flex-col gap-3 md:gap-4">
        <section
          aria-labelledby={idDelBloque}
          className="flex flex-col gap-3.5 rounded-panel border border-hairline bg-paper px-4 py-4 md:px-5"
        >
          <Encabezado
            id={idDelBloque}
            icono="send"
            titulo="Le pediste la opinión"
            chip={
              <span className="rounded-pill bg-surface px-2 py-0.5 text-badge font-semibold text-text-2">
                sin contestar
              </span>
            }
            bajada="El enlace le llegó por WhatsApp. Cuando conteste, te aparece acá y en Opiniones."
          />
          <p className="flex items-center gap-1.75 text-body-sm text-text-2">
            <span aria-hidden className="size-2 flex-none rounded-pill bg-text-3" />
            Le llegó {haceCuanto(pedido.envio.enviadaEl, hoy)}, todavía no contestó
          </p>
          <FilaDeAcciones>
            {!recordada && (
              <a
                href={whatsappCon(
                  telefono,
                  mensajeDelRecordatorio(nombreCompleto, proyecto.titulo, enlace),
                )}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  recordar(queryClient, encuesta);
                }}
                className={PRIMARIO}
              >
                <Icono nombre="bell" tamano={18} />
                Recordárselo una vez
              </a>
            )}
            <BotonDeCopiar
              copiado={copiado}
              alTocar={() => {
                copiarTexto(enlace);
              }}
            />
          </FilaDeAcciones>
          <p
            className={`rounded-field px-3.5 py-3 text-label leading-relaxed text-text-2 ${
              recordada ? 'bg-atencion-tint' : 'bg-surface'
            }`}
          >
            {recordada && pedido.envio.recordadaEl !== null
              ? `Ya le recordaste una vez, el ${diaYMes(pedido.envio.recordadaEl, hoy)}. No hay un segundo recordatorio: insistirle dos veces a un cliente que te pagó molesta más de lo que suma.`
              : 'Un recordatorio y nada más. Si después de eso no contesta, quedó así y está bien.'}
          </p>
          <DarDeBaja encuesta={encuesta} nombre={nombre} />
        </section>
        <PreguntasDelTrabajo proyectoId={proyecto.id} nombre={nombre} situacion="mandada" />
        {pie}
      </div>
    );
  }

  const enlace = enlaceDeLaEncuesta(token);
  const sinPreguntas = recibe.length === 0;

  return (
    <div className="flex flex-col gap-3 md:gap-4">
      <section
        aria-labelledby={idDelBloque}
        className="flex flex-col gap-3.5 rounded-panel border border-ink bg-paper px-4 py-4 md:px-5"
      >
        <Encabezado
          id={idDelBloque}
          icono="message-square-plus"
          titulo={`Pedile la opinión a ${nombre}`}
          chip={null}
          bajada={
            sinPreguntas
              ? 'La encuesta no tiene ninguna pregunta todavía. Agregá alguna en Opiniones › Preguntas antes de pedirla.'
              : `${queTieneLaEncuesta(tipos)}. Le llega un enlace, lo abre sin cuenta y te contesta en ${menosDe(duracion(tipos).segundos)}.`
          }
        />
        {!sinPreguntas && (
          <FilaDeAcciones>
            <a
              href={whatsappCon(
                telefono,
                mensajeDelPedido(nombreCompleto, proyecto.titulo, enlace),
              )}
              target="_blank"
              rel="noopener noreferrer"
              aria-busy={envio.isPending || undefined}
              onClick={(evento) => {
                if (conSenal(evento)) crearElEnlace();
              }}
              className={PRIMARIO}
            >
              <Icono nombre="message-circle" tamano={18} />
              Pedírsela por WhatsApp
            </a>
            <BotonDeCopiar
              copiado={copiado}
              alTocar={() => {
                if (!conSenal()) return;
                crearElEnlace();
                copiarTexto(enlace);
              }}
            />
          </FilaDeAcciones>
        )}
        {sinSenal && (
          <p role="alert" className="text-label font-medium text-alerta">
            {SIN_SENAL}
          </p>
        )}
        {envio.isError && !sinSenal && (
          <div role="alert" className="flex flex-col items-start gap-2 text-label text-alerta">
            <p className="font-medium">
              No se pudo crear el enlace. {mensajeDeSincronizacion(envio.error)} Si ya le mandaste
              el mensaje, tocá «Reintentar»: el enlace que le llegó empieza a andar sin mandarle
              nada de nuevo.
            </p>
            <Button
              variant="secundario"
              size="chico"
              onClick={() => {
                if (conSenal()) crearElEnlace();
              }}
            >
              Reintentar
            </Button>
          </div>
        )}
        {!sinPreguntas && (
          <p className="rounded-field bg-surface px-3.5 py-3 text-label leading-relaxed text-text-2">
            Lo que se pide el mismo día que entregás se contesta bastante más que lo mismo pedido
            una semana después. Si podés, mandásela ahora.
          </p>
        )}
      </section>
      <PreguntasDelTrabajo proyectoId={proyecto.id} nombre={nombre} situacion="abiertas" />
      {pie}
    </div>
  );
}
