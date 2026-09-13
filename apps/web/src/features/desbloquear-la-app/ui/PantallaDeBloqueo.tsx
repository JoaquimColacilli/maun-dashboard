import { useEffect, useRef, useState, type SyntheticEvent } from 'react';

import { useNombreDeLaPersona, useSesionActiva } from '@/entities/sesion';
import { entrar, esFalloDeRed, mensajeDeAcceso, pedirRecuperacion } from '@/shared/api';
import {
  anotarCredencial,
  bloqueoDe,
  marcarDesbloqueada,
  pedirHuella,
  useEstadoSync,
} from '@/shared/lib';
import { Button, CampoDeContrasena, ENLACE_DE_CAMPO, Icono, PantallaDeAcceso } from '@/shared/ui';

type Fase = 'huella' | 'contrasena' | 'sin-huella';

const RUTA_DEL_ENLACE = '/acceso/nueva-contrasena';

const NOTA =
  'La app se abre pidiendo la huella porque lo activaste en este teléfono. Se cambia en Ajustes.';

const SIN_SENAL_PARA_LA_CONTRASENA =
  'Sin señal no se puede entrar con la contraseña: se verifica contra el servidor. Probá con la huella.';

async function desenlaceDeLaHuella(usuarioId: string, signal: AbortSignal): Promise<Fase | null> {
  const resultado = await pedirHuella(bloqueoDe(usuarioId)?.credencial ?? null, signal);
  if (signal.aborted) return null;
  if (resultado.tipo === 'confirmada') {
    anotarCredencial(usuarioId, resultado.credencial);
    marcarDesbloqueada();
    return null;
  }
  return resultado.tipo === 'no-disponible' ? 'sin-huella' : 'contrasena';
}

function saludo(nombre: string): string {
  const primero = nombre.trim().split(/\s+/)[0] ?? '';
  return primero === '' ? 'Hola' : `Hola, ${primero}`;
}

function FormularioDeContrasena({
  email,
  alProbarHuella,
}: {
  email: string;
  alProbarHuella: () => void;
}) {
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState<{ campo?: 'contrasena'; mensaje: string } | undefined>(
    undefined,
  );
  const [entrando, setEntrando] = useState(false);
  const [enlace, setEnlace] = useState<{ error: boolean; texto: string } | undefined>(undefined);

  async function enviar(evento: SyntheticEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault();
    if (contrasena === '') {
      setError({ campo: 'contrasena', mensaje: 'Escribí tu contraseña.' });
      return;
    }
    setEntrando(true);
    setError(undefined);
    try {
      await entrar(email, contrasena);
      marcarDesbloqueada();
    } catch (fallo) {
      setError({
        mensaje: esFalloDeRed(fallo) ? SIN_SENAL_PARA_LA_CONTRASENA : mensajeDeAcceso(fallo),
      });
      setEntrando(false);
    }
  }

  async function pedirEnlace(): Promise<void> {
    setEnlace(undefined);
    try {
      await pedirRecuperacion(email, `${window.location.origin}${RUTA_DEL_ENLACE}`);
      setEnlace({
        error: false,
        texto: `Te mandamos un enlace a ${email} para poner una contraseña nueva. Abrilo desde este teléfono.`,
      });
    } catch (fallo) {
      setEnlace({ error: true, texto: mensajeDeAcceso(fallo) });
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
      <input type="hidden" name="username" autoComplete="username" value={email} />
      <CampoDeContrasena
        etiqueta="Contraseña"
        name="password"
        autoComplete="current-password"
        accesorio={
          <button
            type="button"
            className={ENLACE_DE_CAMPO}
            onClick={() => {
              void pedirEnlace();
            }}
          >
            ¿La olvidaste?
          </button>
        }
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
      {enlace !== undefined && (
        <p
          role={enlace.error ? 'alert' : 'status'}
          className={`text-label leading-relaxed ${enlace.error ? 'font-medium text-alerta' : 'text-text-2'}`}
        >
          {enlace.texto}
        </p>
      )}
      <Button type="submit" size="grande" cargando={entrando} className="mt-1 w-full">
        {entrando ? 'Entrando…' : 'Entrar'}
      </Button>
      <Button variant="secundario" size="grande" className="w-full" onClick={alProbarHuella}>
        <Icono nombre="fingerprint" tamano={20} />
        Probar con la huella
      </Button>
    </form>
  );
}

export function PantallaDeBloqueo() {
  const { usuarioId, email, foto } = useSesionActiva();
  const nombre = useNombreDeLaPersona();
  const sinSenal = useEstadoSync().tipo === 'sin-conexion';
  const [fase, setFase] = useState<Fase>('huella');
  const pedido = useRef<AbortController | null>(null);

  useEffect(() => {
    const control = new AbortController();
    pedido.current = control;
    void desenlaceDeLaHuella(usuarioId, control.signal).then((siguiente) => {
      if (siguiente !== null) setFase(siguiente);
    });
    return () => {
      control.abort();
    };
  }, [usuarioId]);

  function probarHuella(): void {
    pedido.current?.abort();
    const control = new AbortController();
    pedido.current = control;
    setFase('huella');
    void desenlaceDeLaHuella(usuarioId, control.signal).then((siguiente) => {
      if (siguiente !== null) setFase(siguiente);
    });
  }

  function usarContrasena(): void {
    pedido.current?.abort();
    setFase('contrasena');
  }

  const persona = { nombre, email, foto };

  if (fase === 'huella') {
    return (
      <PantallaDeAcceso
        titulo={saludo(nombre)}
        bajada="Tocá el sensor de huella para abrir el taller."
        persona={persona}
        nota={NOTA}
      >
        <div className="flex flex-col gap-3">
          <p role="status" className="flex min-h-tap items-center gap-3 text-body text-text-2">
            <Icono nombre="fingerprint" tamano={26} className="flex-none text-ink" />
            Esperando la huella…
          </p>
          <Button size="grande" className="w-full" onClick={probarHuella}>
            <Icono nombre="fingerprint" tamano={20} />
            Usar la huella
          </Button>
          <Button variant="terciario" className="-ml-3 self-start" onClick={usarContrasena}>
            Entrar con la contraseña
          </Button>
        </div>
      </PantallaDeAcceso>
    );
  }

  return (
    <PantallaDeAcceso
      titulo={saludo(nombre)}
      bajada={
        fase === 'sin-huella'
          ? 'No pudimos usar la huella en este teléfono.'
          : 'La huella no se confirmó. Probala otra vez o entrá con tu contraseña.'
      }
      persona={persona}
      nota={NOTA}
    >
      {sinSenal ? (
        <div className="flex flex-col gap-3">
          <div
            role="alert"
            className="flex flex-col gap-1 rounded-field bg-atencion-tint px-3.5 py-3 text-label leading-relaxed text-atencion"
          >
            <p className="font-semibold">Sin señal solo podés entrar con la huella.</p>
            <p>
              {fase === 'sin-huella'
                ? 'La huella de este teléfono no respondió. Cuando vuelva la señal vas a poder entrar con tu contraseña.'
                : 'Cuando vuelva la señal también vas a poder entrar con tu contraseña.'}
            </p>
          </div>
          <Button size="grande" className="w-full" onClick={probarHuella}>
            <Icono nombre="fingerprint" tamano={20} />
            Probar con la huella
          </Button>
        </div>
      ) : (
        <FormularioDeContrasena email={email} alProbarHuella={probarHuella} />
      )}
    </PantallaDeAcceso>
  );
}
