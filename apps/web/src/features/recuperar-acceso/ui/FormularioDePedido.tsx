import { useState, type SyntheticEvent } from 'react';

import { mensajeDeAcceso, pedirRecuperacion } from '@/shared/api';
import { Button, Campo } from '@/shared/ui';

const MAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const RUTA_DE_NUEVA_CONTRASENA = '/acceso/nueva-contrasena';

interface ErrorDelFormulario {
  campo?: 'email';
  mensaje: string;
}

export function FormularioDePedido({
  emailInicial = '',
  alPedir,
}: {
  emailInicial?: string;
  alPedir: (email: string) => void;
}) {
  const [email, setEmail] = useState(emailInicial);
  const [error, setError] = useState<ErrorDelFormulario | undefined>(undefined);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: SyntheticEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!MAIL.test(email)) {
      setError({ campo: 'email', mensaje: 'Escribí un mail válido.' });
      return;
    }

    setEnviando(true);
    setError(undefined);
    try {
      await pedirRecuperacion(email, `${window.location.origin}${RUTA_DE_NUEVA_CONTRASENA}`);
      alPedir(email);
    } catch (fallo) {
      setError({ mensaje: mensajeDeAcceso(fallo) });
      setEnviando(false);
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
      <Campo
        etiqueta="Email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="username"
        value={email}
        error={error?.campo === 'email' ? error.mensaje : undefined}
        onChange={(evento) => {
          setEmail(evento.target.value);
        }}
        placeholder="vos@taller.com.ar"
      />
      {error !== undefined && error.campo === undefined && (
        <p role="alert" className="text-label leading-relaxed font-medium text-alerta">
          {error.mensaje}
        </p>
      )}
      <Button type="submit" size="grande" cargando={enviando} className="mt-1 w-full">
        {enviando ? 'Mandando el enlace…' : 'Mandarme el enlace'}
      </Button>
    </form>
  );
}
