import type { ArchivoDelCliente, VistaDelCliente as Vista } from '@maun/domain';

import { urlDelArchivo } from '@/shared/api';
import { fechaLarga, formatearPesos, relativa } from '@/shared/lib';
import { Icono, Pagina } from '@/shared/ui';

import { CaminoDeHitos } from './CaminoDeHitos';

export interface VistaDelClienteProps {
  vista: Vista;
  hoy: string;
}

const TIPO: Readonly<Record<string, string>> = {
  'image/webp': 'Imagen',
  'image/jpeg': 'Imagen',
  'application/pdf': 'PDF',
};

function esImagen(archivo: ArchivoDelCliente): boolean {
  return archivo.tipo === 'image/webp' || archivo.tipo === 'image/jpeg';
}

function Cifra({ clave, valor, tono = '' }: { clave: string; valor: string; tono?: string }) {
  return (
    <span className="flex flex-col gap-px">
      <span className="text-label text-text-2">{clave}</span>
      <span className={`text-money-lg font-semibold tabular-nums ${tono}`}>{valor}</span>
    </span>
  );
}

function Dato({
  clave,
  valor,
  fuerte = false,
}: {
  clave: string;
  valor: string;
  fuerte?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3.5 border-t border-hairline-soft py-2.5 first:border-t-0">
      <dt className="flex-none text-label text-text-2">{clave}</dt>
      <dd
        className={`text-right text-body leading-normal ${fuerte ? 'font-semibold' : 'font-medium'}`}
      >
        {valor}
      </dd>
    </div>
  );
}

