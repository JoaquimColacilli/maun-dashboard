import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { archivosDelProyecto, loQueVeElCliente } from '@/entities/archivo';
import {
  enlaceActivo,
  MUTACION_DE_BAJA_DE_ENLACE,
  MUTACION_DE_ENLACE,
  vecesQueLoAbrio,
} from '@/entities/enlace';
import { rutaDelProyecto, type ResumenDeProyecto } from '@/entities/proyecto';
import { useReplicaDelTaller } from '@/entities/replica';
import { AyudaDeLaVista } from '@/entities/vista-cliente';
import { filasDe, mensajeDeSincronizacion } from '@/shared/api';
import {
  fechaLarga,
  hashDelToken,
  hoyLocal,
  metaDeAvisos,
  olvidarToken,
  recordarToken,
  rutaDeLaVistaDelCliente,
  tokenNuevo,
  useEstadoSync,
  uuidv7,
} from '@/shared/lib';
import { Button, ConSalida, FilaDeAcciones, Hoja, Icono, Pagina } from '@/shared/ui';

import { comoSeVeElEnlace, enlaceDeWhatsapp, mensajeParaElCliente } from '../model/compartir';
import { ArchivosQueVeElCliente } from './ArchivosQueVeElCliente';

export interface PantallaDeCompartirProps {
  resumen: ResumenDeProyecto;
}

const COPIADO_MS = 2_200;

