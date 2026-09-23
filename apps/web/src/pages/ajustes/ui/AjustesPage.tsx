import { useMutationState } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import {
  ESPACIO_DEL_PLAN_BYTES,
  ESPACIO_PARA_AVISAR_BYTES,
  espacioUsado,
  pesoLegible,
} from '@/entities/archivo';
import {
  describirDesenlace,
  useReplicaDelTaller,
  useSincronizarAhora,
  type DesenlaceDeLaSincronizacion,
} from '@/entities/replica';
import { useSesionActiva } from '@/entities/sesion';
import { AjusteDeHuella } from '@/features/activar-huella';
import { AjusteDeCocos } from '@/features/ajustar-cocos';
import { BotonSalir } from '@/features/cerrar-sesion';
import {
  FormularioDeCobro,
  FormularioDeConfiguracion,
  FormularioDeResena,
} from '@/features/configurar-taller';
import { FormularioDePerfil } from '@/features/editar-perfil';
import { SelectorDeTema } from '@/features/elegir-tema';
import { VersionDeLaApp } from '@/features/ver-novedades';
import { ajustesDe, householdDe, mensajeDeSincronizacion, saldosDeLaReplica } from '@/shared/api';
import {
  describirEstadoSync,
  esCelular,
  RUTA_DE_AVISOS,
  useAvisos,
  useEstadoSync,
  Ir,
} from '@/shared/lib';
import { Button, Icono, Pagina, PanelDeAvisos, SeccionEnFila, SeccionesEnFilas } from '@/shared/ui';

const MUESTRA_DEL_DESENLACE_MS = 6000;

const FORMATO_DE_LA_SINCRONIZACION = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});

function ultimaSincronizacion(valor: string): string {
  const marca = Date.parse(valor);
  if (Number.isNaN(marca)) return 'Todavía no se sincronizó con el servidor.';
  const cuando = FORMATO_DE_LA_SINCRONIZACION.format(new Date(marca));
  return `Última sincronización: ${cuando}${cuando.endsWith('.') ? '' : '.'}`;
}

function SincronizarAhora() {
  const { usuarioId } = useSesionActiva();
  const sincronizarAhora = useSincronizarAhora(usuarioId);
  const [sincronizando, setSincronizando] = useState(false);
  const [desenlace, setDesenlace] = useState<DesenlaceDeLaSincronizacion | null>(null);

  useEffect(() => {
    if (desenlace === null) return;
    const reloj = setTimeout(() => {
      setDesenlace(null);
    }, MUESTRA_DEL_DESENLACE_MS);
    return () => {
      clearTimeout(reloj);
    };
  }, [desenlace]);

  const descripcion = desenlace === null ? null : describirDesenlace(desenlace);

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        variant="secundario"
        size="chico"
        disabled={sincronizando}
        onClick={() => {
          setSincronizando(true);
          setDesenlace(null);
          void sincronizarAhora().then((resultado) => {
            setDesenlace(resultado);
            setSincronizando(false);
          });
        }}
      >
        <Icono
          nombre="refresh-cw"
          tamano={16}
          className={sincronizando ? 'motion-safe:animate-maun-spin' : undefined}
        />
        {sincronizando ? 'Sincronizando…' : 'Sincronizar ahora'}
      </Button>
      <p aria-live="polite" className="flex items-start gap-1.5 text-label text-text-2">
        {descripcion && (
          <>
            <Icono nombre={descripcion.icono} tamano={15} className="mt-px flex-none" />
            {descripcion.texto}
          </>
        )}
      </p>
    </div>
  );
}

function RechazosDeLaCola() {
  const rechazos = useMutationState({
    filters: { status: 'error' },
    select: (mutacion) => ({ id: mutacion.mutationId, error: mutacion.state.error }),
  });

  if (rechazos.length === 0) return null;

  return (
    <ul className="flex flex-col">
      {rechazos.map((rechazo) => (
        <li
          key={rechazo.id}
          className="border-t border-hairline-soft py-2.5 text-body leading-relaxed text-alerta"
        >
          {mensajeDeSincronizacion(rechazo.error)}
        </li>
      ))}
    </ul>
  );
}

function Avisos() {
  const avisos = useAvisos();
  const rechazos = useMutationState({ filters: { status: 'error' }, select: () => true });

  if (avisos.length === 0 && rechazos.length === 0) {
    return <p className="text-body text-text-2">No hay nada rechazado ni ajustado.</p>;
  }

  return (
    <>
      <PanelDeAvisos avisos={avisos}>
        {(aviso) =>
          aviso.ruta === null ? null : (
            <Ir
              a={aviso.ruta}
              className="mt-1 inline-block text-label font-semibold underline underline-offset-3"
            >
              Ver «{aviso.sujeto}»
            </Ir>
          )
        }
      </PanelDeAvisos>
      <RechazosDeLaCola />
    </>
  );
}

