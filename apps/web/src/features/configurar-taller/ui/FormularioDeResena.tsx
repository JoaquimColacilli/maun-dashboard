import {
  normalizarLinkDeResena,
  revisarLinkDeResena,
  type MotivoDelLinkDeResena,
} from '@maun/domain';
import { useMutation } from '@tanstack/react-query';
import { useState, type SyntheticEvent } from 'react';

import { mensajeDeSincronizacion, type FilaDe } from '@/shared/api';
import { useEstadoSync } from '@/shared/lib';
import { Button, Campo } from '@/shared/ui';

import { MUTACION_DE_AJUSTES } from '../api/mutacion';

export const AYUDA_DE_LA_RESENA =
  'Opcional. En Google, buscá tu negocio, tocá «Pedir reseñas» y copiá el enlace que te da. Lo ve cada cliente después de contestar la encuesta, conteste lo que conteste.';

const MENSAJE: Readonly<Record<MotivoDelLinkDeResena, string>> = {
  largo: 'Ese enlace es demasiado largo. Copiá el corto que te da Google al tocar «Pedir reseñas».',
  'sin-https': 'Tiene que empezar con https://. Copialo entero desde Google.',
  'otro-sitio':
    'Tiene que ser un enlace de Google para dejar una reseña, como los que empiezan con https://g.page/ o https://search.google.com/.',
};

export function FormularioDeResena({ ajustes }: { ajustes: FilaDe<'ajustes'> }) {
  const [link, setLink] = useState(ajustes.resena_link);
  const [error, setError] = useState<string | undefined>(undefined);
  const guardar = useMutation(MUTACION_DE_AJUSTES);
  const estadoSync = useEstadoSync();

  const guardando = guardar.isPending;
  const guardado =
    !guardando && !guardar.isError && guardar.isSuccess && estadoSync.tipo === 'sincronizado';

  function enviar(evento: SyntheticEvent<HTMLFormElement>) {
    evento.preventDefault();
    const revision = revisarLinkDeResena(link);
    if (revision.estado === 'invalido') {
      setError(MENSAJE[revision.motivo]);
      return;
    }
    setError(undefined);
    const nuevo = revision.estado === 'vacio' ? '' : normalizarLinkDeResena(link);
    if (nuevo === ajustes.resena_link) return;
    guardar.mutate({
      id: ajustes.id,
      cambios: { resena_link: nuevo },
      previos: { resena_link: ajustes.resena_link },
    });
  }

  return (
    <form noValidate className="flex flex-col gap-3" onSubmit={enviar}>
      <Campo
        etiqueta="Enlace para dejar una reseña en Google"
        inputMode="url"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        ayuda={AYUDA_DE_LA_RESENA}
        value={link}
        error={error}
        onChange={(evento) => {
          setLink(evento.target.value);
          setError(undefined);
        }}
      />
      {guardar.isError && (
        <p role="alert" className="text-label font-medium text-alerta">
          {mensajeDeSincronizacion(guardar.error)}
        </p>
      )}
      {guardando && estadoSync.tipo === 'sin-conexion' && (
        <p className="text-label text-atencion">
          Quedó en la cola: se guarda cuando vuelva la señal.
        </p>
      )}
      {guardado && <p className="text-label text-hogar">Guardado.</p>}
      <Button type="submit" cargando={guardando} className="mt-1 self-start">
        Guardar el enlace
      </Button>
    </form>
  );
}
