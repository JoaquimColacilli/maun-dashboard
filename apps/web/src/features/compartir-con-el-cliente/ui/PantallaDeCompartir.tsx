import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { archivosDelProyecto, loQueVeElCliente } from '@/entities/archivo';
import {
  enlaceActivo,
  MUTACION_DE_BAJA_DE_ENLACE,
  MUTACION_DE_ENLACE,
  MUTACION_DE_TOKEN_DE_ENLACE,
  vecesQueLoAbrio,
} from '@/entities/enlace';
import { rutaDelProyecto, type ResumenDeProyecto } from '@/entities/proyecto';
import { useReplicaDelTaller } from '@/entities/replica';
import { AyudaDeLaVista } from '@/entities/vista-cliente';
import { ajustesDe, filasDe, householdDe, mensajeDeSincronizacion } from '@/shared/api';
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
  Ir,
  useIr,
  useVolver,
} from '@/shared/lib';
import {
  Button,
  ConSalida,
  FilaDeAcciones,
  Hoja,
  Icono,
  Pagina,
  PrincipalYApoyo,
  Tilde,
} from '@/shared/ui';

import { filasDeCobro } from '../model/comoTePaga';
import {
  comoSeVeElEnlace,
  comoSeVeEnWhatsapp,
  enlaceDeWhatsapp,
  mensajeParaElCliente,
} from '../model/compartir';
import { ArchivosQueVeElCliente } from './ArchivosQueVeElCliente';
import { BotonDelQr } from './BotonDelQr';
import { ComoTePaga } from './ComoTePaga';

export interface PantallaDeCompartirProps {
  resumen: ResumenDeProyecto;
}

const COPIADO_MS = 2_200;

