import { useMutation } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState, type SyntheticEvent } from 'react';

import { MUTACION_DE_PROYECTO, type Proyecto } from '@/entities/proyecto';
import { mensajeDeSincronizacion } from '@/shared/api';
import { hayCambios, hoyEnElTaller, metaDeAvisos, uuidv7 } from '@/shared/lib';
import { Button, FilaDeAcciones, Hoja } from '@/shared/ui';

import {
  errorDeLaNota,
  errorDelProximoContacto,
  guardadoParaPonerEnSeguimiento,
  LARGO_MAXIMO_DE_LA_NOTA,
  type ValoresDelSeguimiento,
} from '../model/seguimiento';
import { CuandoLeEscribis } from './CuandoLeEscribis';

export interface HojaDePonerEnSeguimientoProps {
  proyecto: Proyecto;
  nombre: string;
  alCerrar: () => void;
}

const VACIO: ValoresDelSeguimiento = { fecha: '', nota: '' };

export function HojaDePonerEnSeguimiento({
  proyecto,
  nombre,
  alCerrar,
}: HojaDePonerEnSeguimientoProps) {
  const ids = useId();
  const hoy = hoyEnElTaller();
  const [id] = useState(uuidv7);
  const [valores, setValores] = useState<ValoresDelSeguimiento>(VACIO);
  const [errores, setErrores] = useState<{ fecha?: string; nota?: string }>({});
  const [rechazo, setRechazo] = useState<unknown>(null);
  const yaTermino = useRef(false);

  const guardar = useMutation({
    ...MUTACION_DE_PROYECTO,
    meta: metaDeAvisos('pasoASeguimiento', { errorEnPantalla: true, sujeto: proyecto.titulo }),
  });

  useEffect(() => {
    if (!guardar.isPaused || yaTermino.current) return;
    yaTermino.current = true;
    alCerrar();
  }, [guardar.isPaused, alCerrar]);

  function enviar(evento: SyntheticEvent<HTMLFormElement>): void {
    evento.preventDefault();
    const encontrados = {
      fecha: errorDelProximoContacto(valores.fecha, hoy),
      nota: errorDeLaNota(valores.nota),
    };
    setErrores(encontrados);
    if (encontrados.fecha !== undefined || encontrados.nota !== undefined) return;

    setRechazo(null);
    guardar.mutate(guardadoParaPonerEnSeguimiento(proyecto, valores, hoy, id), {
      onSuccess: () => {
        if (yaTermino.current) return;
        yaTermino.current = true;
        alCerrar();
      },
      onError: setRechazo,
    });
  }

  return (
    <Hoja
      titulo="Por ahora no"
      bajada={`${nombre} · ${proyecto.titulo}`}
      alCerrar={alCerrar}
      conCambios={hayCambios(VACIO, { ...valores, nota: valores.nota.trim() })}
    >
      {(pedirCierre) => (
        <form noValidate onSubmit={enviar} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4 md:px-6 md:py-5">
            <p className="text-body leading-relaxed text-text-2">
              No dijo que no: dijo que ahora no. Pasa a Seguimiento, sale de tus consultas y la
              agenda te avisa el día en que le volvés a escribir.
            </p>

            <CuandoLeEscribis
              hoy={hoy}
              fecha={valores.fecha}
              error={errores.fecha}
              alCambiar={(fecha) => {
                setValores((previos) => ({ ...previos, fecha }));
                setErrores((previos) => ({ ...previos, fecha: undefined }));
              }}
            />

            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${ids}-nota`} className="text-label text-text-2">
                Nota
              </label>
              <textarea
                id={`${ids}-nota`}
                rows={2}
                maxLength={LARGO_MAXIMO_DE_LA_NOTA}
                value={valores.nota}
                onChange={(evento) => {
                  const nota = evento.target.value;
                  setValores((previos) => ({ ...previos, nota }));
                }}
                placeholder="Después de las vacaciones, cuando cobre el aguinaldo…"
                className="rounded-field border border-border bg-paper px-3.5 py-2.5 text-body-lg text-ink"
              />
              <span className="text-meta text-text-3">Opcional.</span>
              {errores.nota !== undefined && (
                <span role="alert" className="text-label font-medium text-alerta">
                  {errores.nota}
                </span>
              )}
            </div>

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
                Pasar a seguimiento
              </Button>
            </FilaDeAcciones>
          </footer>
        </form>
      )}
    </Hoja>
  );
}
