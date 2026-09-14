import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  type ReactNode,
  type SyntheticEvent,
} from 'react';

import { useNombreDeLaPersona, useSesionActiva } from '@/entities/sesion';
import { entrar, esFalloDeRed, mensajeDeAcceso, pedirRecuperacion } from '@/shared/api';
import {
  anotarCredencial,
  bloqueoDe,
  marcarDesbloqueada,
  pedirHuella,
  useEstadoSync,
  type ResultadoDeLaHuella,
} from '@/shared/lib';
import { Button, CampoDeContrasena, ENLACE_DE_CAMPO, Icono, PantallaDeAcceso } from '@/shared/ui';

import {
  FASE_INICIAL,
  siguienteFase,
  type MotivoDelFormulario,
  type OrigenDelPedido,
} from '../model/fase';

const RUTA_DEL_ENLACE = '/acceso/nueva-contrasena';

const NOTA =
  'La app se abre pidiendo la huella porque lo activaste en este teléfono. Se cambia en Ajustes.';

const SIN_SENAL_PARA_LA_CONTRASENA =
  'Sin señal no se puede entrar con la contraseña: se verifica contra el servidor. Probá con la huella.';

const BAJADA: Readonly<Record<MotivoDelFormulario, string>> = {
  'eligio-la-contrasena': 'Entrá con tu contraseña, o probá otra vez con la huella.',
  'no-se-confirmo': 'La huella no se confirmó. Probala otra vez o entrá con tu contraseña.',
  'sin-respuesta':
    'El pedido de la huella no respondió. Probala otra vez o entrá con tu contraseña.',
  'no-disponible': 'No pudimos usar la huella en este teléfono.',
  interrumpida: 'Probá otra vez con la huella o entrá con tu contraseña.',
};

function conElFoco(signal: AbortSignal): Promise<boolean> {
  if (document.hasFocus()) return Promise.resolve(true);
  return new Promise((resolver) => {
    const listo = () => {
      globalThis.removeEventListener('focus', listo);
      signal.removeEventListener('abort', listo);
      resolver(!signal.aborted);
    };
    globalThis.addEventListener('focus', listo);
    signal.addEventListener('abort', listo);
  });
}

async function desenlaceDeLaHuella(
  usuarioId: string,
  signal: AbortSignal,
): Promise<ResultadoDeLaHuella> {
  if (!(await conElFoco(signal))) return { tipo: 'interrumpida' };
  const resultado = await pedirHuella(bloqueoDe(usuarioId)?.credencial ?? null, signal);
  if (resultado.tipo === 'confirmada') {
    anotarCredencial(usuarioId, resultado.credencial);
    marcarDesbloqueada();
  }
  return resultado;
}

function saludo(nombre: string): string {
  const primero = nombre.trim().split(/\s+/)[0] ?? '';
  return primero === '' ? 'Hola' : `Hola, ${primero}`;
}

function BotonDeLaHuella({ pidiendo, alTocar }: { pidiendo: boolean; alTocar: () => void }) {
  return (
    <Button
      variant="secundario"
      size="grande"
      className="w-full"
      cargando={pidiendo}
      onClick={alTocar}
    >
      {!pidiendo && <Icono nombre="fingerprint" tamano={20} />}
      {pidiendo ? 'Esperando la huella…' : 'Probar con la huella'}
    </Button>
  );
}

function FormularioDeContrasena({
  email,
  pidiendo,
  alProbarHuella,
}: {
  email: string;
  pidiendo: boolean;
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
      <BotonDeLaHuella pidiendo={pidiendo} alTocar={alProbarHuella} />
    </form>
  );
}

export function PantallaDeBloqueo({ otraCuenta }: { otraCuenta?: ReactNode }) {
  const { usuarioId, email, foto } = useSesionActiva();
  const nombre = useNombreDeLaPersona();
  const sinSenal = useEstadoSync().tipo === 'sin-conexion';
  const [fase, despachar] = useReducer(siguienteFase, FASE_INICIAL);
  const intentos = useRef(0);
  const pedidos = useRef(new Set<AbortController>());

  const cortarLosPedidos = useCallback(() => {
    for (const pedido of pedidos.current) pedido.abort();
    pedidos.current.clear();
  }, []);

  const pedir = useCallback(
    (origen: OrigenDelPedido) => {
      cortarLosPedidos();
      const pedido = new AbortController();
      pedidos.current.add(pedido);
      intentos.current += 1;
      const intento = intentos.current;
      despachar({ tipo: 'pedir', origen, intento });
      void desenlaceDeLaHuella(usuarioId, pedido.signal).then((resultado) => {
        pedidos.current.delete(pedido);
        despachar({ tipo: 'resultado', intento, resultado: resultado.tipo });
      });
    },
    [usuarioId, cortarLosPedidos],
  );

  useEffect(() => {
    pedir('al-abrir');
    return cortarLosPedidos;
  }, [pedir, cortarLosPedidos]);

  function usarContrasena(): void {
    cortarLosPedidos();
    despachar({ tipo: 'usar-la-contrasena' });
  }

  const persona = { nombre, email, foto };
  const motivo = fase.tipo === 'formulario' || fase.tipo === 'pidiendo' ? fase.motivo : null;

  if (motivo === null) {
    return (
      <PantallaDeAcceso
        titulo={saludo(nombre)}
        bajada="Tocá el sensor de huella para abrir el taller."
        persona={persona}
        nota={NOTA}
        pie={otraCuenta}
      >
        <div className="flex flex-col gap-3">
          <p role="status" className="flex min-h-tap items-center gap-3 text-body text-text-2">
            <Icono nombre="fingerprint" tamano={26} className="flex-none text-ink" />
            Esperando la huella…
          </p>
          <Button
            size="grande"
            className="w-full"
            onClick={() => {
              pedir('usuario');
            }}
          >
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

  const pidiendo = fase.tipo === 'pidiendo';
  const probarHuella = () => {
    pedir('usuario');
  };

  return (
    <PantallaDeAcceso
      titulo={saludo(nombre)}
      bajada={BAJADA[motivo]}
      persona={persona}
      nota={NOTA}
      pie={otraCuenta}
    >
      {sinSenal ? (
        <div className="flex flex-col gap-3">
          <div
            role="alert"
            className="flex flex-col gap-1 rounded-field bg-atencion-tint px-3.5 py-3 text-label leading-relaxed text-atencion"
          >
            <p className="font-semibold">Sin señal solo podés entrar con la huella.</p>
            <p>
              {motivo === 'no-disponible'
                ? 'La huella de este teléfono no respondió. Cuando vuelva la señal vas a poder entrar con tu contraseña.'
                : 'Cuando vuelva la señal también vas a poder entrar con tu contraseña.'}
            </p>
          </div>
          <BotonDeLaHuella pidiendo={pidiendo} alTocar={probarHuella} />
        </div>
      ) : (
        <FormularioDeContrasena email={email} pidiendo={pidiendo} alProbarHuella={probarHuella} />
      )}
    </PantallaDeAcceso>
  );
}
