import { faseDe } from '@maun/domain';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import {
  CONDICION,
  enlaceDeEmail,
  enlaceDeLlamada,
  enlaceDeMapa,
  enlaceDeWhatsapp,
  fechaDelProyecto,
  iniciales,
  nombreCorto,
  ORIGEN,
  resumenDeCliente,
  type Proyecto,
  type ResumenDeCliente,
} from '@/entities/cliente';
import { useReplicaDelTaller } from '@/entities/replica';
import { HojaDeCliente } from '@/features/editar-cliente';
import { fechaLarga, formatearPesos, hoyLocal, relativa } from '@/shared/lib';
import { Button, Icono, type NombreDeIcono } from '@/shared/ui';

const ESTADO_ETIQUETA: Record<Proyecto['estado'], string> = {
  contacto: 'Contacto',
  relevamiento: 'Relevamiento',
  a_presupuestar: 'A presupuestar',
  presupuesto_enviado: 'Presupuesto enviado',
  perdido: 'Perdido',
  en_curso: 'En curso',
  entregado: 'Entregado',
  cobrado: 'Cobrado',
};

const ESTADO_TONO: Record<Proyecto['estado'], string> = {
  contacto: 'border-border text-text-2',
  relevamiento: 'border-border text-text-2',
  a_presupuestar: 'border-border text-text-2',
  presupuesto_enviado: 'border-border text-text-2',
  perdido: 'border-border text-text-3',
  en_curso: 'border-ink text-ink',
  entregado: 'border-atencion bg-atencion-tint text-atencion',
  cobrado: 'border-hogar bg-hogar-tint text-hogar',
};

