import {
  armarRespuestaDeEntrega,
  FRANJAS_DE_ENTREGA,
  LARGO_MAXIMO_DE_LA_NOTA,
  validarRespuestaDeEntrega,
  type DiaElegido,
  type FranjaDeEntrega,
  type RespuestaDeEntrega,
  type RespuestaDeEntregaParaMandar,
  type RespuestaDelCliente,
} from '@maun/domain';
import { useId, useRef, useState } from 'react';

import { diaDeLaSemana, INICIALES_DE_LA_SEMANA, nombreDelMes, uuidv7 } from '@/shared/lib';
import { Button, Icono } from '@/shared/ui';

import {
  conElDia,
  conLaFranja,
  diasQueSiguenSirviendo,
  estaElegido,
  llegoAlMaximo,
  mesesDelCalendario,
} from '../model/calendario';
import {
  ACA_NO_SE_GUARDA_NADA,
  anuncioDeLoMandado,
  CAMBIO_EL_PEDIDO,
  COORDINEMOS_LA_ENTREGA,
  fechaConFranja,
  LA_NOTA_MANDADA,
  LLEGASTE_AL_MAXIMO,
  loQueVeConElDiaAceptado,
  LOS_DIAS_MANDADOS,
  MOTIVO_DE_LA_ENTREGA,
  QUEDO_CONFIRMADA,
  textoDelDiaElegido,
  YA_ESTABA_CONFIRMADA,
} from '../model/textos';
import type { CoordinacionConPedido, MandarLaEntrega } from '../model/mandar';

export interface CoordinarLaEntregaProps {
  coordinacion: CoordinacionConPedido;
  hoy: string;
  alMandar?: MandarLaEntrega;
  alAnunciar: (texto: string) => void;
}

type Modo = 'propuesta' | 'calendario' | 'mandados';

const TARJETA = 'rounded-panel border border-hairline bg-paper px-4 py-4 md:px-5';

const DIAS_COMPLETOS = [
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
  'domingo',
] as const;

const PARA_LA_FRANJA: Readonly<Record<FranjaDeEntrega, string>> = {
  manana: 'A la mañana',
  tarde: 'A la tarde',
};

function diaParaLeer(fecha: string): string {
  const dia = DIAS_COMPLETOS[diaDeLaSemana(fecha)] ?? '';
  const mes = nombreDelMes(fecha.slice(0, 7)).toLowerCase();
  return `${dia} ${String(Number(fecha.slice(8, 10)))} de ${mes}`;
}

function modoInicial(coordinacion: CoordinacionConPedido): Modo {
  if (coordinacion.respuesta !== null) return 'mandados';
  return coordinacion.situacion === 'sus-dias' ? 'calendario' : 'propuesta';
}

function enfocar(elemento: HTMLElement | null): void {
  if (elemento === null) return;
  elemento.tabIndex = -1;
  elemento.focus();
}

