import { useState, type SyntheticEvent } from 'react';

import { mensajeDeAcceso, pedirRecuperacion } from '@/shared/api';
import { Button, Campo } from '@/shared/ui';

const MAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const RUTA_DE_NUEVA_CONTRASENA = '/acceso/nueva-contrasena';

interface ErrorDelFormulario {
  campo?: 'email';
  mensaje: string;
}

export function FormularioDePedido() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<ErrorDelFormulario | undefined>(undefined);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

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
      setEnviado(true);
    } catch (fallo) {
      setError({ mensaje: mensajeDeAcceso(fallo) });
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <div className="flex flex-col gap-3 rounded-panel border border-hairline p-4">
        <h2 className="text-section font-semibold">Revisá tu correo</h2>
        <p className="text-body leading-relaxed text-text-2">
          Si hay una cuenta con <strong className="text-ink">{email}</strong>, le mandamos un enlace
          para poner una contraseña nueva. Abrilo desde este mismo dispositivo.
        </p>
        <p className="text-meta leading-relaxed text-text-3">
          Si no llega, fijate en el correo no deseado. El servidor de mails del proyecto manda pocos
          por hora: si pediste varios seguidos, esperá un rato antes de volver a intentar.
        </p>
      </div>
    );
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
        etiqueta="Email"
        type="email"
        inputMode="email"
        autoComplete="email"
        value={email}
        error={error?.campo === 'email' ? error.mensaje : undefined}
        onChange={(evento) => {
          setEmail(evento.target.value);
        }}
        placeholder="vos@taller.com.ar"
      />
      {error !== undefined && error.campo === undefined && (
        <p role="alert" className="text-label font-medium text-alerta">
          {error.mensaje}
        </p>
      )}
      <Button type="submit" cargando={enviando} className="mt-1">
        {enviando ? 'Mandando el enlace…' : 'Mandarme el enlace'}
      </Button>
    </form>
  );
}
