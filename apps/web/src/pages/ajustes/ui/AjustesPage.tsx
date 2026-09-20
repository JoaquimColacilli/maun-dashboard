import { useMutationState } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';

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
import { FormularioDeCobro, FormularioDeConfiguracion } from '@/features/configurar-taller';
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
} from '@/shared/lib';
import { Button, Icono, Pagina, PanelDeAvisos } from '@/shared/ui';

const MUESTRA_DEL_DESENLACE_MS = 6000;

const SECCION =
  'flex min-w-0 max-w-[560px] flex-col gap-3.5 border-t border-hairline pt-5 xl:max-w-none';

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
            <Link
              to={aviso.ruta}
              className="mt-1 inline-block text-label font-semibold underline underline-offset-3"
            >
              Ver «{aviso.sujeto}»
            </Link>
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

      <div className="grid items-start gap-x-10 gap-y-8 xl:grid-cols-2 xl:grid-rows-[auto_1fr]">
        <div
          data-grupo="vos-y-este-dispositivo"
          className="flex min-w-0 flex-col gap-8 xl:col-start-1 xl:row-start-1"
        >
          <section aria-labelledby="titulo-perfil" className={SECCION}>
            <h2 id="titulo-perfil" className="text-section font-semibold">
              Tu perfil
            </h2>
            <FormularioDePerfil />
          </section>

          <section aria-labelledby="titulo-apariencia" className={SECCION}>
            <h2 id="titulo-apariencia" className="text-section font-semibold">
              Apariencia
            </h2>
            <SelectorDeTema />
          </section>

          <section aria-labelledby="titulo-dispositivo" className={SECCION}>
            <h2 id="titulo-dispositivo" className="text-section font-semibold">
              Este dispositivo
            </h2>
            <p className="text-body text-text-2">{describirEstadoSync(estadoSync)}</p>
            <p className="text-label text-text-3 tabular-nums">
              {ultimaSincronizacion(replica.cursor)}
            </p>
            <SincronizarAhora />
          </section>

          <section aria-labelledby="titulo-avisos-de-la-agenda" className={SECCION}>
            <h2 id="titulo-avisos-de-la-agenda" className="text-section font-semibold">
              Avisos de la agenda
            </h2>
            <p className="text-body leading-relaxed text-text-2">
              Un recordatorio a la mañana con las entregas, las visitas y los presupuestos que
              vencen. Se activa en cada dispositivo.
            </p>
            <Link
              to={RUTA_DE_AVISOS}
              className="inline-flex min-h-tap items-center gap-1.5 self-start rounded-field text-body font-semibold underline underline-offset-3"
            >
              <Icono nombre="bell" tamano={18} />
              Configurar los avisos
            </Link>
          </section>

          {esCelular() && (
            <section aria-labelledby="titulo-huella" className={SECCION}>
              <h2 id="titulo-huella" className="text-section font-semibold">
                Entrar con la huella
              </h2>
              <AjusteDeHuella />
            </section>
          )}

          <section aria-labelledby="titulo-rechazos" className={SECCION}>
            <h2 id="titulo-rechazos" className="text-section font-semibold">
              Lo que la base rechazó o ajustó
            </h2>
            <p className="text-label leading-relaxed text-text-2">
              Queda acá hasta que lo descartes, aunque cierres la app.
            </p>
            <Avisos />
          </section>
        </div>

        <div
          data-grupo="el-taller"
          className="flex min-w-0 flex-col gap-8 xl:col-start-2 xl:row-span-2 xl:row-start-1"
        >
          {household && ajustes && (
            <section aria-labelledby="titulo-reparto" className={SECCION}>
              <h2 id="titulo-reparto" className="text-section font-semibold">
                Reparto y metas
              </h2>
              <FormularioDeConfiguracion household={household} ajustes={ajustes} />
            </section>
          )}

          {ajustes && (
            <section aria-labelledby="titulo-cobro" className={SECCION}>
              <h2 id="titulo-cobro" className="text-section font-semibold">
                Cómo te pagan
              </h2>
              <p className="text-body leading-relaxed text-text-2">
                Es la cuenta a la que te transfiere tu cliente. Se cargan una vez y aparecen en la
                página que le compartís, al lado de lo que tiene que pagarte, con un botón para
                copiar cada uno. El titular y el CUIT le sirven para confirmar que es la cuenta
                correcta: su banco le muestra a nombre de quién está antes de confirmar. Recibir una
                transferencia no te cuesta comisión. Todos son opcionales: lo que dejes vacío, no se
                muestra.
              </p>
              <p className="text-body leading-relaxed text-text-2">
                El link de Mercado Pago es aparte y es opcional. Sacalo de tu app, en Cobrar → Link
                de pago → Link sin monto definido: se crea una sola vez y sirve para todos tus
                trabajos. Si lo cargás, tu cliente ve en su página un código QR y un botón que le
                abren Mercado Pago para pagarte desde ahí, sin copiar nada: el monto se lo decimos
                arriba del código y lo escribe él. Ese cobro sí te descuenta comisión de Mercado
                Pago, así que cargalo solo si querés esa comodidad. Mientras esté cargado, la página
                muestra el código en lugar de tu alias.
              </p>
              <FormularioDeCobro ajustes={ajustes} />
            </section>
          )}

          <section aria-labelledby="titulo-cocos" className={SECCION}>
            <h2 id="titulo-cocos" className="text-section font-semibold">
              Corregir el saldo de Cocos
            </h2>
            <AjusteDeCocos saldo={saldosDeLaReplica(replica).cocos} />
          </section>

          <section aria-labelledby="titulo-espacio" className={SECCION}>
            <h2 id="titulo-espacio" className="text-section font-semibold">
              Espacio para archivos
            </h2>
            <p className="text-body leading-relaxed text-text-2 tabular-nums">
              Las fotos y los PDF de los trabajos ocupan{' '}
              <span className="whitespace-nowrap">{pesoLegible(usado)}</span> de{' '}
              <span className="whitespace-nowrap">{pesoLegible(ESPACIO_DEL_PLAN_BYTES)}</span>.
            </p>
            {usado >= ESPACIO_PARA_AVISAR_BYTES && (
              <p className="text-label leading-relaxed font-medium text-atencion">
                Se está llenando. Cuando llegue a 1 GB no se van a poder subir más archivos, y
                pasado ese límite la app entera puede dejar de andar. Avisale a quien te mantiene la
                app antes de que se llene.
              </p>
            )}
          </section>
        </div>

        <section
          aria-labelledby="titulo-cuenta"
          className={`${SECCION} items-start xl:col-start-1 xl:row-start-2`}
        >
          <h2 id="titulo-cuenta" className="text-section font-semibold">
            Cuenta
          </h2>
          <BotonSalir />
        </section>

        <section
          aria-labelledby="titulo-version"
          className={`${SECCION} items-start xl:col-start-1 xl:row-start-3`}
        >
          <h2 id="titulo-version" className="text-section font-semibold">
            Versión de la app
          </h2>
          <VersionDeLaApp
            conInvitacion
            className="flex min-h-tap flex-col items-start justify-center gap-0.5 rounded-field text-left text-body text-text-2"
          />
        </section>
      </div>
    </Pagina>
  );
}
