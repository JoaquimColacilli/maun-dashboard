import {
  asientosDelLibro,
  CERO,
  centavos,
  estadoDelDiezmo,
  proyeccionCocos,
  restar,
  sueldoDelMes,
  type Money,
} from '@maun/domain';
import { useMemo, useState } from 'react';

import {
  faltaDelSueldo,
  fraseDelDiezmo,
  fraseDelSueldo,
  resumenMensual,
  type FraseDelDiezmo,
  type ResumenMensual,
} from '@/entities/movimiento';
import { avisosDeEntregas } from '@/entities/entrega';
import { novedadesDeOpiniones } from '@/entities/opinion';
import { useReplicaDelTaller } from '@/entities/replica';
import { corteDelMes, entregaDelResumen, LiquidacionesSinConfirmar } from '@/entities/proyecto';
import { useNombreDeLaPersona, useSesionActiva } from '@/entities/sesion';
import { TESORO, TESOROS_EN_ORDEN, type DatosDelTesoro } from '@/entities/tesoro';
import {
  ajustesDe,
  datosDelLibro,
  faltaConfigurar,
  filasDe,
  liquidacionesDeLaReplica,
  objetivosDeLaReplica,
  saldosDeLaReplica,
  type FilaDe,
  type Replica,
} from '@/shared/api';
import {
  diaDelMes,
  diasDelMes,
  fechaLarga,
  formatearPesos,
  hoyLocal,
  mesAnterior,
  mesDeLaFecha,
  nombreDelMes,
  relativa,
  RUTA_DE_DIEZMO,
  rutaDeFinanzasDelTesoro,
  rutaDelProyecto,
  useAnchoDePantalla,
  Ir,
  useIr,
} from '@/shared/lib';
import {
  Avatar,
  caracteresDe,
  ConSalida,
  Icono,
  MontoQueEntra,
  Pagina,
  PrincipalYApoyo,
  Tablero,
  type NombreDeIcono,
} from '@/shared/ui';

import { HojaDelPerfil } from './HojaDelPerfil';
import { HoyEnLaAgenda } from './HoyEnLaAgenda';
import { PortadaDeInicio } from './PortadaDeInicio';
import { RespuestasDeEntrega } from './RespuestasDeEntrega';
import { UltimaOpinion } from './UltimaOpinion';

const DIAS_DE_PROYECCION = 365;

function encabezado(frase: FraseDelDiezmo): string {
  return frase.despues === '' ? frase.antes : `${frase.antes} ${frase.despues}`;
}

function porcentaje(parte: Money, total: Money): number {
  return total <= 0 ? 0 : Math.round((parte / total) * 100);
}

function comparacion(valor: Money, previo: Money, mes: string): string {
  if (previo <= 0) return '';
  const variacion = Math.round(((valor - previo) / previo) * 100);
  const signo = variacion >= 0 ? '+' : '−';
  return `${signo}${String(Math.abs(variacion))}% vs. ${nombreDelMes(mesAnterior(mes)).toLowerCase()}`;
}

export interface MensajeDelMes {
  texto: string;
  alerta: boolean;
}

function mensajeDelMes(
  mes: string,
  saldoHogar: Money,
  del: ResumenMensual,
  faltaSueldo: Money,
): MensajeDelMes {
  const nombre = nombreDelMes(mes).toLowerCase();

  if (saldoHogar < 0) {
    return {
      texto: `El hogar está en negativo: ${formatearPesos(restar(CERO, saldoHogar))}. Los gastos pasaron a lo que entró.`,
      alerta: true,
    };
  }
  if (del.entroHogar === 0 && del.facturoTaller === 0) {
    return { texto: `${nombreDelMes(mes)} todavía no tiene movimiento.`, alerta: true };
  }
  if (faltaSueldo <= 0) {
    return { texto: `El sueldo de ${nombre} ya está cubierto.`, alerta: false };
  }
  if (del.entroHogar === 0) {
    return {
      texto: `El taller facturó ${formatearPesos(del.facturoTaller)} en ${nombre} y al hogar todavía no entró nada: el sueldo se transfiere cuando cobrás un trabajo.`,
      alerta: true,
    };
  }
  return {
    texto: `Faltan ${formatearPesos(faltaSueldo)} para cubrir el sueldo de ${nombre}.`,
    alerta: true,
  };
}

