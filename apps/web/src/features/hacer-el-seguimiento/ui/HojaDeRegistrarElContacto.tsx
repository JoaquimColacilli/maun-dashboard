import { ESTADOS_DE_CONSULTA, type EstadoDeConsulta } from '@maun/domain';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState, type SyntheticEvent } from 'react';

import { AccionesDeContacto } from '@/entities/cliente';
import {
  ESTADO,
  etapaAlVolver,
  MUTACION_DE_PROYECTO,
  rutaDeCierre,
  type ProximoContacto,
  type Proyecto,
} from '@/entities/proyecto';
import { mensajeDeSincronizacion } from '@/shared/api';
import { fechaLarga, hoyEnElTaller, metaDeAvisos, uuidv7, useIr } from '@/shared/lib';
import { Button, Campo, FilaDeAcciones, Hoja } from '@/shared/ui';

import {
  errorDeLaNota,
  errorDelDiaQueLeEscribiste,
  errorDelProximoContacto,
  guardadoDelRegistro,
  LARGO_MAXIMO_DE_LA_NOTA,
} from '../model/seguimiento';
import { CuandoLeEscribis } from './CuandoLeEscribis';

type QueSigue = 'vuelve' | 'otra_fecha' | 'no_va';

const OPCIONES: readonly { que: QueSigue; titulo: string; detalle: string }[] = [
  {
    que: 'vuelve',
    titulo: 'Vuelve',
    detalle: 'Le interesa otra vez: vuelve a las consultas.',
  },
  {
    que: 'otra_fecha',
    titulo: 'Todavía no',
    detalle: 'Sigue en seguimiento: le volvés a escribir otro día.',
  },
  {
    que: 'no_va',
    titulo: 'No va',
    detalle: 'Se da por perdido, por el cierre de siempre.',
  },
];

const BOTON: Readonly<Record<QueSigue, string>> = {
  vuelve: 'Volver a las consultas',
  otra_fecha: 'Guardar la fecha nueva',
  no_va: 'Seguir al cierre',
};

interface Errores {
  dia?: string;
  respuesta?: string;
  que?: string;
  fecha?: string;
  nota?: string;
}

export interface HojaDeRegistrarElContactoProps {
  proyecto: Proyecto;
  pendiente: ProximoContacto;
  nombre: string;
  telefono: string;
  alCerrar: () => void;
}