function Calendario({
  hoy,
  elegidos,
  alTocar,
}: {
  hoy: string;
  elegidos: readonly DiaElegido[];
  alTocar: (fecha: string) => void;
}) {
  const base = useId();
  const lleno = llegoAlMaximo(elegidos);
  return (
    <div className="flex flex-col gap-4">
      {mesesDelCalendario(hoy).map(({ mes, semanas }) => (
        <div key={mes} role="group" aria-labelledby={`${base}-${mes}`}>
          <h3 id={`${base}-${mes}`} className="mb-2 text-body font-semibold">
            {nombreDelMes(mes)}
          </h3>
          <div aria-hidden className="mb-1 grid grid-cols-7 gap-0.5">
            {INICIALES_DE_LA_SEMANA.map((inicial, puesto) => (
              <span
                key={`${inicial}-${String(puesto)}`}
                className="text-center text-meta font-medium text-text-3 uppercase"
              >
                {inicial}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {semanas.flat().map((celda) => {
              if (celda.fuera) return <span key={celda.fecha} aria-hidden />;
              const numero = String(Number(celda.fecha.slice(8, 10)));
              if (!celda.sePuede) {
                return (
                  <span
                    key={celda.fecha}
                    aria-hidden
                    className="flex h-11 items-center justify-center text-body text-text-3 tabular-nums"
                  >
                    {numero}
                  </span>
                );
              }
              const elegido = estaElegido(elegidos, celda.fecha);
              const apagado = lleno && !elegido;
              return (
                <button
                  key={celda.fecha}
                  type="button"
                  aria-pressed={elegido}
                  aria-label={diaParaLeer(celda.fecha)}
                  disabled={apagado}
                  onClick={() => {
                    alTocar(celda.fecha);
                  }}
                  className={`flex h-11 w-full min-w-0 items-center justify-center rounded-field text-body tabular-nums transition-colors duration-(--dur-fast) ${
                    elegido
                      ? 'bg-ink font-semibold text-paper'
                      : apagado
                        ? 'cursor-not-allowed border border-hairline-soft text-text-3'
                        : 'border border-hairline bg-paper text-ink hover:border-ink'
                  }`}
                >
                  {numero}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function LosDiasElegidos({
  elegidos,
  alCambiarLaFranja,
  alSacar,
}: {
  elegidos: readonly DiaElegido[];
  alCambiarLaFranja: (fecha: string, franja: FranjaDeEntrega) => void;
  alSacar: (fecha: string) => void;
}) {
  if (elegidos.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-body font-semibold">Tus días</h3>
      <ul className="list-none">
        {elegidos.map((dia) => {
          const leido = diaParaLeer(dia.fecha);
          return (
            <li
              key={dia.fecha}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-hairline-soft py-2.5"
            >
              <span className="min-w-0 flex-1 basis-40 text-body font-medium first-letter:uppercase">
                {leido}
              </span>
              <span role="group" aria-label={`Horario del ${leido}`} className="flex gap-1.5">
                {FRANJAS_DE_ENTREGA.map((franja) => {
                  const marcada = dia.franjas.includes(franja);
                  return (
                    <button
                      key={franja}
                      type="button"
                      aria-pressed={marcada}
                      onClick={() => {
                        alCambiarLaFranja(dia.fecha, franja);
                      }}
                      className={`min-h-tap rounded-pill border px-3.5 text-label font-medium transition-colors duration-(--dur-fast) ${
                        marcada
                          ? 'border-ink bg-ink text-paper'
                          : 'border-border bg-paper text-ink hover:bg-surface'
                      }`}
                    >
                      {PARA_LA_FRANJA[franja]}
                    </button>
                  );
                })}
              </span>
              <Button
                variant="herramienta"
                size="herramienta"
                aria-label={`Sacar el ${leido}`}
                title="Sacar este día"
                onClick={() => {
                  alSacar(dia.fecha);
                }}
              >
                <Icono nombre="x" tamano={16} />
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function LoQueMandaste({
  respuesta,
  hoy,
  enLaPrueba,
}: {
  respuesta: RespuestaDelCliente;
  hoy: string;
  enLaPrueba: string | null;
}) {
  if (respuesta.respuesta === 'me_queda_bien') {
    return (
      <p className="mt-1 text-body leading-relaxed text-text-2">{enLaPrueba ?? QUEDO_CONFIRMADA}</p>
    );
  }
  return (
    <>
      <p className="mt-1 text-body leading-relaxed text-text-2">
        {respuesta.dias.length === 0 ? LA_NOTA_MANDADA : LOS_DIAS_MANDADOS}
      </p>
      {respuesta.dias.length > 0 && (
        <ul className="mt-2.5 list-none">
          {respuesta.dias.map((dia) => (
            <li
              key={dia.fecha}
              className="border-t border-hairline-soft py-2 text-body font-medium tabular-nums first-letter:uppercase"
            >
              {textoDelDiaElegido(dia, hoy)}
            </li>
          ))}
        </ul>
      )}
      {respuesta.nota.trim() !== '' && (
        <p className="mt-2.5 rounded-field bg-surface-3 px-3.5 py-2.5 text-body leading-relaxed whitespace-pre-line">
          {respuesta.nota}
        </p>
      )}
    </>
  );
}

export function CoordinarLaEntrega({
  coordinacion,
  hoy,
  alMandar,
  alAnunciar,
}: CoordinarLaEntregaProps) {
  const base = useId();
  const titulo = useRef<HTMLHeadingElement>(null);
  const instrucciones = useRef<HTMLParagraphElement>(null);
  const [modo, setModo] = useState<Modo>(() => modoInicial(coordinacion));
  const [elegidos, setElegidos] = useState<DiaElegido[]>(() =>
    diasQueSiguenSirviendo(coordinacion.respuesta?.dias ?? [], hoy),
  );
  const [nota, setNota] = useState(() => coordinacion.respuesta?.nota ?? '');
  const [mandada, setMandada] = useState<RespuestaDelCliente | null>(coordinacion.respuesta);
  const [idDeLaRespuesta, setIdDeLaRespuesta] = useState(uuidv7);
  const [mandando, setMandando] = useState(false);
  const [error, setError] = useState('');
  const { propuesta } = coordinacion;
  const esPrueba = alMandar === undefined;

  function abrirElCalendario(): void {
    setError('');
    setModo('calendario');
    requestAnimationFrame(() => {
      enfocar(instrucciones.current);
    });
  }

  function volverALaPropuesta(): void {
    setError('');
    setMandada(coordinacion.respuesta);
    setModo('propuesta');
    requestAnimationFrame(() => {
      enfocar(titulo.current);
    });
  }

  function dejarComoEstaban(anterior: RespuestaDelCliente): void {
    setError('');
    setElegidos(diasQueSiguenSirviendo(anterior.dias, hoy));
    setNota(anterior.nota);
    setModo('mandados');
    requestAnimationFrame(() => {
      enfocar(titulo.current);
    });
  }

  function quedoMandada(armada: RespuestaDeEntregaParaMandar): void {
    setMandada({ respuesta: armada.respuesta, dias: armada.dias, nota: armada.nota });
    setIdDeLaRespuesta(uuidv7());
    setModo('mandados');
    alAnunciar(anuncioDeLoMandado(armada, propuesta, hoy));
    requestAnimationFrame(() => {
      enfocar(titulo.current);
    });
  }

  async function mandar(respuesta: RespuestaDeEntrega): Promise<void> {
    if (mandando) return;
    setError('');
    const armada = armarRespuestaDeEntrega(
      idDeLaRespuesta,
      propuesta.id,
      respuesta,
      elegidos,
      nota,
    );
    const motivo = validarRespuestaDeEntrega(armada, propuesta.forma, hoy);
    if (motivo !== null) {
      setError(MOTIVO_DE_LA_ENTREGA[motivo]);
      return;
    }
    if (alMandar === undefined) {
      quedoMandada(armada);
      return;
    }
    setMandando(true);
    const resultado = await alMandar(armada);
    setMandando(false);
    switch (resultado.tipo) {
      case 'guardada':
        quedoMandada(armada);
        return;
      case 'ya-confirmada':
        alAnunciar(YA_ESTABA_CONFIRMADA);
        return;
      case 'cambio':
        alAnunciar(CAMBIO_EL_PEDIDO);
        return;
      case 'error':
        setError(resultado.texto);
    }
  }

  const pie = (
    <>
      {error !== '' && (
        <p role="alert" className="mt-3 text-body leading-relaxed font-medium text-alerta">
          {error}
        </p>
      )}
      {esPrueba && (
        <p className="mt-3 text-label leading-relaxed text-text-3">{ACA_NO_SE_GUARDA_NADA}</p>
      )}
    </>
  );

  return (
    <section aria-labelledby={`${base}-titulo`} className={TARJETA}>
      <h2 id={`${base}-titulo`} ref={titulo} className="text-section font-semibold">
        {COORDINEMOS_LA_ENTREGA}
      </h2>

      {modo === 'propuesta' && coordinacion.situacion === 'un-dia' && (
        <>
          <p className="mt-1 text-body leading-relaxed text-text-2">Te proponemos este día:</p>
          <p className="mt-2 text-body-lg font-semibold first-letter:uppercase">
            {fechaConFranja(coordinacion.propuesta.fecha, coordinacion.propuesta.franja, hoy)}
          </p>
          <div className="mt-4 flex flex-col gap-2 min-[26rem]:flex-row">
            <Button
              cargando={mandando}
              onClick={() => {
                void mandar('me_queda_bien');
              }}
            >
              {mandando ? 'Mandando…' : 'Me queda bien'}
            </Button>
            <Button variant="secundario" disabled={mandando} onClick={abrirElCalendario}>
              No puedo ese día
            </Button>
          </div>
          {pie}
        </>
      )}

      {modo === 'calendario' && (
        <>
          <p ref={instrucciones} className="mt-1 text-body leading-relaxed text-text-2">
            {coordinacion.situacion === 'un-dia'
              ? 'Marcá los días que te quedan bien y si es a la mañana, a la tarde o las dos. Entregamos de lunes a sábado.'
              : 'Para coordinar la entrega, marcá los días que te quedan bien y si es a la mañana, a la tarde o las dos. Entregamos de lunes a sábado.'}
          </p>
          <div className="mt-4 flex flex-col gap-4">
            <Calendario
              hoy={hoy}
              elegidos={elegidos}
              alTocar={(fecha) => {
                setError('');
                setElegidos((actuales) => conElDia(actuales, fecha));
              }}
            />
            {llegoAlMaximo(elegidos) && (
              <p className="text-label leading-relaxed text-text-2">{LLEGASTE_AL_MAXIMO}</p>
            )}
            <LosDiasElegidos
              elegidos={elegidos}
              alCambiarLaFranja={(fecha, franja) => {
                setElegidos((actuales) => conLaFranja(actuales, fecha, franja));
              }}
              alSacar={(fecha) => {
                setElegidos((actuales) => conElDia(actuales, fecha));
              }}
            />
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${base}-nota`} className="text-body font-semibold">
                ¿Algo que tengamos que saber?
              </label>
              <span id={`${base}-ayuda`} className="text-label leading-relaxed text-text-2">
                Por ejemplo, si hay portero, el piso o un horario que no podés. Si no marcás días,
                contanos acá cuándo te queda bien.
              </span>
              <textarea
                id={`${base}-nota`}
                aria-describedby={`${base}-ayuda`}
                value={nota}
                rows={3}
                maxLength={LARGO_MAXIMO_DE_LA_NOTA}
                onChange={(evento) => {
                  setError('');
                  setNota(evento.target.value);
                }}
                className="w-full resize-y rounded-field border-[1.5px] border-border bg-paper px-3.5 py-3 text-body-lg leading-7 text-ink placeholder:text-text-3 focus:border-ink"
              />
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2 min-[26rem]:flex-row">
            <Button
              cargando={mandando}
              onClick={() => {
                void mandar('mis_dias');
              }}
            >
              {mandando ? 'Mandando…' : 'Mandar mis días'}
            </Button>
            {coordinacion.situacion === 'un-dia' && mandada === null && (
              <Button variant="secundario" disabled={mandando} onClick={volverALaPropuesta}>
                Volver al día que te propusimos
              </Button>
            )}
            {mandada !== null && (
              <Button
                variant="secundario"
                disabled={mandando}
                onClick={() => {
                  dejarComoEstaban(mandada);
                }}
              >
                Dejarlos como estaban
              </Button>
            )}
          </div>
          {pie}
        </>
      )}

      {modo === 'mandados' && mandada !== null && (
        <>
          <LoQueMandaste
            respuesta={mandada}
            hoy={hoy}
            enLaPrueba={
              esPrueba && coordinacion.situacion === 'un-dia'
                ? loQueVeConElDiaAceptado(
                    coordinacion.propuesta.fecha,
                    coordinacion.propuesta.franja,
                    hoy,
                  )
                : null
            }
          />
          {mandada.respuesta === 'mis_dias' && (
            <div className="mt-4">
              <Button variant="secundario" onClick={abrirElCalendario}>
                Cambiar mis días
              </Button>
            </div>
          )}
          {mandada.respuesta === 'me_queda_bien' && esPrueba && (
            <div className="mt-4">
              <Button variant="secundario" onClick={volverALaPropuesta}>
                Volver a empezar
              </Button>
            </div>
          )}
          {esPrueba && pie}
        </>
      )}
    </section>
  );
}
