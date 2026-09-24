import { lineasDeLaRespuesta, type RespuestaDelFormulario } from '@maun/domain';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useParams } from 'react-router';

import {
  FormularioDeLaEncuesta,
  GraciasPorContestar,
  laEncuestaNoSirve,
  LoQueContestaste,
  useEncuestaCompartida,
} from '@/entities/opinion';
import { contestarEncuesta, esFalloDeRed, motivoDelRechazo, rechazoDeLaBase } from '@/shared/api';
import { hoyLocal, uuidv7 } from '@/shared/lib';
import { Button } from '@/shared/ui';

export const TITULO_MUERTO = 'Este enlace ya no funciona';

export const TEXTO_MUERTO =
  'Los enlaces que manda el taller duran un tiempo y después se dan de baja. Si querés dejar tu opinión, pedile uno nuevo a quien te lo pasó.';

const SIN_SENAL_AL_MANDAR =
  'No se pudo mandar: se cortó la conexión. Lo que marcaste sigue acá; probá de nuevo cuando vuelva la señal.';

const NO_SE_GUARDO = 'No pudimos guardar tu opinión. Probá de nuevo en un rato.';

export const CAMBIO_LA_ENCUESTA =
  'Mientras contestabas, el taller cambió una de las preguntas. Ya está al día: revisá lo que marcaste y mandala de nuevo.';

function Aviso({ titulo, texto, accion }: { titulo: string; texto: string; accion?: ReactNode }) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6 py-10">
      <div className="flex max-w-[400px] flex-col items-start gap-3.5">
        <span className="font-display text-firma text-text-2">Taller MAUN</span>
        <h1 className="text-h2 leading-snug font-semibold">{titulo}</h1>
        <p className="text-body leading-relaxed text-text-2">{texto}</p>
        {accion}
      </div>
    </div>
  );
}

function Esqueleto() {
  return (
    <div aria-busy="true" className="mx-auto flex max-w-[520px] flex-col gap-6.5 px-5 pt-5.5 pb-11">
      <span className="sr-only" role="status">
        Abriendo la encuesta
      </span>
      <div className="h-4 w-30 rounded-control bg-ink/6" />
      <div className="h-7.5 w-4/5 rounded-field bg-ink/6" />
      {[0, 1].map((bloque) => (
        <div key={bloque} className="flex flex-col gap-2.5">
          <div className="h-4 w-2/3 rounded-control bg-ink/6" />
          <div className="flex gap-2">
            {[0, 1, 2, 3, 4].map((paso) => (
              <div key={paso} className="h-18.5 flex-1 rounded-field bg-ink/6" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function motivoParaMostrar(error: unknown): string {
  if (esFalloDeRed(error)) return SIN_SENAL_AL_MANDAR;
  if (motivoDelRechazo(error) !== null) return rechazoDeLaBase(error)?.mensaje ?? NO_SE_GUARDO;
  return NO_SE_GUARDO;
}

export function EncuestaPublicaPage() {
  const { token = '' } = useParams();
  const resultado = useEncuestaCompartida(token);
  const [idDeLaRespuesta] = useState(uuidv7);
  const [enviada, setEnviada] = useState(false);
  const [murio, setMurio] = useState(false);
  const principal = useRef<HTMLElement>(null);
  const hoy = hoyLocal();

  const taller = resultado.estado === 'lista' ? resultado.encuesta.taller : '';

  useEffect(() => {
    document.title = taller === '' ? 'Encuesta' : `Encuesta de ${taller}`;
  }, [taller]);

  useEffect(() => {
    if (!enviada) return;
    globalThis.scrollTo({ top: 0 });
    const titulo = principal.current?.querySelector('h1');
    if (!titulo) return;
    titulo.tabIndex = -1;
    titulo.focus();
  }, [enviada]);

  let contenido: ReactNode;
  if (murio || resultado.estado === 'muerto') {
    contenido = <Aviso titulo={TITULO_MUERTO} texto={TEXTO_MUERTO} />;
  } else if (resultado.estado === 'sin-senal') {
    contenido = (
      <Aviso
        titulo="Sin conexión"
        texto="Necesitás señal para abrir la encuesta. Probá de nuevo cuando vuelva."
      />
    );
  } else if (resultado.estado === 'error') {
    contenido = (
      <Aviso
        titulo="No pudimos abrir la encuesta"
        texto="Se cortó la conexión. El enlace sigue siendo válido, probá de nuevo."
        accion={<Button onClick={resultado.reintentar}>Probar de nuevo</Button>}
      />
    );
  } else if (resultado.estado === 'cargando') {
    contenido = <Esqueleto />;
  } else {
    const { encuesta, releer } = resultado;
    if (enviada) {
      contenido = (
        <GraciasPorContestar
          taller={encuesta.taller}
          cliente={encuesta.cliente}
          resena={encuesta.resena}
        />
      );
    } else if (encuesta.contestada !== null) {
      contenido = (
        <LoQueContestaste
          taller={encuesta.taller}
          fecha={encuesta.contestada.fecha}
          hoy={hoy}
          lineas={lineasDeLaRespuesta(encuesta.preguntas, encuesta.contestada.renglones)}
        />
      );
    } else {
      const mandar = async (respuesta: RespuestaDelFormulario): Promise<string | null> => {
        try {
          const estado = await contestarEncuesta(token, respuesta);
          if (estado === 'ya_contestada') {
            releer();
            return null;
          }
          setEnviada(true);
          return null;
        } catch (error) {
          if (laEncuestaNoSirve(error)) {
            setMurio(true);
            return null;
          }
          if (motivoDelRechazo(error) === 'ajena') {
            releer();
            return CAMBIO_LA_ENCUESTA;
          }
          return motivoParaMostrar(error);
        }
      };
      contenido = (
        <FormularioDeLaEncuesta
          taller={encuesta.taller}
          trabajo={encuesta.trabajo}
          preguntas={encuesta.preguntas}
          idDeLaRespuesta={idDeLaRespuesta}
          alMandar={mandar}
        />
      );
    }
  }

  return (
    <main ref={principal} className="min-h-dvh bg-mesa text-ink">
      {contenido}
    </main>
  );
}