export function AjustesPage() {
  const replica = useReplicaDelTaller();
  const estadoSync = useEstadoSync();
  const household = householdDe(replica);
  const ajustes = ajustesDe(replica);
  const usado = espacioUsado(replica);

  return (
    <Pagina className="gap-5">
      <header className="flex min-h-button flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-h1 leading-tight lg:text-h1-lg">Ajustes</h1>
      </header>

      <SeccionesEnFilas>
        <SeccionEnFila id="titulo-perfil" titulo="Tu perfil">
          <FormularioDePerfil />
        </SeccionEnFila>

        <SeccionEnFila id="titulo-apariencia" titulo="Apariencia">
          <SelectorDeTema />
        </SeccionEnFila>

        <SeccionEnFila id="titulo-dispositivo" titulo="Este dispositivo">
          <p className="text-body text-text-2">{describirEstadoSync(estadoSync)}</p>
          <p className="text-label text-text-3 tabular-nums">
            {ultimaSincronizacion(replica.cursor)}
          </p>
          <SincronizarAhora />
        </SeccionEnFila>

        <SeccionEnFila id="titulo-avisos-de-la-agenda" titulo="Avisos de la agenda">
          <p className="max-w-[42rem] text-body leading-relaxed text-text-2">
            Un recordatorio a la mañana con las entregas, las visitas y los presupuestos que vencen.
            Se activa en cada dispositivo.
          </p>
          <Ir
            a={RUTA_DE_AVISOS}
            className="inline-flex min-h-tap items-center gap-1.5 self-start rounded-field text-body font-semibold underline underline-offset-3"
          >
            <Icono nombre="bell" tamano={18} />
            Configurar los avisos
          </Ir>
        </SeccionEnFila>

        {esCelular() && (
          <SeccionEnFila id="titulo-huella" titulo="Entrar con la huella">
            <AjusteDeHuella />
          </SeccionEnFila>
        )}

        <SeccionEnFila
          id="titulo-rechazos"
          titulo="Lo que la base rechazó o ajustó"
          bajada={
            <p className="text-label leading-relaxed text-text-2">
              Queda acá hasta que lo descartes, aunque cierres la app.
            </p>
          }
        >
          <Avisos />
        </SeccionEnFila>

        {household && ajustes && (
          <SeccionEnFila id="titulo-reparto" titulo="Reparto y metas">
            <FormularioDeConfiguracion household={household} ajustes={ajustes} />
          </SeccionEnFila>
        )}

        {ajustes && (
          <SeccionEnFila id="titulo-cobro" titulo="Cómo te pagan">
            <p className="max-w-[42rem] text-body leading-relaxed text-text-2">
              Es la cuenta a la que te transfiere tu cliente. Se cargan una vez y aparecen en la
              página que le compartís, al lado de lo que tiene que pagarte, con un botón para copiar
              cada uno. El titular y el CUIT le sirven para confirmar que es la cuenta correcta: su
              banco le muestra a nombre de quién está antes de confirmar. Recibir una transferencia
              no te cuesta comisión. Todos son opcionales: lo que dejes vacío, no se muestra.
            </p>
            <p className="max-w-[42rem] text-body leading-relaxed text-text-2">
              El link de Mercado Pago es aparte y es opcional. Sacalo de tu app, en Cobrar → Link de
              pago → Link sin monto definido: se crea una sola vez y sirve para todos tus trabajos.
              Si lo cargás, tu cliente ve en su página un botón que le abre Mercado Pago para
              pagarte desde ahí, sin copiar nada: el monto se lo decimos arriba y lo escribe él. Va
              después de tu alias, que es la forma que no te cuesta comisión.
            </p>
            <FormularioDeCobro ajustes={ajustes} />
          </SeccionEnFila>
        )}

        {ajustes && (
          <SeccionEnFila id="titulo-resenas" titulo="Reseñas en Google">
            <p className="max-w-[42rem] text-body leading-relaxed text-text-2">
              Cuando un cliente termina la encuesta, le pedimos que deje su opinión también en
              Google. Se le pide a todos, contesten lo que contesten: pedírsela solo a los que
              quedaron contentos va contra las reglas de Google, que pueden borrar las reseñas del
              taller. Si no cargás el enlace, ese pedido no aparece.
            </p>
            <FormularioDeResena ajustes={ajustes} />
          </SeccionEnFila>
        )}

        <SeccionEnFila id="titulo-cocos" titulo="Corregir el saldo de Cocos">
          <AjusteDeCocos saldo={saldosDeLaReplica(replica).cocos} />
        </SeccionEnFila>

        <SeccionEnFila id="titulo-espacio" titulo="Espacio para archivos">
          <p className="text-body leading-relaxed text-text-2 tabular-nums">
            Las fotos y los PDF de los trabajos ocupan{' '}
            <span className="whitespace-nowrap">{pesoLegible(usado)}</span> de{' '}
            <span className="whitespace-nowrap">{pesoLegible(ESPACIO_DEL_PLAN_BYTES)}</span>.
          </p>
          {usado >= ESPACIO_PARA_AVISAR_BYTES && (
            <p className="text-label leading-relaxed font-medium text-atencion">
              Se está llenando. Cuando llegue a 1 GB no se van a poder subir más archivos, y pasado
              ese límite la app entera puede dejar de andar. Avisale a quien te mantiene la app
              antes de que se llene.
            </p>
          )}
        </SeccionEnFila>

        <SeccionEnFila id="titulo-cuenta" titulo="Cuenta" cuerpo="items-start">
          <BotonSalir />
        </SeccionEnFila>

        <SeccionEnFila id="titulo-version" titulo="Versión de la app" cuerpo="items-start">
          <VersionDeLaApp
            conInvitacion
            className="flex min-h-tap flex-col items-start justify-center gap-0.5 rounded-field text-left text-body text-text-2"
          />
        </SeccionEnFila>
      </SeccionesEnFilas>
    </Pagina>
  );
}
