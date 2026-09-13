import { useState, type SyntheticEvent } from 'react';

import { cambiarContrasena, mensajeDeAcceso } from '@/shared/api';
import { marcarDesbloqueada } from '@/shared/lib';
import { Button, CampoDeContrasena } from '@/shared/ui';

const LARGO_MINIMO = 6;

export function FormularioDeNuevaContrasena({ alCambiar }: { alCambiar: () => void }) {
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState<{ campo?: 'contrasena'; mensaje: string } | undefined>(
    undefined,
  );
  const [guardando, setGuardando] = useState(false);

  async function enviar(evento: SyntheticEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (contrasena.length < LARGO_MINIMO) {
      setError({
        campo: 'contrasena',
        mensaje: `La contraseña tiene que tener al menos ${String(LARGO_MINIMO)} caracteres.`,
      });
      return;
    }

    setGuardando(true);
    setError(undefined);
    try {
      await cambiarContrasena(contrasena);
      marcarDesbloqueada();
      alCambiar();
    } catch (fallo) {
      setError({ mensaje: mensajeDeAcceso(fallo) });
      setGuardando(false);
    }
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(evento) => {
        void enviar(evento);
      }}
    >
      <CampoDeContrasena
        etiqueta="Contraseña nueva"
        name="new-password"
        autoComplete="new-password"
        ayuda={`Al menos ${String(LARGO_MINIMO)} caracteres. Con el ojo ves lo que escribiste.`}
        value={contrasena}
        error={error?.campo === 'contrasena' ? error.mensaje : undefined}
        onChange={(evento) => {
          setContrasena(evento.target.value);
        }}
      />
      {error !== undefined && error.campo === undefined && (
        <p role="alert" className="text-label leading-relaxed font-medium text-alerta">
          {error.mensaje}
        </p>
      )}
      <Button type="submit" size="grande" cargando={guardando} className="mt-1 w-full">
        {guardando ? 'Guardando…' : 'Guardar la contraseña'}
      </Button>
    </form>
  );
}
