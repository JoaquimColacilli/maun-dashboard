import { useState, type ReactNode, type SyntheticEvent } from 'react';

import { entrar, mensajeDeAcceso } from '@/shared/api';
import { Button, Campo, CampoDeContrasena } from '@/shared/ui';

const MAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

interface ErrorDelFormulario {
  campo?: 'email' | 'contrasena';
  mensaje: string;
}

export function FormularioDeIngreso({ olvido }: { olvido?: ReactNode }) {
  const [email, setEmail] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState<ErrorDelFormulario | undefined>(undefined);
  const [entrando, setEntrando] = useState(false);

  async function enviar(evento: SyntheticEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!MAIL.test(email)) {
      setError({ campo: 'email', mensaje: 'Escribí un mail válido.' });
      return;
    }
    if (contrasena === '') {
      setError({ campo: 'contrasena', mensaje: 'Escribí tu contraseña.' });
      return;
    }

    setEntrando(true);
    setError(undefined);
    try {
      await entrar(email, contrasena);
    } catch (fallo) {
      setError({ mensaje: mensajeDeAcceso(fallo) });
    } finally {
      setEntrando(false);
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
        name="password"
        autoComplete="current-password"
        accesorio={olvido}
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
      <Button type="submit" size="grande" cargando={entrando} className="mt-1 w-full">
        {entrando ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  );
}
