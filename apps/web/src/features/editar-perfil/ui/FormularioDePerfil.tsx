import { useMutation } from '@tanstack/react-query';
import { useState, type SyntheticEvent } from 'react';

import {
  LARGO_MAXIMO_DEL_NOMBRE,
  MUTACION_DEL_PERFIL,
  useNombreDeLaPersona,
  useSesionActiva,
} from '@/entities/sesion';
import { metaDeAvisos } from '@/shared/lib';
import { Avatar, Button, Campo } from '@/shared/ui';

export function FormularioDePerfil() {
  const { email } = useSesionActiva();
  const nombreActual = useNombreDeLaPersona();
  const guardar = useMutation({ ...MUTACION_DEL_PERFIL, meta: metaDeAvisos('perfil') });
  const [nombre, setNombre] = useState(nombreActual);
  const [error, setError] = useState<string | undefined>(undefined);

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

  return (
    <form noValidate onSubmit={enviar} className="flex flex-col gap-3.5">
      <div className="flex min-w-0 items-center gap-3.5">
        <Avatar nombre={limpio === '' ? email : limpio} tamano="grande" />
        <div className="min-w-0">
          <p className="truncate text-body-lg font-semibold">
            {limpio === '' ? 'Todavía sin nombre' : limpio}
          </p>
          <p className="truncate text-label text-text-2">{email}</p>
        </div>
      </div>
      <Campo
        etiqueta="Tu nombre"
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
    </form>
  );
}