function Accion({
  icono,
  etiqueta,
  href,
  externo = false,
}: {
  icono: NombreDeIcono;
  etiqueta: string;
  href: string | null;
  externo?: boolean;
}) {
  const clases =
    'flex min-h-[60px] flex-col items-center justify-center gap-1.5 rounded-field border border-border text-meta font-medium';

  if (href === null) {
    return (
      <span aria-disabled className={`${clases} text-text-3`}>
        <Icono nombre={icono} tamano={20} />
        {etiqueta}
      </span>
    );
  }

  return (
    <a
      href={href}
      {...(externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className={`${clases} text-ink hover:bg-surface`}
    >
      <Icono nombre={icono} tamano={20} />
      {etiqueta}
    </a>
  );
}

function Dato({ clave, valor }: { clave: string; valor: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 border-t border-hairline py-2.5 text-body">
      <dt className="text-text-3">{clave}</dt>
      <dd className="leading-snug font-medium wrap-anywhere">{valor}</dd>
    </div>
  );
}

function Historial({ resumen, hoy }: { resumen: ResumenDeCliente; hoy: string }) {
  const { cliente, proyectos } = resumen;

  return (
    <section aria-label="Historial" className="mt-5">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="text-body-lg font-semibold">Historial</h2>
        {proyectos.length > 0 && (
          <span className="text-meta text-text-2 tabular-nums">
            {resumen.facturados} {resumen.facturados === 1 ? 'proyecto' : 'proyectos'}
            {resumen.enSeguimiento > 0 && `, ${String(resumen.enSeguimiento)} en seguimiento`}
          </span>
        )}
      </div>

      <dl className="grid grid-cols-2 border-t border-b border-ink border-b-hairline">
        <div className="py-2.5 pr-3">
          <dt className="text-meta text-text-2">Total facturado</dt>
          <dd className="text-money-lg font-semibold tabular-nums">
            {formatearPesos(resumen.facturado)}
          </dd>
        </div>
        <div className="border-l border-hairline py-2.5 pl-3">
          <dt className="text-meta text-text-2">Saldo pendiente</dt>
          <dd
            className={`text-money-lg font-semibold tabular-nums ${
              resumen.saldo > 0 ? 'text-atencion' : 'text-hogar'
            }`}
          >
            {resumen.saldo > 0 ? formatearPesos(resumen.saldo) : 'Sin saldo'}
          </dd>
        </div>
      </dl>

      {proyectos.length === 0 ? (
        <p className="py-4 text-body leading-relaxed text-text-2">
          Todavía no hay trabajos con {nombreCorto(cliente.nombre)}. Cuando arranques uno, aparece
          acá con su estado.
        </p>
      ) : (
        <ol className="list-none">
          {proyectos.map((proyecto) => {
            const fecha = fechaDelProyecto(proyecto);
            const enSeguimiento = faseDe(proyecto.estado) === 'seguimiento';
            return (
              <li
                key={proyecto.id}
                className="flex items-center gap-3 border-b border-hairline py-3"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body-lg font-medium">{proyecto.titulo}</span>
                  <span className="mt-0.5 block text-meta text-text-3">
                    {enSeguimiento ? 'Seguimiento' : 'Obra'}
                    {fecha === undefined ? '' : `, ${relativa(fecha, hoy)}`}
                  </span>
                </span>
                <span className="flex-none text-right">
                  <span className="block text-body font-semibold tabular-nums">
                    {proyecto.presupuesto_centavos === null
                      ? 'A presupuestar'
                      : formatearPesos(proyecto.presupuesto_centavos)}
                  </span>
                  <span
                    className={`mt-1 inline-block rounded-control border px-1.5 text-badge font-semibold ${ESTADO_TONO[proyecto.estado]}`}
                  >
                    {ESTADO_ETIQUETA[proyecto.estado]}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export function ClienteFichaPage() {
  const replica = useReplicaDelTaller();
  const navegar = useNavigate();
  const { id = '' } = useParams();
  const [editando, setEditando] = useState(false);

  const hoy = hoyLocal();
  const resumen = resumenDeCliente(replica, id);

  if (!resumen) {
    return (
      <div className="mx-auto flex max-w-content flex-col items-start gap-3 px-(--page-pad-mobile) py-8 md:px-(--page-pad-tablet) lg:px-(--page-pad-desktop)">
        <h1 className="font-display text-h1 leading-tight">Ese cliente no está</h1>
        <p className="max-w-[520px] text-body leading-relaxed text-text-2">
          Puede que lo hayas borrado desde otro dispositivo, o que el enlace apunte a un cliente de
          otro taller.
        </p>
        <Button
          onClick={() => {
            void navegar('/clientes');
          }}
        >
          Volver a Clientes
        </Button>
      </div>
    );
  }

  const { cliente } = resumen;
  const condicion = CONDICION[cliente.condicion_fiscal];
  const origen = cliente.origen_contacto === null ? undefined : ORIGEN[cliente.origen_contacto];

  const facturacion: { clave: string; valor: string }[] = [
    { clave: 'Condición', valor: condicion.etiqueta },
    { clave: 'Comprobante', valor: condicion.comprobante },
  ];
  if (cliente.cuit !== '') {
    facturacion.push({
      clave: cliente.condicion_fiscal === 'monotributo' ? 'CUIT / CUIL' : 'CUIT',
      valor: cliente.cuit,
    });
  }
  if (cliente.razon_social !== '') {
    facturacion.push({ clave: 'Razón social', valor: cliente.razon_social });
  }
  if (cliente.domicilio_fiscal !== '' && cliente.domicilio_fiscal !== cliente.direccion) {
    facturacion.push({ clave: 'Dom. fiscal', valor: cliente.domicilio_fiscal });
  }

  return (
    <div className="mx-auto flex max-w-content flex-col px-(--page-pad-mobile) py-2 md:px-(--page-pad-tablet) md:py-5 lg:px-(--page-pad-desktop) lg:py-6">
      <div className="mb-2.5 flex items-center justify-between">
        <Link
          to="/clientes"
          className="flex min-h-tap items-center gap-1 rounded-field pr-2 text-body font-medium text-text-2 hover:bg-surface"
        >
          <Icono nombre="chevron-left" tamano={20} />
          Clientes
        </Link>
        <Button
          variant="secundario"
          size="chico"
          onClick={() => {
            setEditando(true);
          }}
        >
          <Icono nombre="pencil" tamano={16} />
          Editar
        </Button>
      </div>

      <header className="flex items-center gap-3.5">
        <span className="flex size-14 flex-none items-center justify-center rounded-pill bg-ink text-body-lg font-semibold text-paper">
          {iniciales(cliente.nombre)}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-h1 leading-tight lg:text-h1-lg">{cliente.nombre}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-meta text-text-2">
            {cliente.zona !== '' && <span>{cliente.zona}</span>}
            <span
              title={condicion.etiqueta}
              className="inline-flex items-center gap-1.5 rounded-control border border-ink px-1.5 text-badge font-semibold text-ink"
            >
              {condicion.corto}
              <span className="font-medium text-text-2">{condicion.comprobante}</span>
            </span>
            <span>cliente desde {fechaLarga(cliente.created_at.slice(0, 10), hoy)}</span>
          </div>
        </div>
      </header>

      <div className="mt-4 grid grid-cols-4 gap-2">
        <Accion icono="phone" etiqueta="Llamar" href={enlaceDeLlamada(cliente.telefono)} />
        <Accion
          icono="message-circle"
          etiqueta="WhatsApp"
          href={enlaceDeWhatsapp(cliente.telefono)}
          externo
        />
        <Accion icono="mail" etiqueta="Email" href={enlaceDeEmail(cliente.email)} />
        <Accion
          icono="map-pin"
          etiqueta="Mapa"
          href={enlaceDeMapa(cliente.direccion, cliente.zona)}
          externo
        />
      </div>

      <div className="grid gap-0 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] xl:gap-x-11">
        <div className="min-w-0">
          <section aria-label="Contacto" className="mt-5">
            <h2 className="mb-1 text-body-lg font-semibold">Contacto</h2>
            <dl>
              <Dato
                clave="Teléfono"
                valor={cliente.telefono === '' ? 'Sin teléfono' : cliente.telefono}
              />
              <Dato clave="Email" valor={cliente.email === '' ? 'Sin email' : cliente.email} />
              <Dato
                clave="Dirección"
                valor={cliente.direccion === '' ? 'Sin dirección' : cliente.direccion}
              />
            </dl>
          </section>

          <section aria-label="Cómo llegó" className="mt-5">
            <h2 className="mb-1 text-body-lg font-semibold">Cómo llegó</h2>
            <p className="border-t border-hairline py-2.5 text-body leading-snug">
              <span className="font-medium">{origen?.etiqueta ?? 'Sin anotar'}.</span>{' '}
              <span className="text-text-2">
                {cliente.origen_detalle === ''
                  ? (origen?.detalle ?? 'Todavía no anotaste de dónde vino.')
                  : cliente.origen_detalle}
              </span>
            </p>
          </section>

          <section aria-label="Facturación" className="mt-5">
            <h2 className="mb-1 text-body-lg font-semibold">Facturación</h2>
            <dl>
              {facturacion.map((fila) => (
                <Dato key={fila.clave} clave={fila.clave} valor={fila.valor} />
              ))}
            </dl>
          </section>

          {cliente.notas !== '' && (
            <p className="mt-4 rounded-field bg-surface px-3 py-2.5 text-label leading-snug text-text-2">
              {cliente.notas}
            </p>
          )}
        </div>

        <div className="min-w-0">
          <Historial resumen={resumen} hoy={hoy} />
          <Button
            className="mt-4 w-full"
            onClick={() => {
              void navegar('/proyectos');
            }}
          >
            <Icono nombre="folder-plus" tamano={18} />
            Arrancar un proyecto con {nombreCorto(cliente.nombre)}
          </Button>
        </div>
      </div>

      {editando && (
        <HojaDeCliente
          cliente={cliente}
          alCerrar={() => {
            setEditando(false);
          }}
        />
      )}
    </div>
  );
}