export function PantallaDeCompartir({ resumen }: PantallaDeCompartirProps) {
  const replica = useReplicaDelTaller();
  const ir = useIr();
  const { proyecto, cliente } = resumen;
  const vuelta = useVolver(rutaDelProyecto(proyecto.id), 'Volver al trabajo', { fija: true });
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
  const { mutate: subirElToken } = useMutation(MUTACION_DE_TOKEN_DE_ENLACE);
  const [rechazo, setRechazo] = useState<unknown>(null);
  const [copiado, setCopiado] = useState(false);
  const [preguntandoLaBaja, setPreguntandoLaBaja] = useState(false);

  const activo = enlaceActivo(replica, proyecto.id);
  const huboAlguno = filasDe(replica, 'enlaces_publicos').some(
    (enlace) => enlace.proyecto_id === proyecto.id,
  );
  const vista = comoSeVeElEnlace(activo, huboAlguno);
  const household = householdDe(replica);
  const archivos = archivosDelProyecto(replica, proyecto.id);
  const vistos = loQueVeElCliente(archivos);
  const hayPagoPendiente = filasDeCobro(resumen, ajustesDe(replica)).length > 0;
  const trabajando = generar.isPending || darDeBaja.isPending;

  const aRellenar = vista.como === 'activo' ? vista.aRellenar : null;
  const idDelEnlace = activo?.id ?? null;
  const rellenado = useRef<string | null>(null);

  useEffect(() => {
    if (idDelEnlace === null || aRellenar === null) return;
    if (rellenado.current === idDelEnlace) return;
    rellenado.current = idDelEnlace;
    subirElToken({ id: idDelEnlace, token: aRellenar });
  }, [idDelEnlace, aRellenar, subirElToken]);

  async function generarElEnlace(): Promise<void> {
    setRechazo(null);
    const token = tokenNuevo();
    const id = uuidv7();
    const nuevo = { id, proyecto_id: proyecto.id, token_hash: await hashDelToken(token), token };
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
        ir(rutaDeLaVistaDelCliente(proyecto.id));
      }}
    >
      <Icono nombre="eye" tamano={18} />
      Ver cómo lo ve él
    </Button>
  );

  return (
    <Pagina className="gap-3 md:gap-4">
      <Ir
        a={rutaDelProyecto(proyecto.id)}
        alTocar={vuelta.volver}
        className="-ml-1 flex min-h-tap w-fit items-center gap-1 rounded-pill pr-3 pl-1 text-body font-medium text-text-2 hover:bg-ink/5"
      >
        <Icono nombre="chevron-left" tamano={20} />
        {vuelta.etiqueta}
      </Ir>

      <header className="flex flex-col gap-1.5">
        <span className="text-label text-text-2">
          {resumen.nombreDelCliente} · {proyecto.titulo}
        </span>
        <h1 className="font-display text-h1 leading-tight lg:text-h1-lg">
          Compartir con el cliente
        </h1>
        <p className="mt-0.5 max-w-[520px] text-body leading-relaxed text-text-2">
          Ve el precio, lo que pagó, lo que falta, cómo pagarte y en qué anda el mueble. No ve tus
          costos, tu ganancia, el diezmo ni el despiece. El código QR abre el mismo enlace: quien lo
          escanea ve exactamente lo mismo, y darlo de baja apaga los dos.
        </p>
        <div className="mt-1.5">
          <AyudaDeLaVista conTexto />
        </div>
      </header>

      <PrincipalYApoyo
        apoyoPrimero
        separacion="gap-y-3 @min-[40rem]/apoyo:gap-y-4"
        apoyo={
          <div className="flex min-w-0 flex-col">
            {vista.como === 'sin_enlace' && (
              <section className="flex flex-col gap-3.5 rounded-panel border border-hairline bg-paper px-4 py-4 md:px-5">
                <span className="flex items-center gap-2.5 text-body-lg font-semibold">
                  <Icono nombre="link-2" tamano={20} />
                  Todavía no compartiste este trabajo
                </span>
                <p className="max-w-[520px] text-body leading-relaxed text-text-2">
                  Se crea un enlace propio de este trabajo. Quien lo tenga puede abrirlo sin cuenta
                  ni contraseña, así que pasáselo solo a tu cliente. Lo podés dar de baja cuando
                  quieras.
                </p>
                <FilaDeAcciones>
                  {botonDeCrear('Crear el enlace')}
                  {botonDeLaVista}
                </FilaDeAcciones>
              </section>
            )}

            {vista.como === 'de_baja' && (
              <section className="flex flex-col gap-3.5 rounded-panel border border-hairline bg-paper px-4 py-4 md:px-5">
                <span className="flex items-center gap-2.5 text-body-lg font-semibold">
                  <Icono nombre="link-2-off" tamano={20} />
                  El enlace está dado de baja
                </span>
                <p className="max-w-[520px] text-body leading-relaxed text-text-2">
                  Si tu cliente lo abre, ve un aviso de que no funciona más y nada del trabajo.
                  Podés crear uno nuevo cuando quieras; el anterior no vuelve.
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
                className="flex flex-col gap-3 rounded-panel border border-hairline bg-paper px-4 py-4 md:px-5"
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
                      <span className="h-12 min-w-[200px] flex-1 truncate rounded-field border border-border bg-surface px-3 font-mono text-label leading-12 @min-[52rem]/apoyo:h-auto @min-[52rem]/apoyo:basis-full @min-[52rem]/apoyo:py-2.5 @min-[52rem]/apoyo:leading-normal @min-[52rem]/apoyo:break-all @min-[52rem]/apoyo:whitespace-normal">
                        {vista.url}
                      </span>
                      <Button
                        className="@min-[52rem]/apoyo:w-full"
                        onClick={() => {
                          copiar(vista.url);
                        }}
                      >
                        {copiado ? (
                          <Tilde dibujar tamano={18} grosor={2} />
                        ) : (
                          <Icono nombre="copy" tamano={18} />
                        )}
                        {copiado ? 'Copiado' : 'Copiar'}
                      </Button>
                    </div>

                    <p className="flex flex-wrap items-baseline gap-x-2 text-label leading-normal text-text-3">
                      <span>En WhatsApp va a decir:</span>
                      <span className="font-semibold text-text-2">
                        {comoSeVeEnWhatsapp(proyecto.titulo, household?.nombre ?? '')}
                      </span>
                    </p>

                    <div className="flex flex-wrap items-center gap-2 @min-[52rem]/apoyo:flex-col @min-[52rem]/apoyo:items-stretch @min-[52rem]/apoyo:gap-3">
                      <a
                        href={enlaceDeWhatsapp(
                          cliente?.telefono ?? '',
                          mensajeParaElCliente(
                            resumen.nombreDelCliente,
                            proyecto.titulo,
                            vista.url,
                            hayPagoPendiente,
                          ),
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex min-h-tap w-fit items-center gap-2 rounded-pill border border-border px-3 text-label font-medium hover:bg-surface @min-[52rem]/apoyo:w-full @min-[52rem]/apoyo:justify-center @min-[52rem]/apoyo:text-body"
                      >
                        <Icono nombre="message-circle" tamano={16} />
                        Mandárselo por WhatsApp
                      </a>
                      <BotonDelQr
                        proyectoId={proyecto.id}
                        trabajo={proyecto.titulo}
                        className="@min-[52rem]/apoyo:w-full @min-[52rem]/apoyo:justify-center @min-[52rem]/apoyo:text-body"
                      />
                    </div>

                    <FilaDeAcciones className="@min-[52rem]/apoyo:gap-3">
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
                      Este enlace se creó antes de que la dirección se guardara en tu taller, así
                      que todavía vive en el aparato donde lo hiciste. Abrí este trabajo una vez
                      desde ahí y la dirección te aparece acá sola, sin tocar el que tu cliente ya
                      tiene. Si no llegás a ese aparato, creá uno nuevo: el anterior deja de andar.
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
                {mensajeDeSincronizacion(rechazo, {
                  operacion: 'proyecto',
                  sujeto: proyecto.titulo,
                })}
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
                      Tu cliente va a dejar de ver el trabajo desde el enlace que le pasaste. Si
                      después lo necesitás, creás uno nuevo.
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
          </div>
        }
      >
        <div className="flex min-w-0 flex-col gap-3 md:gap-4">
          <ComoTePaga resumen={resumen} />
          <ArchivosQueVeElCliente archivos={archivos} />
        </div>
      </PrincipalYApoyo>
    </Pagina>
  );
}