function saldoPendiente(replica: Replica, pendientes: readonly FilaDe<'proyectos'>[]): Money {
  const pagos = filasDe(replica, 'pagos');
  let total = 0;
  for (const proyecto of pendientes) {
    const cobrado = pagos
      .filter((pago) => pago.proyecto_id === proyecto.id)
      .reduce((suma, pago) => suma + pago.monto_centavos, 0);
    const falta = (proyecto.presupuesto_centavos ?? 0) - cobrado;
    if (falta > 0) total += falta;
  }
  return centavos(total);
}

function Tarjeta({
  tesoro,
  saldo,
  meta,
  frase,
  caracteres,
  alElegir,
}: {
  tesoro: DatosDelTesoro;
  saldo: Money;
  meta: Money;
  frase?: FraseDelDiezmo;
  caracteres: number;
  alElegir: () => void;
}) {
  const enNegativo = saldo < 0 && frase === undefined;

  let detalle = tesoro.descripcion;
  if (frase) detalle = frase.detalle;
  if (tesoro.id === 'cocos' && meta > 0) detalle = `${String(porcentaje(saldo, meta))}% de la meta`;
  if (enNegativo) detalle = 'gastó más de lo que entró';

  return (
    <button
      type="button"
      onClick={alElegir}
      className={`@container relative flex min-h-[118px] min-w-0 flex-col justify-between gap-3 overflow-hidden rounded-panel p-3 text-left @min-[20rem]:p-3.5 ${
        enNegativo
          ? 'border border-negativo-borde bg-negativo-bg text-negativo-texto'
          : 'border border-hairline bg-paper pb-4 @min-[20rem]:pb-[18px]'
      }`}
    >
      <span className="flex w-full flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span
          className={`flex items-center gap-2 text-label font-semibold ${enNegativo ? 'text-negativo-texto' : tesoro.texto}`}
        >
          <Icono nombre={enNegativo ? 'triangle-alert' : tesoro.icono} tamano={18} />
          {tesoro.nombre}
        </span>
        {enNegativo && (
          <span className="rounded-control border border-current px-1.5 text-badge font-semibold whitespace-nowrap">
            en negativo
          </span>
        )}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        {frase === undefined ? (
          <MontoQueEntra caracteres={caracteres} className="font-semibold">
            {formatearPesos(saldo)}
          </MontoQueEntra>
        ) : frase.importe === null ? (
          <span className="text-body-lg leading-tight font-semibold">{encabezado(frase)}</span>
        ) : (
          <>
            <span className="text-label leading-tight font-medium">{encabezado(frase)}</span>
            <MontoQueEntra caracteres={caracteres} className="font-semibold">
              {frase.importe}
            </MontoQueEntra>
          </>
        )}
        <span className={`text-meta ${enNegativo ? 'text-negativo-texto/80' : 'text-text-2'}`}>
          {detalle}
        </span>
      </span>
      {!enNegativo && (
        <span aria-hidden className={`absolute inset-x-0 bottom-0 h-[5px] ${tesoro.barra}`} />
      )}
    </button>
  );
}

function Barra({
  etiqueta,
  texto,
  detalle,
  pct,
  color,
}: {
  etiqueta: string;
  texto: string;
  detalle?: string;
  pct: number;
  color: string;
}) {
  const lleno = Math.min(100, Math.max(0, pct));
  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 text-label">
        <span className="font-medium">{etiqueta}</span>
        <span className="text-text-2 tabular-nums">{texto}</span>
      </div>
      <div
        role="progressbar"
        aria-label={etiqueta}
        aria-valuenow={lleno}
        aria-valuetext={detalle === undefined ? texto : `${texto}. ${detalle}`}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 overflow-hidden rounded-control bg-surface-2"
      >
        <div className={`h-full rounded-control ${color}`} style={{ width: `${String(lleno)}%` }} />
      </div>
      {detalle !== undefined && <p className="mt-1 text-meta text-text-3">{detalle}</p>}
    </div>
  );
}

