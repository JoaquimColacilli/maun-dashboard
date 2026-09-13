import { useEffect, useState, type ReactNode, type SyntheticEvent } from 'react';

import {
  codigoDeAcceso,
  entrar,
  esFalloDeRed,
  esperarHuellaDelAutocompletado,
  mensajeDeAcceso,
  reenviarConfirmacion,
} from '@/shared/api';
import { Button, Campo, CampoDeContrasena } from '@/shared/ui';

const MAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const SIN_SENAL_PARA_ENTRAR =
  'Sin señal no se puede entrar: la cuenta se verifica contra el servidor. Una vez adentro, la app anda aunque no haya señal.';

interface ErrorDelFormulario {
  campo?: 'email' | 'contrasena';
  mensaje: string;
}

function ReenvioDeConfirmacion({ email }: { email: string }) {
  const [mandando, setMandando] = useState(false);
  const [resultado, setResultado] = useState<{ error: boolean; texto: string } | undefined>(
    undefined,
  );

  async function mandar(): Promise<void> {
    setMandando(true);
    setResultado(undefined);
    try {
      await reenviarConfirmacion(email, `${window.location.origin}/acceso`);
      setResultado({ error: false, texto: `Te mandamos el enlace de nuevo a ${email}.` });
    } catch (fallo) {
      setResultado({ error: true, texto: mensajeDeAcceso(fallo) });
    } finally {
      setMandando(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        variant="secundario"
        size="chico"
        cargando={mandando}
        onClick={() => {
          void mandar();
        }}
      >
        {mandando ? 'Mandándolo…' : 'Mandarme el enlace de nuevo'}
      </Button>
      {resultado !== undefined && (
        <p
          role={resultado.error ? 'alert' : 'status'}
          className={`text-label leading-relaxed ${resultado.error ? 'font-medium text-alerta' : 'text-text-2'}`}
        >
          {resultado.texto}
        </p>
      )}
    </div>
  );
}

export function FormularioDeIngreso({ olvido }: { olvido?: ReactNode }) {
  const [email, setEmail] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState<ErrorDelFormulario | undefined>(undefined);
  const [sinConfirmar, setSinConfirmar] = useState(false);
  const [entrando, setEntrando] = useState(false);

  useEffect(() => {
    const control = new AbortController();
    esperarHuellaDelAutocompletado(control.signal).catch((fallo: unknown) => {
      if (control.signal.aborted) return;
      setError({ mensaje: esFalloDeRed(fallo) ? SIN_SENAL_PARA_ENTRAR : mensajeDeAcceso(fallo) });
    });
    return () => {
      control.abort();
    };
  }, []);

  async function enviar(evento: SyntheticEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSinConfirmar(false);
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
      setError({ mensaje: esFalloDeRed(fallo) ? SIN_SENAL_PARA_ENTRAR : mensajeDeAcceso(fallo) });
      setSinConfirmar(codigoDeAcceso(fallo) === 'email_not_confirmed');
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
        autoComplete="username webauthn"
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
        <div className="flex flex-col gap-2.5">
          <p role="alert" className="text-label leading-relaxed font-medium text-alerta">
            {error.mensaje}
          </p>
          {sinConfirmar && <ReenvioDeConfirmacion email={email} />}
        </div>
      )}
      <Button type="submit" size="grande" cargando={entrando} className="mt-1 w-full">
        {entrando ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  );
}
