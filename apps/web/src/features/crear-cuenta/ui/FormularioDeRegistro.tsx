import { useState, type SyntheticEvent } from 'react';

import { crearCuenta, mensajeDeAcceso } from '@/shared/api';
import { Button, Campo, CampoDeContrasena } from '@/shared/ui';

const MAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const LARGO_MINIMO = 6;

interface ErrorDelFormulario {
  campo?: 'email' | 'contrasena' | 'repetida';
  mensaje: string;
}

export function FormularioDeRegistro() {
  const [email, setEmail] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [repetida, setRepetida] = useState('');
  const [error, setError] = useState<ErrorDelFormulario | undefined>(undefined);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function enviar(evento: SyntheticEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!MAIL.test(email)) {
      setError({
        campo: 'email',
        mensaje: 'Escribí un mail válido: ahí te llega el enlace de confirmación.',
      });
      return;
    }
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

    setEnviando(true);
    setError(undefined);
    try {
      await crearCuenta(email, contrasena, `${window.location.origin}/acceso`);
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
          Le mandamos un enlace de confirmación a <strong className="text-ink">{email}</strong>.
          Abrilo desde este mismo dispositivo: al confirmar se crea tu taller y entrás.
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
      <CampoDeContrasena
        etiqueta="Contraseña"
        autoComplete="new-password"
        ayuda={`Al menos ${String(LARGO_MINIMO)} caracteres.`}
        value={contrasena}
        error={error?.campo === 'contrasena' ? error.mensaje : undefined}
        onChange={(evento) => {
          setContrasena(evento.target.value);
        }}
      />
      <CampoDeContrasena
        etiqueta="Repetí la contraseña"
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
      <Button type="submit" cargando={enviando} className="mt-1">
        {enviando ? 'Creando la cuenta…' : 'Crear la cuenta'}
      </Button>
    </form>
  );
}
