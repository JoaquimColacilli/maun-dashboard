import { useState, type SyntheticEvent } from 'react';

import { crearCuenta, mensajeDeAcceso } from '@/shared/api';
import { Button, Campo, CampoDeContrasena } from '@/shared/ui';

const MAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const LARGO_MINIMO = 6;

export const RUTA_DE_CONFIRMACION = '/acceso';

interface ErrorDelFormulario {
  campo?: 'email' | 'contrasena';
  mensaje: string;
}

export function FormularioDeRegistro({
  emailInicial = '',
  alCrear,
}: {
  emailInicial?: string;
  alCrear: (email: string) => void;
}) {
  const [email, setEmail] = useState(emailInicial);
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState<ErrorDelFormulario | undefined>(undefined);
  const [enviando, setEnviando] = useState(false);

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

    setEnviando(true);
    setError(undefined);
    try {
      await crearCuenta(email, contrasena, `${window.location.origin}${RUTA_DE_CONFIRMACION}`);
      alCrear(email);
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
      <CampoDeContrasena
        etiqueta="Contraseña"
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
      <Button type="submit" size="grande" cargando={enviando} className="mt-1 w-full">
        {enviando ? 'Creando la cuenta…' : 'Crear la cuenta'}
      </Button>
    </form>
  );
}