export function PantallaDeCompartir({ resumen }: PantallaDeCompartirProps) {
  const replica = useReplicaDelTaller();
  const navegar = useNavigate();
  const { proyecto, cliente } = resumen;
  const hoy = hoyLocal();
  const sync = useEstadoSync();
  const sinSenal = sync.tipo === 'sin-conexion';

  const generar = useMutation({
    ...MUTACION_DE_ENLACE,
    meta: metaDeAvisos('enlaceDelCliente', { errorEnPantalla: true }),
  });
  const darDeBaja = useMutation({
    ...MUTACION_DE_BAJA_DE_ENLACE,
    meta: metaDeAvisos('bajaDelEnlace', { errorEnPantalla: true }),
  });
  const [rechazo, setRechazo] = useState<unknown>(null);
  const [copiado, setCopiado] = useState(false);
  const [preguntandoLaBaja, setPreguntandoLaBaja] = useState(false);

  const activo = enlaceActivo(replica, proyecto.id);
  const huboAlguno = filasDe(replica, 'enlaces_publicos').some(
    (enlace) => enlace.proyecto_id === proyecto.id,
  );
  const vista = comoSeVeElEnlace(activo, huboAlguno);
  const archivos = archivosDelProyecto(replica, proyecto.id);
  const vistos = loQueVeElCliente(archivos);
  const trabajando = generar.isPending || darDeBaja.isPending;

  async function generarElEnlace(): Promise<void> {
    setRechazo(null);
    const token = tokenNuevo();
    const id = uuidv7();
    const nuevo = { id, proyecto_id: proyecto.id, token_hash: await hashDelToken(token) };
    recordarToken(id, token);
    generar.mutate(
      { nuevo, revocar: activo ?? null, momento: new Date().toISOString() },
      {
        onError: (error) => {
          olvidarToken(id);
          setRechazo(error);
        },
      },
    );
  }

  function darLoDeBaja(): void {
    if (activo === undefined) return;
    const enlace = activo;
    setPreguntandoLaBaja(false);
    setRechazo(null);
    darDeBaja.mutate(
      { enlace, momento: new Date().toISOString() },
      {
        onSuccess: () => {
          olvidarToken(enlace.id);
        },
        onError: setRechazo,
      },
    );
  }

  function copiar(url: string): void {
    void navigator.clipboard.writeText(url).then(() => {
      setCopiado(true);
      setTimeout(() => {
        setCopiado(false);
      }, COPIADO_MS);
    });
  }

  const botonDeCrear = (etiqueta: string) => (
    <Button
      cargando={trabajando}
      disabled={sinSenal}
      onClick={() => {
        void generarElEnlace();
      }}
    >
      <Icono nombre="link-2" tamano={18} />
      {etiqueta}
    </Button>
  );

  const botonDeLaVista = (
    <Button
      variant="secundario"
      onClick={() => {
        void navegar(rutaDeLaVistaDelCliente(proyecto.id));
      }}
    >
      <Icono nombre="eye" tamano={18} />
      Ver cómo lo ve él
    </Button>
  );

  return (
    <Pagina className="[&>*]:max-w-[720px]">
      <Link
        to={rutaDelProyecto(proyecto.id)}
        className="mb-2.5 flex min-h-tap w-fit items-center gap-1 rounded-field pr-2 text-body font-medium text-text-2 hover:bg-surface"
      >
        <Icono nombre="chevron-left" tamano={20} />
        Volver al trabajo
      </Link>

      <header className="flex flex-col gap-1.5 border-b border-hairline pb-4">
        <span className="text-label text-text-2">
          {resumen.nombreDelCliente} · {proyecto.titulo}
        </span>
        <h1 className="font-display text-h1 leading-tight lg:text-h1-lg">
          Compartir con el cliente
        </h1>
        <p className="mt-0.5 max-w-[520px] text-body leading-relaxed text-text-2">
          Ve el precio, lo que pagó, lo que falta y en qué anda el mueble. No ve tus costos, tu
          ganancia, el diezmo ni el despiece.
        </p>
        <div className="mt-1.5">
          <AyudaDeLaVista conTexto />
        </div>
      </header>

      {vista.como === 'sin_enlace' && (
        <section className="mt-5 flex flex-col gap-3.5 rounded-panel border border-hairline p-5">
          <span className="flex items-center gap-2.5 text-body-lg font-semibold">
            <Icono nombre="link-2" tamano={20} />
            Todavía no compartiste este trabajo
          </span>
          <p className="max-w-[520px] text-body leading-relaxed text-text-2">
            Se crea un enlace propio de este trabajo. Quien lo tenga puede abrirlo sin cuenta ni
            contraseña, así que pasáselo solo a tu cliente. Lo podés dar de baja cuando quieras.
          </p>
          <FilaDeAcciones>
            {botonDeCrear('Crear el enlace')}
            {botonDeLaVista}
          </FilaDeAcciones>
        </section>
      )}

      {vista.como === 'de_baja' && (
        <section className="mt-5 flex flex-col gap-3.5 rounded-panel border border-hairline p-5">
          <span className="flex items-center gap-2.5 text-body-lg font-semibold">
            <Icono nombre="link-2-off" tamano={20} />
            El enlace está dado de baja
          </span>
          <p className="max-w-[520px] text-body leading-relaxed text-text-2">
            Si tu cliente lo abre, ve un aviso de que no funciona más y nada del trabajo. Podés
            crear uno nuevo cuando quieras; el anterior no vuelve.
          </p>
          <FilaDeAcciones>
            {botonDeCrear('Crear un enlace nuevo')}
            {botonDeLaVista}
          </FilaDeAcciones>
        </section>
      )}

      {activo !== undefined && (
        <section
          aria-label="El enlace"
          className="mt-5 flex flex-col gap-3 rounded-panel border border-hairline px-4 py-4"
        >
          <div className="flex flex-wrap items-center gap-2.5 text-body">
            <span aria-hidden className="size-2 flex-none rounded-pill bg-hogar" />
            <span className="font-semibold">Enlace activo</span>
            <span className="text-text-2">
              creado el {fechaLarga(activo.created_at.slice(0, 10), hoy)} · no vence
            </span>
          </div>

          {vista.como === 'activo' ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="h-12 min-w-[200px] flex-1 truncate rounded-field border border-border bg-surface px-3 font-mono text-label leading-12">
                  {vista.url}
                </span>
                <Button
                  onClick={() => {
                    copiar(vista.url);
                  }}
                >
                  <Icono nombre={copiado ? 'check' : 'copy'} tamano={18} />
                  {copiado ? 'Copiado' : 'Copiar'}
                </Button>
              </div>

              <a
                href={enlaceDeWhatsapp(
                  cliente?.telefono ?? '',
                  mensajeParaElCliente(resumen.nombreDelCliente, proyecto.titulo, vista.url),
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-tap w-fit items-center gap-2 rounded-field border border-border px-3 text-label font-medium hover:bg-surface"
              >
                <Icono nombre="message-circle" tamano={16} />
                Mandárselo por WhatsApp
              </a>

              <FilaDeAcciones>
                {botonDeLaVista}
                <Button
                  variant="secundario"
                  onClick={() => {
                    setPreguntandoLaBaja(true);
                  }}
                >
                  <Icono nombre="link-2-off" tamano={18} />
                  Dar de baja
                </Button>
              </FilaDeAcciones>
            </>
          ) : (
            <>
              <p className="max-w-[520px] text-body leading-relaxed text-text-2">
                La dirección del enlace queda solo en el dispositivo donde lo creaste: de este lado
                se guarda una huella suya y no el enlace, así que nadie puede fabricarlo de vuelta.
                Si lo necesitás de nuevo, creá uno y el anterior deja de andar.
              </p>
              <FilaDeAcciones>
                {botonDeCrear('Crear uno nuevo')}
                {botonDeLaVista}
                <Button
                  variant="secundario"
                  onClick={() => {
                    setPreguntandoLaBaja(true);
                  }}
                >
                  <Icono nombre="link-2-off" tamano={18} />
                  Dar de baja
                </Button>
              </FilaDeAcciones>
            </>
          )}

          {vistos.total > 0 && (
            <p
              className={`text-label leading-normal ${vistos.ninguno ? 'font-medium text-alerta' : 'text-text-3'}`}
            >
              {vistos.ninguno
                ? `Con este enlace el cliente ve 0 de ${String(vistos.total)} archivos: elegí abajo cuáles le mostrás.`
                : `Con este enlace el cliente ve ${String(vistos.compartidos)} de ${String(vistos.total)} archivos.`}
            </p>
          )}

          <p className="text-label leading-normal text-text-3">
            {vecesQueLoAbrio(activo)}
            {activo.ultima_visita_at === null
              ? '.'
              : `. La última vez, el ${fechaLarga(activo.ultima_visita_at.slice(0, 10), hoy)}.`}
          </p>
        </section>
      )}

      {sinSenal && vista.como !== 'activo' && (
        <p className="mt-2 flex items-center gap-2 text-label font-medium text-text-2">
          <Icono nombre="cloud-off" tamano={16} />
          Para crear el enlace necesitás señal: se guarda en el momento y recién ahí funciona.
        </p>
      )}

      {rechazo !== null && (
        <p role="alert" className="mt-2 text-label font-medium text-alerta">
          {mensajeDeSincronizacion(rechazo, { operacion: 'proyecto', sujeto: proyecto.titulo })}
        </p>
      )}

      <ConSalida valor={preguntandoLaBaja}>
        {() => (
          <Hoja
            titulo="¿Damos de baja el enlace?"
            rol="alertdialog"
            ancho="angosto"
            alCerrar={() => {
              setPreguntandoLaBaja(false);
            }}
          >
            <div className="flex flex-col gap-3.5 px-5 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:px-6 md:pb-5">
              <p className="text-label leading-relaxed text-text-2">
                Tu cliente va a dejar de ver el trabajo desde el enlace que le pasaste. Si después
                lo necesitás, creás uno nuevo.
              </p>
              <FilaDeAcciones>
                <Button
                  variant="secundario"
                  onClick={() => {
                    setPreguntandoLaBaja(false);
                  }}
                >
                  Dejarlo como está
                </Button>
                <Button variant="peligro" onClick={darLoDeBaja}>
                  Darlo de baja
                </Button>
              </FilaDeAcciones>
            </div>
          </Hoja>
        )}
      </ConSalida>

      <ArchivosQueVeElCliente archivos={archivos} />
    </Pagina>
  );
}
