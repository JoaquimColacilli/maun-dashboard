import { useState, type SyntheticEvent } from 'react';

import { cambiarContrasena, mensajeDeAcceso } from '@/shared/api';
import { Button, Campo } from '@/shared/ui';

const LARGO_MINIMO = 6;

interface ErrorDelFormulario {
  campo?: 'contrasena' | 'repetida';
  mensaje: string;
}

export function FormularioDeNuevaContrasena({ alCambiar }: { alCambiar: () => void }) {
  const [contrasena, setContrasena] = useState('');
  const [repetida, setRepetida] = useState('');
  const [error, setError] = useState<ErrorDelFormulario | undefined>(undefined);
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
    if (contrasena !== repetida) {
      setError({ campo: 'repetida', mensaje: 'Las dos contraseñas no coinciden.' });
      return;
    }

    setGuardando(true);
    setError(undefined);
    try {
      await cambiarContrasena(contrasena);
      alCambiar();
    } catch (fallo) {
      setError({ mensaje: mensajeDeAcceso(fallo) });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(evento) => {
        void enviar(evento);
      }}
    >
      <Campo
        etiqueta="Contraseña nueva"
        type="password"
        autoComplete="new-password"
        ayuda={`Al menos ${String(LARGO_MINIMO)} caracteres.`}
        value={contrasena}
        error={error?.campo === 'contrasena' ? error.mensaje : undefined}
        onChange={(evento) => {
          setContrasena(evento.target.value);
        }}
      />
      <Campo
        etiqueta="Repetí la contraseña"
        type="password"
        autoComplete="new-password"
        value={repetida}
        error={error?.campo === 'repetida' ? error.mensaje : undefined}
        onChange={(evento) => {
          setRepetida(evento.target.value);
        }}
      />
      {error !== undefined && error.campo === undefined && (
        <p role="alert" className="text-label font-medium text-alerta">
          {error.mensaje}
        </p>
      )}
      <Button type="submit" cargando={guardando} className="mt-1">
        {guardando ? 'Guardando…' : 'Guardar la contraseña'}
      </Button>
    </form>
  );
}
