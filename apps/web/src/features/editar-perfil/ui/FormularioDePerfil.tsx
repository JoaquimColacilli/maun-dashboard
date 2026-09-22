import { onlineManager, useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ChangeEvent, type SyntheticEvent } from 'react';

import {
  LARGO_MAXIMO_DEL_NOMBRE,
  MUTACION_DEL_PERFIL,
  useNombreDeLaPersona,
  useSesionActiva,
} from '@/entities/sesion';
import { esFalloDeRed, mensajeDeAcceso, subirFotoDeLaPersona } from '@/shared/api';
import { avisarEnPantalla, metaDeAvisos } from '@/shared/lib';
import { Avatar, Button, Campo, ConSalida, Hoja, Icono } from '@/shared/ui';

import type { Recorte } from '../model/encuadre';
import {
  decodificarImagen,
  recortarYCodificar,
  TIPOS_QUE_SE_ELIGEN,
  type ImagenDecodificada,
} from '../model/imagen';
import { RecortadorDeFoto } from './RecortadorDeFoto';

const SIN_SENAL_PARA_LA_FOTO =
  'Sin señal no se puede cambiar la foto: se sube en el momento y no queda anotada para después. Probá cuando vuelva la señal.';

const LIBERAR_DESPUES_DE_CERRAR_MS = 1000;

export function FormularioDePerfil() {
  const { email, usuarioId, foto } = useSesionActiva();
  const nombreActual = useNombreDeLaPersona();
  const guardar = useMutation({ ...MUTACION_DEL_PERFIL, meta: metaDeAvisos('perfil') });
  const [nombre, setNombre] = useState(nombreActual);
  const [error, setError] = useState<string | undefined>(undefined);
  const selector = useRef<HTMLInputElement>(null);
  const [imagen, setImagen] = useState<ImagenDecodificada | null>(null);
  const [avisoDeLaFoto, setAvisoDeLaFoto] = useState<string | undefined>(undefined);
  const [guardandoFoto, setGuardandoFoto] = useState(false);
  const [errorDeLaFoto, setErrorDeLaFoto] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!imagen) return;
    return () => {
      setTimeout(imagen.liberar, LIBERAR_DESPUES_DE_CERRAR_MS);
    };
  }, [imagen]);

  const limpio = nombre.trim();
  const cambio = limpio !== nombreActual.trim();

  function enviar(evento: SyntheticEvent<HTMLFormElement>): void {
    evento.preventDefault();
    if (limpio.length > LARGO_MAXIMO_DEL_NOMBRE) {
      setError(
        `Hasta ${String(LARGO_MAXIMO_DEL_NOMBRE)} letras. Con el nombre y el apellido alcanza.`,
      );
      return;
    }
    setError(undefined);
    guardar.mutate({ nombre: limpio });
  }

  function elegirFoto(): void {
    if (!onlineManager.isOnline()) {
      setAvisoDeLaFoto(SIN_SENAL_PARA_LA_FOTO);
      return;
    }
    setAvisoDeLaFoto(undefined);
    selector.current?.click();
  }

  async function alElegirArchivo(evento: ChangeEvent<HTMLInputElement>): Promise<void> {
    const archivo = evento.target.files?.[0];
    evento.target.value = '';
    if (!archivo) return;
    try {
      const decodificada = await decodificarImagen(archivo);
      setErrorDeLaFoto(undefined);
      setImagen(decodificada);
    } catch (fallo) {
      setAvisoDeLaFoto(fallo instanceof Error ? fallo.message : 'No se pudo leer esa imagen.');
    }
  }

  async function guardarFoto(abierta: ImagenDecodificada, recorte: Recorte): Promise<void> {
    if (!onlineManager.isOnline()) {
      setErrorDeLaFoto(SIN_SENAL_PARA_LA_FOTO);
      return;
    }
    setGuardandoFoto(true);
    setErrorDeLaFoto(undefined);
    try {
      const archivo = await recortarYCodificar(abierta.fuente, recorte);
      await subirFotoDeLaPersona(usuarioId, archivo);
      setImagen(null);
      avisarEnPantalla({ clave: 'foto', tono: 'hecho', texto: 'Foto guardada.' });
    } catch (fallo) {
      setErrorDeLaFoto(esFalloDeRed(fallo) ? SIN_SENAL_PARA_LA_FOTO : mensajeDeAcceso(fallo));
    } finally {
      setGuardandoFoto(false);
    }
  }

  return (
    <form noValidate onSubmit={enviar} className="flex flex-col gap-3.5">
      <div className="flex min-w-0 items-center gap-3.5">
        <button
          type="button"
          onClick={elegirFoto}
          aria-label={foto === '' ? 'Poner una foto' : 'Cambiar la foto'}
          className="relative flex-none rounded-pill"
        >
          <Avatar nombre={limpio === '' ? email : limpio} foto={foto} tamano="grande" />
          <span
            aria-hidden
            className="absolute -right-0.5 -bottom-0.5 flex size-6 items-center justify-center rounded-pill border-2 border-paper bg-ink text-paper"
          >
            <Icono nombre="pencil" tamano={12} />
          </span>
        </button>
        <input
          ref={selector}
          type="file"
          accept={TIPOS_QUE_SE_ELIGEN}
          tabIndex={-1}
          aria-hidden
          className="sr-only"
          onChange={(evento) => {
            void alElegirArchivo(evento);
          }}
        />
        <div className="min-w-0">
          <p className="truncate text-body-lg font-semibold">
            {limpio === '' ? 'Todavía sin nombre' : limpio}
          </p>
          <p className="truncate text-label text-text-2">{email}</p>
        </div>
      </div>
      {avisoDeLaFoto !== undefined && (
        <p role="alert" className="text-label leading-relaxed font-medium text-alerta">
          {avisoDeLaFoto}
        </p>
      )}
      <Campo
        etiqueta="Tu nombre"
        className="max-w-(--campo-largo)"
        value={nombre}
        autoComplete="name"
        onChange={(evento) => {
          setNombre(evento.target.value);
        }}
        error={error}
        ayuda="Se ve en la barra lateral, al lado de tu mail. El mail es con el que entrás y no se cambia desde acá."
      />
      <Button
        type="submit"
        variant="secundario"
        size="chico"
        className="self-start"
        disabled={!cambio}
        cargando={guardar.isPending && !guardar.isPaused}
      >
        Guardar el nombre
      </Button>

      <ConSalida valor={imagen}>
        {(abierta) => (
          <Hoja
            titulo="Encuadrar la foto"
            ancho="angosto"
            alCerrar={() => {
              if (!guardandoFoto) setImagen(null);
            }}
          >
            <RecortadorDeFoto
              imagen={abierta}
              guardando={guardandoFoto}
              error={errorDeLaFoto}
              alGuardar={(recorte) => {
                void guardarFoto(abierta, recorte);
              }}
              alCancelar={() => {
                setImagen(null);
              }}
            />
          </Hoja>
        )}
      </ConSalida>
    </form>
  );
}
