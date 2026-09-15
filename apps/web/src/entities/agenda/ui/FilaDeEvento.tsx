import type { EventoDeLaAgenda, EventoDerivado, EventoPropio } from '@maun/domain';
import { Link } from 'react-router';

import { rutaDelCliente, rutaDelProyecto } from '@/shared/lib';
import { Button, Icono } from '@/shared/ui';

import {
  detalleDelEvento,
  textoDeLoHecho,
  textoDelEvento,
  urgenciaDelEvento,
} from '../model/calendario';
import { CATEGORIA, DERIVADA } from '../model/categorias';
import { CasillaDeAnotacion, MarcaConAnillo, MarcaDeCategoria } from './MarcaDeCategoria';

export interface AccionesDeLaAgenda {
  alAbrirTrabajo: (evento: EventoDerivado) => void;
  alTildar: (evento: EventoPropio) => void;
  alMarcar: (evento: EventoDeLaAgenda) => void;
  alBorrar: (evento: EventoPropio) => void;
}

export interface FilaDeEventoProps {
  evento: EventoDeLaAgenda;
  hoy: string;
  acciones: AccionesDeLaAgenda;
  enElDia?: boolean;
  alAbrirElDia?: (fecha: string) => void;
}

const ENLACE_EN_EL_DETALLE =
  'underline decoration-hairline underline-offset-2 hover:decoration-ink';

function DetalleConEnlaces({ evento }: { evento: EventoDeLaAgenda }) {
  if (evento.clase === 'propia') {
    if (evento.proyectoId === null || evento.proyecto === null) return <>{evento.proyecto ?? ''}</>;
    return (
      <Link to={rutaDelProyecto(evento.proyectoId)} className={ENLACE_EN_EL_DETALLE}>
        {evento.proyecto}
      </Link>
    );
  }
  const cliente = evento.cliente.trim();
  const lugar = evento.lugar.trim();
  return (
    <>
      {cliente !== '' && (
        <Link to={rutaDelCliente(evento.clienteId)} className={ENLACE_EN_EL_DETALLE}>
          {cliente}
        </Link>
      )}
      {cliente !== '' && lugar !== '' && ', '}
      {lugar}
    </>
  );
}

function Contenido({
  evento,
  hoy,
  enElDia,
}: {
  evento: EventoDeLaAgenda;
  hoy: string;
  enElDia: boolean;
}) {
  const categoria = CATEGORIA[evento.categoria];
  const urgencia = urgenciaDelEvento(evento, hoy);
  const detalle = detalleDelEvento(evento);
  const { hecha } = evento;

  return (
    <>
      <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        {evento.clase === 'propia' && evento.hora !== null && (
          <span className="text-label font-semibold text-text-2 tabular-nums">{evento.hora}</span>
        )}
        {evento.clase === 'derivada' && (
          <span
            className={
              hecha
                ? 'text-label font-semibold text-text-3 line-through'
                : `text-body font-semibold ${categoria.texto}`
            }
          >
            {DERIVADA[evento.categoria].accion}
          </span>
        )}
        <span
          className={`leading-snug text-pretty ${
            hecha ? 'text-label text-text-3 line-through' : 'text-body text-ink'
          }`}
        >
          {textoDelEvento(evento)}
        </span>
        {hecha && <span className="sr-only">, {textoDeLoHecho(evento)}</span>}
      </span>
      {!hecha &&
        (detalle !== '' || (urgencia !== null && urgencia.tono !== 'normal') || enElDia) && (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-label text-text-2">
            {detalle !== '' &&
              (enElDia ? (
                <span>
                  <DetalleConEnlaces evento={evento} />
                </span>
              ) : (
                <span className="max-w-full truncate">{detalle}</span>
              ))}
            {urgencia !== null && urgencia.tono !== 'normal' && (
              <span
                className={`font-semibold ${urgencia.tono === 'alerta' ? 'text-alerta' : 'text-atencion'}`}
              >
                {urgencia.texto}
              </span>
            )}
            {evento.clase === 'propia' && enElDia && (
              <span className="inline-flex items-center gap-1.5 text-text-3">
                <MarcaDeCategoria categoria={evento.categoria} tamano="chica" />
                {categoria.etiqueta}
              </span>
            )}
          </span>
        )}
    </>
  );
}