export function HojaDeRegistrarElContacto({
  proyecto,
  pendiente,
  nombre,
  telefono,
  alCerrar,
}: HojaDeRegistrarElContactoProps) {
  const ids = useId();
  const ir = useIr();
  const hoy = hoyEnElTaller();
  const [idDelSiguiente] = useState(uuidv7);
  const [dia, setDia] = useState(hoy);
  const [respuesta, setRespuesta] = useState('');
  const [que, setQue] = useState<QueSigue | null>(null);
  const [etapa, setEtapa] = useState<EstadoDeConsulta>(() => etapaAlVolver(pendiente));
  const [fecha, setFecha] = useState('');
  const [nota, setNota] = useState('');
  const [errores, setErrores] = useState<Errores>({});
  const [rechazo, setRechazo] = useState<unknown>(null);
  const yaTermino = useRef(false);

  const guardar = useMutation({
    ...MUTACION_DE_PROYECTO,
    meta: metaDeAvisos('contactoRegistrado', { errorEnPantalla: true, sujeto: proyecto.titulo }),
  });

  useEffect(() => {
    if (!guardar.isPaused || yaTermino.current) return;
    yaTermino.current = true;
    alCerrar();
  }, [guardar.isPaused, alCerrar]);

  const conCambios =
    dia !== hoy || respuesta.trim() !== '' || que !== null || fecha !== '' || nota.trim() !== '';

  function terminar(): void {
    if (yaTermino.current) return;
    yaTermino.current = true;
    alCerrar();
  }

  function enviar(evento: SyntheticEvent<HTMLFormElement>): void {
    evento.preventDefault();
    const encontrados: Errores = {
      dia: errorDelDiaQueLeEscribiste(dia, hoy),
      respuesta: errorDeLaNota(respuesta),
      que: que === null ? 'Elegí qué pasó.' : undefined,
      fecha: que === 'otra_fecha' ? errorDelProximoContacto(fecha, hoy) : undefined,
      nota: que === 'otra_fecha' ? errorDeLaNota(nota) : undefined,
    };
    setErrores(encontrados);
    if (que === null || Object.values(encontrados).some((error) => error !== undefined)) return;

    setRechazo(null);
    const salida =
      que === 'vuelve'
        ? { que, etapa }
        : que === 'otra_fecha'
          ? { que, siguiente: { fecha, nota } }
          : { que };
    const guardado = guardadoDelRegistro(
      proyecto,
      pendiente,
      { dia, respuesta, salida },
      hoy,
      idDelSiguiente,
    );

    if (que === 'no_va') {
      if (respuesta.trim() !== '') guardar.mutate(guardado);
      yaTermino.current = true;
      ir(rutaDeCierre(proyecto.id));
      return;
    }

    guardar.mutate(guardado, { onSuccess: terminar, onError: setRechazo });
  }

  return (
    <Hoja
      titulo="Registrar el contacto"
      bajada={`${nombre} · ${proyecto.titulo}`}
      alCerrar={alCerrar}
      conCambios={conCambios}
    >
      {(pedirCierre) => (
        <form noValidate onSubmit={enviar} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4 md:px-6 md:py-5">
            <section
              aria-label={`Contactar a ${nombre}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-field bg-surface px-3.5 py-2.5"
            >
              <p className="min-w-0 flex-1 text-label leading-snug text-text-2">
                Le tocaba el {fechaLarga(pendiente.fecha, hoy)}.
                {pendiente.nota.trim() !== '' && ` ${pendiente.nota.trim()}.`}
              </p>
              <AccionesDeContacto nombre={nombre} telefono={telefono} />
            </section>

            <Campo
              etiqueta="Qué día le escribiste"
              type="date"
              max={hoy}
              value={dia}
              error={errores.dia}
              onChange={(evento) => {
                setDia(evento.target.value);
                setErrores((previos) => ({ ...previos, dia: undefined }));
              }}
            />

            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${ids}-respuesta`} className="text-label text-text-2">
                Qué te contestó
              </label>
              <textarea
                id={`${ids}-respuesta`}
                rows={2}
                maxLength={LARGO_MAXIMO_DE_LA_NOTA}
                value={respuesta}
                onChange={(evento) => {
                  setRespuesta(evento.target.value);
                }}
                placeholder="Que le escriba después de fin de mes, que consiguió más barato…"
                className="rounded-field border border-border bg-paper px-3.5 py-2.5 text-body-lg text-ink"
              />
              <span className="text-meta text-text-3">Opcional.</span>
              {errores.respuesta !== undefined && (
                <span role="alert" className="text-label font-medium text-alerta">
                  {errores.respuesta}
                </span>
              )}
            </div>

            <fieldset
              className="flex flex-col gap-1.5"
              aria-describedby={errores.que === undefined ? undefined : `${ids}-que-error`}
            >
              <legend className="mb-1.5 text-label text-text-2">¿Y ahora?</legend>
              <div role="radiogroup" aria-label="¿Y ahora?" className="flex flex-col gap-2">
                {OPCIONES.map((opcion) => {
                  const elegida = que === opcion.que;
                  return (
                    <button
                      key={opcion.que}
                      type="button"
                      role="radio"
                      aria-checked={elegida}
                      onClick={() => {
                        setQue(opcion.que);
                        setErrores((previos) => ({ ...previos, que: undefined }));
                      }}
                      className={`flex min-h-[52px] flex-col items-start justify-center rounded-field border px-3.5 py-2 text-left ${
                        elegida ? 'border-ink bg-surface' : 'border-border bg-paper'
                      }`}
                    >
                      <span
                        className={`text-body leading-tight ${elegida ? 'font-semibold' : 'font-medium'}`}
                      >
                        {opcion.titulo}
                      </span>
                      <span className="text-meta text-text-2">{opcion.detalle}</span>
                    </button>
                  );
                })}
              </div>
              {errores.que !== undefined && (
                <span
                  id={`${ids}-que-error`}
                  role="alert"
                  className="text-label font-medium text-alerta"
                >
                  {errores.que}
                </span>
              )}
            </fieldset>

            {que === 'vuelve' && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${ids}-etapa`} className="text-label text-text-2">
                  Vuelve a
                </label>
                <select
                  id={`${ids}-etapa`}
                  value={etapa}
                  onChange={(evento) => {
                    setEtapa(evento.target.value as EstadoDeConsulta);
                  }}
                  className="h-field rounded-field border border-border bg-paper px-3 text-body-lg text-ink"
                >
                  {ESTADOS_DE_CONSULTA.map((estado) => (
                    <option key={estado} value={estado}>
                      {ESTADO[estado].etiqueta}
                    </option>
                  ))}
                </select>
                <span className="text-meta text-text-3">
                  La etapa en la que estaba cuando le dijiste que sí a esperar. Cambiala si
                  corresponde otra.
                </span>
              </div>
            )}

            {que === 'otra_fecha' && (
              <>
                <CuandoLeEscribis
                  hoy={hoy}
                  fecha={fecha}
                  error={errores.fecha}
                  alCambiar={(elegida) => {
                    setFecha(elegida);
                    setErrores((previos) => ({ ...previos, fecha: undefined }));
                  }}
                />
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`${ids}-nota`} className="text-label text-text-2">
                    Nota para la próxima
                  </label>
                  <textarea
                    id={`${ids}-nota`}
                    rows={2}
                    maxLength={LARGO_MAXIMO_DE_LA_NOTA}
                    value={nota}
                    onChange={(evento) => {
                      setNota(evento.target.value);
                    }}
                    className="rounded-field border border-border bg-paper px-3.5 py-2.5 text-body-lg text-ink"
                  />
                  <span className="text-meta text-text-3">Opcional.</span>
                </div>
              </>
            )}

            {que === 'no_va' && (
              <p className="rounded-field bg-surface px-3.5 py-2.5 text-label leading-relaxed text-text-2">
                Se abre el cierre, el mismo de siempre: si dejó seña, se liquida como ingreso del
                taller, y el trabajo pasa al historial. Se puede reactivar.
              </p>
            )}

            {rechazo !== null && (
              <p role="alert" className="text-label font-medium text-alerta">
                {mensajeDeSincronizacion(rechazo, {
                  operacion: 'proyecto',
                  sujeto: proyecto.titulo,
                })}
              </p>
            )}
          </div>

          <footer className="flex-none border-t border-hairline bg-paper px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:px-6 md:pb-3">
            <FilaDeAcciones>
              <Button type="button" variant="secundario" onClick={pedirCierre}>
                Cancelar
              </Button>
              <Button type="submit" cargando={guardar.isPending && !guardar.isPaused}>
                {que === null ? 'Registrar' : BOTON[que]}
              </Button>
            </FilaDeAcciones>
          </footer>
        </form>
      )}
    </Hoja>
  );
}
