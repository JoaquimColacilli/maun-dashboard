import type { ResumenDeOpiniones } from '@maun/domain';
import { useEffect, useId, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';

import { resumenDelTaller, trabajosParaPedir } from '@/entities/opinion';
import { useReplicaDelTaller } from '@/entities/replica';
import { FichaDeLaRespuesta } from '@/features/leer-las-opiniones';
import {
  haceCuanto,
  hoyLocal,
  PARAMETRO_DE_RESPUESTA,
  RUTA_DE_PREGUNTAS,
  RUTA_DE_PROYECTOS,
  rutaDelProyecto,
  useEstadoSync,
  useIr,
} from '@/shared/lib';
import { Button, ConSalida, EstadoVacio, FilaDeAcciones, Icono } from '@/shared/ui';

import { PaginaDeOpiniones } from './EncabezadoDeOpiniones';
import {
  EnElTiempo,
  LoQueEscribieron,
  PreguntaPorPregunta,
  Titular,
  TrabajoPorTrabajo,
} from './SeccionesDeResultados';

const PREFIJO_DE_PREGUNTA = '#pregunta-';

function SinEnviar() {
  const replica = useReplicaDelTaller();
  const ir = useIr();
  const { terminados, sinPedir } = useMemo(() => trabajosParaPedir(replica), [replica]);

  return (
    <EstadoVacio
      ilustracion="sin-opiniones"
      titulo="Todavía no le preguntaste a nadie"
      detalle={
        terminados === 0
          ? 'Cuando marques un trabajo como entregado, te va a aparecer ahí mismo el botón para pedirle la opinión al cliente. Lo que contesten se junta acá.'
          : `Tenés ${String(terminados)} ${terminados === 1 ? 'trabajo terminado' : 'trabajos terminados'}. Cuando marcás uno como entregado, te va a aparecer ahí mismo el botón para pedirle la opinión al cliente. Lo que contesten se junta acá.`
      }
    >
      <FilaDeAcciones>
        {terminados > 0 && (
          <Button
            onClick={() => {
              ir(sinPedir === null ? RUTA_DE_PROYECTOS : rutaDelProyecto(sinPedir));
            }}
          >
            Pedirle la opinión a un cliente
          </Button>
        )}
        <Button
          variant="secundario"
          onClick={() => {
            ir(RUTA_DE_PREGUNTAS);
          }}
        >
          Ver qué se pregunta
        </Button>
      </FilaDeAcciones>
    </EstadoVacio>
  );
}

function SinRespuestas({
  resumen,
  hoy,
  alAbrir,
}: {
  resumen: ResumenDeOpiniones;
  hoy: string;
  alAbrir: (respuestaId: string) => void;
}) {
  const [conLista, setConLista] = useState(false);
  const idDeLaLista = useId();
  const { enviadas, desde } = resumen;
  const cuando = desde === null ? '' : haceCuanto(desde, hoy);

  return (
    <>
      <div className="rounded-panel border border-hairline bg-paper px-4 py-4 md:px-5">
        <div className="flex max-w-[560px] flex-col items-start gap-3">
          <span className="text-body text-text-2">
            {enviadas === 1
              ? `Le preguntaste a un cliente ${cuando}`
              : `Les preguntaste a ${String(enviadas)} clientes, el más viejo ${cuando}`}
          </span>
          <h2 className="font-display text-lema leading-tight text-pretty">
            Todavía no contestó ninguno
          </h2>
          <p className="text-body leading-relaxed text-text-2">
            Es normal los primeros días. De cada diez personas a las que se les pide, suelen
            contestar entre tres y cinco, y casi siempre en la primera semana.
          </p>
          <Button
            variant="secundario"
            aria-expanded={conLista}
            aria-controls={idDeLaLista}
            onClick={() => {
              setConLista((actual) => !actual);
            }}
          >
            Ver a quién le mandaste
          </Button>
        </div>
      </div>
      {conLista && (
        <TrabajoPorTrabajo
          id={idDeLaLista}
          trabajos={resumen.trabajos}
          hoy={hoy}
          alAbrir={alAbrir}
        />
      )}
    </>
  );
}

export function ResultadosPage() {
  const replica = useReplicaDelTaller();
  const estadoSync = useEstadoSync();
  const ir = useIr();
  const location = useLocation();
  const [busqueda, setBusqueda] = useSearchParams();
  const hoy = hoyLocal();
  const resumen = useMemo(() => resumenDelTaller(replica, hoy), [replica, hoy]);
  const abierta = busqueda.get(PARAMETRO_DE_RESPUESTA);

  useEffect(() => {
    if (!location.hash.startsWith(PREFIJO_DE_PREGUNTA)) return;
    document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [location.hash]);

  function abrir(respuestaId: string): void {
    setBusqueda((actual) => {
      const siguiente = new URLSearchParams(actual);
      siguiente.set(PARAMETRO_DE_RESPUESTA, respuestaId);
      return siguiente;
    });
  }

  function cerrar(): void {
    const siguiente = new URLSearchParams(busqueda);
    siguiente.delete(PARAMETRO_DE_RESPUESTA);
    const resto = siguiente.toString();
    ir(`${location.pathname}${resto === '' ? '' : `?${resto}`}`, { como: 'terminar' });
  }

  return (
    <PaginaDeOpiniones seccion="resultados">
      {estadoSync.tipo === 'sin-conexion' && (
        <div className="flex items-center gap-2 rounded-panel bg-ink px-3 py-2.25 text-label leading-snug text-paper">
          <Icono nombre="cloud-off" tamano={14} />
          Sin conexión. Estás viendo lo último que se sincronizó.
        </div>
      )}

      {resumen.situacion === 'sin-enviar' && <SinEnviar />}

      {resumen.situacion === 'sin-respuestas' && (
        <SinRespuestas resumen={resumen} hoy={hoy} alAbrir={abrir} />
      )}

      {resumen.situacion === 'con-respuestas' && (
        <div className="flex flex-col gap-3 md:gap-4">
          <Titular resumen={resumen} />
          <LoQueEscribieron resumen={resumen} hoy={hoy} alAbrir={abrir} />
          <PreguntaPorPregunta resumen={resumen} hoy={hoy} />
          <EnElTiempo resumen={resumen} />
          <TrabajoPorTrabajo trabajos={resumen.trabajos} hoy={hoy} alAbrir={abrir} />
        </div>
      )}

      <ConSalida valor={abierta}>
        {(respuestaId) => <FichaDeLaRespuesta respuestaId={respuestaId} alCerrar={cerrar} />}
      </ConSalida>
    </PaginaDeOpiniones>
  );
}