function Acceso({
  icono,
  etiqueta,
  titulo,
  valor,
  tono,
  fondo,
  alElegir,
}: {
  icono: NombreDeIcono;
  etiqueta: string;
  titulo: string;
  valor: string;
  tono?: string;
  fondo?: string;
  alElegir: () => void;
}) {
  return (
    <button
      type="button"
      onClick={alElegir}
      className="flex w-full items-center gap-3 border-t border-hairline-soft py-3.5 text-left first:border-t-0 @min-[52rem]/apoyo:gap-4"
    >
      <span
        className={`flex size-9 flex-none items-center justify-center rounded-field ${fondo ?? 'bg-surface'} ${tono ?? ''}`}
      >
        <Icono nombre={icono} tamano={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-meta text-text-2">{etiqueta}</span>
        <span className="block truncate text-body font-medium @min-[52rem]/apoyo:line-clamp-2 @min-[52rem]/apoyo:whitespace-normal">
          {titulo}
        </span>
      </span>
      <span className={`flex-none text-body font-semibold tabular-nums ${tono ?? ''}`}>
        {valor}
      </span>
    </button>
  );
}

function BotonDeLaCuenta({
  abierta,
  sinLeer,
  alAbrir,
}: {
  abierta: boolean;
  sinLeer: number;
  alAbrir: () => void;
}) {
  const { email, foto } = useSesionActiva();
  const nombre = useNombreDeLaPersona();
  const nuevas = sinLeer === 1 ? '1 opinión nueva' : `${String(sinLeer)} opiniones nuevas`;

  return (
    <button
      type="button"
      aria-label={sinLeer > 0 ? `Tu cuenta. ${nuevas}` : 'Tu cuenta'}
      aria-haspopup="dialog"
      aria-expanded={abierta}
      onClick={alAbrir}
      className="relative -mr-1 flex size-tap flex-none items-center justify-center rounded-pill"
    >
      <Avatar
        nombre={nombre.trim() === '' ? email : nombre}
        foto={foto}
        className={abierta ? 'ring-2 ring-ink' : ''}
      />
      {sinLeer > 0 && (
        <span
          aria-hidden
          className="absolute top-1 right-1 size-2.5 rounded-pill border-2 border-paper bg-op-mal"
        />
      )}
    </button>
  );
}

function AccesoALaAgenda() {
  return (
    <Ir
      a="/agenda"
      aria-label="Agenda"
      className="flex size-tap flex-none items-center justify-center rounded-pill border border-hairline bg-paper text-ink hover:bg-ink/5"
    >
      <Icono nombre="calendar-days" tamano={22} />
    </Ir>
  );
}

export function InicioPage() {
  const replica = useReplicaDelTaller();
  const ir = useIr();
  const ancho = useAnchoDePantalla();
  const sesion = useSesionActiva();
  const nombreDeLaPersona = useNombreDeLaPersona();
  const [perfil, setPerfil] = useState(false);

  const hoy = hoyLocal();
  const novedades = useMemo(() => novedadesDeOpiniones(replica, hoy), [replica, hoy]);
  const mes = mesDeLaFecha(hoy);
  const ajustes = ajustesDe(replica);
  const arranque = faltaConfigurar(ajustes);
  const corte = useMemo(() => corteDelMes(replica, mes), [replica, mes]);
  const saldos = saldosDeLaReplica(replica);

  const asientos = asientosDelLibro(datosDelLibro(replica));
  const del = resumenMensual(asientos, mes);
  const delPrevio = resumenMensual(asientos, mesAnterior(mes));
  const diezmo = estadoDelDiezmo(asientos);
  const frase = fraseDelDiezmo(diezmo);

  const liquidaciones = liquidacionesDeLaReplica(replica);
  const objetivos = objetivosDeLaReplica(replica);
  const sueldo = sueldoDelMes(liquidaciones, mes, objetivos, mes);
  const fraseSueldo = fraseDelSueldo(sueldo);
  const metaCocos = centavos(ajustes?.meta_cocos_centavos ?? 0);
  const mensaje = mensajeDelMes(mes, saldos.hogar, del, faltaDelSueldo(sueldo));

  const proyectos = filasDe(replica, 'proyectos');
  const pendientes = proyectos.filter(
    (proyecto) => proyecto.estado === 'en_curso' || proyecto.estado === 'entregado',
  );
  const proximaEntrega = proyectos
    .filter((proyecto) => proyecto.estado === 'en_curso')
    .flatMap((proyecto) => {
      const { fecha, comprometida } = entregaDelResumen(proyecto);
      return fecha === null ? [] : [{ proyecto, fecha, comprometida }];
    })
    .sort((una, otra) => una.fecha.localeCompare(otra.fecha))[0];
  const respuestasDeEntrega = useMemo(() => avisosDeEntregas(replica), [replica]);

  const caracteresDeLasTarjetas = caracteresDe(
    ...TESOROS_EN_ORDEN.flatMap((id) =>
      id === 'diezmo'
        ? frase.importe === null
          ? []
          : [frase.importe]
        : [formatearPesos(saldos[id])],
    ),
  );

  const irA = (ruta: string) => () => {
    ir(ruta);
  };

  const estadisticas = [
    { etiqueta: 'Entró al hogar', valor: del.entroHogar, previo: delPrevio.entroHogar },
    { etiqueta: 'Gastó el hogar', valor: del.gastoHogar, previo: delPrevio.gastoHogar },
    { etiqueta: 'Facturó el taller', valor: del.facturoTaller, previo: delPrevio.facturoTaller },
  ];

  return (
    <Pagina className="gap-3 md:gap-4">
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-label text-text-2">{fechaLarga(hoy, hoy)}</span>
          <h1 className="font-display text-h1 leading-tight lg:text-h1-lg">Inicio</h1>
        </div>
        {ancho === 'movil' && (
          <div className="flex flex-none items-center gap-2">
            <AccesoALaAgenda />
            <BotonDeLaCuenta
              abierta={perfil}
              sinLeer={novedades.sinLeer}
              alAbrir={() => {
                setPerfil(true);
              }}
            />
          </div>
        )}
      </header>

      <PortadaDeInicio hoy={hoy} corte={corte} arranque={arranque} />

      <Tablero
        enUnaFila
        como="section"
        etiqueta="Tesoros"
        className="@container grid-cols-2 gap-3 md:gap-4"
      >
        {TESOROS_EN_ORDEN.map((id) => (
          <Tarjeta
            key={id}
            tesoro={TESORO[id]}
            saldo={saldos[id]}
            meta={metaCocos}
            frase={id === 'diezmo' ? frase : undefined}
            caracteres={caracteresDeLasTarjetas}
            alElegir={irA(id === 'diezmo' ? RUTA_DE_DIEZMO : rutaDeFinanzasDelTesoro(id))}
          />
        ))}
      </Tablero>

      <RespuestasDeEntrega avisos={respuestasDeEntrega} hoy={hoy} />

      {novedades.ultima !== null && <UltimaOpinion ultima={novedades.ultima} />}

      {ancho === 'movil' && <HoyEnLaAgenda replica={replica} hoy={hoy} />}

      <LiquidacionesSinConfirmar replica={replica} />

      {!arranque && (
        <PrincipalYApoyo
          amplio
          separacion="gap-y-3 @min-[40rem]/apoyo:gap-y-4"
          apoyo={
            <div className="flex flex-col gap-3 md:gap-4">
              <section
                aria-label="Accesos"
                className="rounded-panel border border-hairline bg-paper px-4"
              >
                <Acceso
                  icono="truck"
                  etiqueta="Entrega más próxima"
                  titulo={proximaEntrega?.proyecto.titulo ?? 'Sin entregas programadas'}
                  valor={
                    proximaEntrega === undefined
                      ? ''
                      : `${relativa(proximaEntrega.fecha, hoy)}${proximaEntrega.comprometida ? ', comprometida' : ''}`
                  }
                  alElegir={irA(
                    proximaEntrega === undefined
                      ? '/proyectos'
                      : rutaDelProyecto(proximaEntrega.proyecto.id),
                  )}
                />
                <Acceso
                  icono="hand-coins"
                  etiqueta="Pendiente de cobro"
                  titulo={`${String(pendientes.length)} proyectos en curso`}
                  valor={formatearPesos(saldoPendiente(replica, pendientes))}
                  alElegir={irA('/proyectos')}
                />
                <Acceso
                  icono="church"
                  etiqueta="Diezmo"
                  titulo={encabezado(frase)}
                  valor={frase.importe ?? ''}
                  tono="text-diezmo"
                  fondo="bg-diezmo-tint"
                  alElegir={irA(RUTA_DE_DIEZMO)}
                />
              </section>

              <section
                aria-label="Proyección de Cocos"
                className="@container rounded-panel border border-hairline bg-paper px-4 py-4 md:px-5"
              >
                <div className="flex flex-col gap-2.5 @min-[24rem]:flex-row @min-[24rem]:items-center @min-[24rem]:gap-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-label text-text-2">Cocos en un año</div>
                    <div className="mt-0.5 text-money-lg font-semibold whitespace-nowrap text-cocos tabular-nums">
                      {formatearPesos(
                        proyeccionCocos(
                          saldos.cocos,
                          ajustes?.tasa_cocos_anual_bp ?? 0,
                          DIAS_DE_PROYECCION,
                        ),
                      )}
                    </div>
                    <div className="mt-0.5 text-meta text-text-3">
                      con la tasa que cargaste, sin aportes nuevos
                    </div>
                  </div>
                  <div className="min-w-0 @min-[24rem]:flex-none @min-[24rem]:text-right">
                    <div className="text-meta text-text-2">falta para la meta</div>
                    <div className="text-body font-semibold whitespace-nowrap tabular-nums">
                      {formatearPesos(Math.max(0, metaCocos - saldos.cocos))}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          }
        >
          <div className="flex flex-col gap-3 md:gap-4">
            <p className="flex items-start gap-2.5 rounded-panel border border-hairline bg-paper px-4 py-4 text-body-lg leading-normal md:px-5">
              <span
                aria-hidden
                className={`mt-2 size-2 flex-none rounded-pill ${
                  mensaje.alerta ? 'bg-atencion' : 'bg-hogar'
                }`}
              />
              <span>{mensaje.texto}</span>
            </p>

            <section
              aria-label={nombreDelMes(mes)}
              className="@container rounded-panel border border-hairline bg-paper px-4 py-4 md:px-5"
            >
              <div className="mb-2.5 flex items-baseline justify-between">
                <span className="text-label font-semibold">{nombreDelMes(mes)}</span>
                <span className="text-meta text-text-2">
                  día {diaDelMes(hoy)} de {diasDelMes(mes)}
                </span>
              </div>
              <dl className="grid grid-cols-1 gap-2 @min-[28rem]:grid-cols-3 @min-[28rem]:gap-3">
                {estadisticas.map((estadistica) => {
                  const vs = comparacion(estadistica.valor, estadistica.previo, mes);
                  return (
                    <div
                      key={estadistica.etiqueta}
                      className="flex min-w-0 items-baseline justify-between gap-3 @min-[28rem]:block"
                    >
                      <dt className="text-meta leading-tight text-text-2">
                        {estadistica.etiqueta}
                      </dt>
                      <dd className="text-right @min-[28rem]:mt-0.5 @min-[28rem]:text-left">
                        <span className="block text-body-lg font-semibold whitespace-nowrap tabular-nums lg:text-money-lg">
                          {formatearPesos(estadistica.valor)}
                        </span>
                        {vs !== '' && (
                          <span className="mt-0.5 block text-badge text-text-3">{vs}</span>
                        )}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </section>

            <section
              aria-label="Progreso"
              className="flex flex-col gap-4 rounded-panel border border-hairline bg-paper px-4 py-4 md:px-5"
            >
              <Barra
                etiqueta="Sueldo del mes"
                texto={fraseSueldo.texto}
                detalle={fraseSueldo.detalle}
                pct={porcentaje(sueldo.pagado, sueldo.esperado)}
                color={TESORO.hogar.barra}
              />
              <Barra
                etiqueta="Meta de Cocos"
                texto={`${formatearPesos(saldos.cocos)} de ${formatearPesos(metaCocos)}`}
                pct={porcentaje(saldos.cocos, metaCocos)}
                color={TESORO.cocos.barra}
              />
              <Barra
                etiqueta="Diezmo pagado"
                texto={`${formatearPesos(diezmo.pagado)} de ${formatearPesos(diezmo.generado)}`}
                pct={porcentaje(diezmo.pagado, diezmo.generado)}
                color={TESORO.diezmo.barra}
              />
            </section>
          </div>
        </PrincipalYApoyo>
      )}

      <ConSalida valor={perfil}>
        {() => (
          <HojaDelPerfil
            replica={replica}
            hoy={hoy}
            nombre={nombreDeLaPersona.trim()}
            email={sesion.email}
            foto={sesion.foto}
            novedades={novedades}
            alCerrar={() => {
              setPerfil(false);
            }}
          />
        )}
      </ConSalida>
    </Pagina>
  );
}