export function VistaDelCliente({ vista, hoy }: VistaDelClienteProps) {
  const { trabajo } = vista;
  const saldado = vista.saldado || vista.saldo === null;
  const etiquetaDelSaldo =
    vista.saldo === null ? 'Falta el presupuesto' : saldado ? 'Está saldado' : 'Te falta pagar';
  const textoDelSaldo = vista.saldo === null ? '—' : formatearPesos(saldado ? 0 : vista.saldo);
  const tonoDelSaldo = saldado && vista.saldo !== null ? 'text-hogar' : '';
  const etapa = vista.hitos[vista.hitoIndex];

  const entrega =
    trabajo.fechas.entregado !== null
      ? `Entregado el ${fechaLarga(trabajo.fechas.entregado, hoy)}`
      : trabajo.fechas.entregaPautada !== null
        ? `Entrega pautada para el ${fechaLarga(trabajo.fechas.entregaPautada, hoy)}`
        : '';

  const visuales = trabajo.archivos.filter(esImagen);
  const documentos = trabajo.archivos.filter((archivo) => !esImagen(archivo));

  return (
    <Pagina>
      <header className="flex items-center justify-between gap-3 border-b border-hairline pb-3.5">
        <span className="min-w-0 font-display text-lema leading-tight">{trabajo.taller}</span>
      </header>

      <div className="mt-4 grid grid-cols-1 items-start gap-x-11 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="@container min-w-0">
          <section aria-label="Tu mueble" className="flex flex-col gap-1.5">
            <span className="text-body text-text-2">{trabajo.cliente}</span>
            <h1 className="font-display text-h1 leading-tight text-pretty lg:text-h1-lg">
              {trabajo.trabajo}
            </h1>

            {vista.foco === 'saldo' ? (
              <>
                <div className="mt-3 flex flex-col gap-0.5">
                  <span className="text-body text-text-2">{etiquetaDelSaldo}</span>
                  <span
                    className={`text-money-xl leading-tight font-semibold tabular-nums ${tonoDelSaldo}`}
                  >
                    {textoDelSaldo}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-body">
                  <span className="flex items-baseline gap-2">
                    <span className="text-text-2">Vale</span>
                    <span className="font-semibold tabular-nums">
                      {trabajo.precio === null ? '—' : formatearPesos(trabajo.precio)}
                    </span>
                  </span>
                  <span className="flex items-baseline gap-2">
                    <span className="text-text-2">Pagaste</span>
                    <span className="font-semibold tabular-nums">
                      {formatearPesos(vista.pagado)}
                    </span>
                  </span>
                </div>
                <div className="mt-3.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 border-t border-hairline pt-3.5">
                  <span className="text-body-lg font-semibold">{etapa?.texto}</span>
                  {entrega !== '' && <span className="text-body text-text-2">{entrega}</span>}
                </div>
              </>
            ) : (
              <>
                <div className="mt-3 flex flex-col gap-1">
                  <span className="text-h1 leading-tight font-semibold text-pretty lg:text-h1-lg">
                    {etapa?.texto}
                  </span>
                  {entrega !== '' && <span className="text-body text-text-2">{entrega}</span>}
                </div>
                <div className="mt-4 flex flex-wrap items-baseline gap-x-7 gap-y-2 border-t border-hairline pt-3.5">
                  <Cifra clave={etiquetaDelSaldo} valor={textoDelSaldo} tono={tonoDelSaldo} />
                  <Cifra
                    clave="Vale"
                    valor={trabajo.precio === null ? '—' : formatearPesos(trabajo.precio)}
                  />
                  <Cifra clave="Pagaste" valor={formatearPesos(vista.pagado)} />
                </div>
              </>
            )}
          </section>

          <section aria-label="En qué anda" className="mt-7">
            <h2 className="mb-3.5 text-section font-semibold">El camino de tu mueble</h2>
            <CaminoDeHitos hitos={vista.hitos} desdeTexto={vista.desdeTexto} hoy={hoy} />
            {vista.quietoTexto !== '' ? (
              <p className="mt-4 border-l-2 border-border py-3 pl-3.5 text-body leading-relaxed text-text-2">
                {vista.quietoTexto} <span className="text-ink">{vista.sigue}</span>
              </p>
            ) : (
              vista.sigue !== '' && (
                <p className="mt-3.5 text-body leading-relaxed text-text-2">{vista.sigue}</p>
              )
            )}
          </section>

          {vista.eventos.length > 0 && (
            <section aria-label="Lo que fue pasando" className="mt-8">
              <h2 className="mb-1 text-section font-semibold">Lo que fue pasando</h2>
              <ol className="list-none">
                {vista.eventos.map((evento, indice) => (
                  <li
                    key={evento.id}
                    className="grid grid-cols-[18px_1fr_auto] items-start gap-x-3"
                  >
                    <span aria-hidden className="flex h-full flex-col items-center">
                      <span
                        className={`mt-4 size-2 flex-none rounded-pill ${indice === 0 ? 'bg-ink' : 'bg-border'}`}
                      />
                      <span
                        className={`w-px flex-1 ${indice === vista.eventos.length - 1 ? 'bg-transparent' : 'bg-hairline'}`}
                      />
                    </span>
                    <span className="min-w-0 py-3">
                      <span className="block text-body leading-normal text-pretty">
                        {evento.texto}
                      </span>
                      <span className="mt-0.5 block text-label text-text-3 tabular-nums">
                        {fechaLarga(evento.fecha, hoy)} · {relativa(evento.fecha, hoy)}
                      </span>
                    </span>
                    <span className="py-3 text-body font-semibold whitespace-nowrap text-hogar tabular-nums">
                      {evento.monto === null ? '' : formatearPesos(evento.monto)}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section aria-label="Lo que pagaste" className="mt-7">
            <h2 className="mb-1.5 text-section font-semibold">Lo que pagaste</h2>
            {trabajo.pagos.length === 0 ? (
              <p className="border-t border-hairline py-3.5 text-body leading-normal text-text-2">
                Todavía no registramos ningún pago tuyo. Cuando entre la seña, la vas a ver acá.
              </p>
            ) : (
              <ul className="list-none">
                {trabajo.pagos.map((pago) => (
                  <li
                    key={pago.id}
                    className="flex min-h-12 items-baseline gap-3 border-t border-hairline-soft py-2.5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-body font-medium">
                        {pago.concepto.trim() === '' ? 'Pago' : pago.concepto}
                      </span>
                      <span className="block text-label text-text-3 tabular-nums">
                        {fechaLarga(pago.fecha, hoy)}
                      </span>
                    </span>
                    <span className="flex-none text-body font-semibold tabular-nums">
                      {formatearPesos(pago.monto)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex min-h-12 items-baseline justify-between border-t border-ink py-3 text-body font-semibold">
              <span>{etiquetaDelSaldo}</span>
              <span className={`tabular-nums ${tonoDelSaldo}`}>{textoDelSaldo}</span>
            </div>
            <p className="mt-2.5 text-label leading-normal text-text-3">
              {saldado && vista.saldo !== null
                ? 'Gracias. No queda nada pendiente.'
                : 'El saldo se abona al taller cuando ustedes lo arreglen. Esta página no cobra nada.'}
            </p>
          </section>
        </div>

        <div className="min-w-0">
          <section aria-label="Fotos y planos" className="mt-8 lg:mt-0">
            <div className="mb-3 flex items-baseline justify-between gap-2.5">
              <h2 className="text-section font-semibold">Fotos y planos</h2>
              {trabajo.archivos.length > 0 && (
                <span className="text-label text-text-3">
                  {trabajo.archivos.length === 1
                    ? '1 archivo'
                    : `${String(trabajo.archivos.length)} archivos`}
                </span>
              )}
            </div>

            {trabajo.archivos.length === 0 ? (
              <div className="flex flex-col gap-2 rounded-panel border border-dashed border-border px-4 py-5">
                <span className="text-body font-medium">Todavía no hay fotos</span>
                <span className="text-body leading-normal text-text-2">
                  Cuando el mueble esté armado vas a ver acá las fotos, los planos y los renders que
                  el taller comparta.
                </span>
              </div>
            ) : (
              <>
                {visuales.length > 0 && (
                  <ul className="grid list-none grid-cols-2 gap-2.5">
                    {visuales.map((archivo) => (
                      <li key={archivo.id}>
                        <a
                          href={urlDelArchivo(archivo.ruta)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex flex-col overflow-hidden rounded-panel border border-hairline hover:border-ink"
                        >
                          <img
                            src={urlDelArchivo(archivo.rutaMini)}
                            alt={archivo.nombre}
                            width={archivo.ancho ?? undefined}
                            height={archivo.alto ?? undefined}
                            loading="lazy"
                            className="aspect-4/3 w-full bg-surface object-cover"
                          />
                          <span className="flex items-center gap-2 border-t border-hairline-soft px-2.5 py-2">
                            <Icono nombre="image" tamano={15} />
                            <span className="min-w-0 flex-1 truncate text-label leading-normal">
                              {archivo.nombre}
                            </span>
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}

                {documentos.length > 0 && (
                  <ul className={`list-none ${visuales.length > 0 ? 'mt-3.5' : ''}`}>
                    {documentos.map((archivo) => (
                      <li key={archivo.id}>
                        <a
                          href={urlDelArchivo(archivo.ruta)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex min-h-14 items-center gap-3 border-t border-hairline-soft py-2.5 no-underline"
                        >
                          <span className="flex size-9.5 flex-none items-center justify-center rounded-field bg-surface">
                            <Icono nombre="file-text" tamano={18} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-body font-medium">
                              {archivo.nombre}
                            </span>
                            <span className="block text-meta text-text-3">
                              {TIPO[archivo.tipo] ?? 'Archivo'}
                            </span>
                          </span>
                          <Icono nombre="arrow-up-right" tamano={16} />
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>

          <section aria-label="Datos del trabajo" className="mt-7">
            <dl className="rounded-panel border border-hairline px-3.5 py-1">
              <Dato
                clave="Dirección"
                valor={trabajo.direccion.trim() === '' ? 'A confirmar' : trabajo.direccion}
              />
              <Dato
                clave="Empezamos"
                valor={
                  trabajo.fechas.inicio === null
                    ? 'Todavía no'
                    : fechaLarga(trabajo.fechas.inicio, hoy)
                }
              />
              <Dato
                clave={trabajo.fechas.entregado === null ? 'Entrega pautada' : 'Entregado'}
                valor={
                  trabajo.fechas.entregado !== null
                    ? fechaLarga(trabajo.fechas.entregado, hoy)
                    : trabajo.fechas.entregaPautada !== null
                      ? `${fechaLarga(trabajo.fechas.entregaPautada, hoy)} · ${relativa(trabajo.fechas.entregaPautada, hoy)}`
                      : 'A confirmar'
                }
                fuerte
              />
              <Dato
                clave="Seña"
                valor={
                  trabajo.pagos[0] === undefined
                    ? 'Pendiente'
                    : `${formatearPesos(trabajo.pagos[0].monto)} · ${fechaLarga(trabajo.pagos[0].fecha, hoy)}`
                }
              />
            </dl>
          </section>

          <p className="mt-4 text-label leading-relaxed text-text-3">
            Esta página la arma el taller para vos y se actualiza sola a medida que avanza el
            trabajo. Si algo no coincide, escribile al taller.
          </p>
        </div>
      </div>
    </Pagina>
  );
}