function BotonDeLaMarca({
  evento,
  acciones,
}: {
  evento: EventoDeLaAgenda;
  acciones: AccionesDeLaAgenda;
}) {
  return (
    <button
      type="button"
      aria-label={evento.importante ? 'Sacarle la marca de importante' : 'Marcar como importante'}
      aria-pressed={evento.importante}
      onClick={() => {
        acciones.alMarcar(evento);
      }}
      className={`flex size-9 items-center justify-center rounded-pill hover:bg-surface ${
        evento.importante ? 'text-ag-marca' : 'text-text-3'
      }`}
    >
      <Icono nombre="circle" tamano={16} grosor={2} />
    </button>
  );
}

function FilaDerivada({
  evento,
  hoy,
  acciones,
  enElDia,
}: {
  evento: EventoDerivado;
  hoy: string;
  acciones: AccionesDeLaAgenda;
  enElDia: boolean;
}) {
  const derivada = DERIVADA[evento.categoria];
  const abrir = () => {
    acciones.alAbrirTrabajo(evento);
  };

  return (
    <li
      data-derivada={evento.id}
      data-hecha={String(evento.hecha)}
      className={`flex gap-3 ${enElDia ? 'border-t' : 'border-b'} border-hairline-soft ${
        evento.hecha ? 'items-center py-2' : 'items-start py-3'
      }`}
    >
      <MarcaConAnillo categoria={evento.categoria} importante={evento.importante} />
      {!enElDia ? (
        <button
          type="button"
          onClick={abrir}
          className="flex min-w-0 flex-1 flex-col items-start gap-0.5 rounded-field text-left"
        >
          <Contenido evento={evento} hoy={hoy} enElDia={false} />
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Contenido evento={evento} hoy={hoy} enElDia />
          {!evento.hecha && (
            <div className="mt-1.5 flex flex-wrap items-center gap-2 rounded-field bg-surface px-2.5 py-2 text-meta leading-snug text-text-2">
              <Icono nombre="link-2" tamano={14} />
              <span className="min-w-[10rem] flex-1">
                {derivada.origen}. Para moverla, cambiá la fecha ahí.
              </span>
              <Button variant="secundario" size="chico" onClick={abrir}>
                {derivada.abrir}
              </Button>
            </div>
          )}
        </div>
      )}
      {enElDia ? (
        <span className="-my-1 flex flex-none gap-0.5">
          <BotonDeLaMarca evento={evento} acciones={acciones} />
          {evento.hecha && (
            <button
              type="button"
              aria-label={`${derivada.abrir}: ${evento.titulo}`}
              onClick={abrir}
              className="flex size-9 items-center justify-center rounded-field text-text-3 hover:bg-surface hover:text-ink"
            >
              <Icono nombre="chevron-right" tamano={16} />
            </button>
          )}
        </span>
      ) : (
        <span aria-hidden className="mt-0.5 flex-none text-text-3">
          <Icono nombre="chevron-right" tamano={18} />
        </span>
      )}
    </li>
  );
}

export function FilaDeEvento({
  evento,
  hoy,
  acciones,
  enElDia = false,
  alAbrirElDia,
}: FilaDeEventoProps) {
  if (evento.clase === 'derivada') {
    return <FilaDerivada evento={evento} hoy={hoy} acciones={acciones} enElDia={enElDia} />;
  }

  return (
    <li
      data-anotacion={evento.id}
      data-hecha={String(evento.hecha)}
      className={`flex gap-3 ${enElDia ? 'border-t' : 'border-b'} border-hairline-soft ${
        evento.hecha ? 'items-center py-2' : 'items-start py-3'
      }`}
    >
      <CasillaDeAnotacion
        evento={evento}
        alTildar={() => {
          acciones.alTildar(evento);
        }}
      />
      {enElDia || alAbrirElDia === undefined ? (
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Contenido evento={evento} hoy={hoy} enElDia={enElDia} />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            alAbrirElDia(evento.fecha);
          }}
          className="flex min-w-0 flex-1 flex-col items-start gap-0.5 rounded-field text-left"
        >
          <Contenido evento={evento} hoy={hoy} enElDia={false} />
        </button>
      )}
      {enElDia && (
        <span className="-my-1 flex flex-none gap-0.5">
          <BotonDeLaMarca evento={evento} acciones={acciones} />
          <button
            type="button"
            aria-label={`Borrar «${evento.texto}»`}
            onClick={() => {
              acciones.alBorrar(evento);
            }}
            className="flex size-9 items-center justify-center rounded-field text-text-3 hover:bg-surface hover:text-alerta"
          >
            <Icono nombre="trash-2" tamano={16} />
          </button>
        </span>
      )}
    </li>
  );
}
