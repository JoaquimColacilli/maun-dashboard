import type { EventoDeLaAgenda, EventoDerivado, EventoPropio } from '@maun/domain';

import { Button, Icono } from '@/shared/ui';

import { detalleDelEvento, textoDelEvento, urgenciaDelEvento } from '../model/calendario';
import { CATEGORIA, DERIVADA } from '../model/categorias';
import { CasillaDeAnotacion, MarcaConAnillo, MarcaDeCategoria } from './MarcaDeCategoria';

export interface AccionesDeLaAgenda {
  alAbrirTrabajo: (evento: EventoDerivado) => void;
  alTildar: (evento: EventoPropio) => void;
  alMarcar: (evento: EventoPropio) => void;
  alBorrar: (evento: EventoPropio) => void;
}

export interface FilaDeEventoProps {
  evento: EventoDeLaAgenda;
  hoy: string;
  acciones: AccionesDeLaAgenda;
  enElDia?: boolean;
  alAbrirElDia?: (fecha: string) => void;
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
  const hecha = evento.clase === 'propia' && evento.hecha;

  return (
    <>
      <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        {evento.clase === 'propia' && evento.hora !== null && (
          <span className="text-label font-semibold text-text-2 tabular-nums">{evento.hora}</span>
        )}
        {evento.clase === 'derivada' && (
          <span className={`text-body font-semibold ${categoria.texto}`}>
            {DERIVADA[evento.categoria].accion}
          </span>
        )}
        <span
          className={`text-body leading-snug text-pretty ${hecha ? 'text-text-3 line-through' : 'text-ink'}`}
        >
          {textoDelEvento(evento)}
        </span>
      </span>
      {(detalle !== '' || (urgencia !== null && urgencia.tono !== 'normal') || enElDia) && (
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-label text-text-2">
          {detalle !== '' && (
            <span className={enElDia ? '' : 'max-w-full truncate'}>{detalle}</span>
          )}
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

export function FilaDeEvento({
  evento,
  hoy,
  acciones,
  enElDia = false,
  alAbrirElDia,
}: FilaDeEventoProps) {
  const borde = enElDia ? 'border-t' : 'border-b';

  if (evento.clase === 'derivada') {
    const derivada = DERIVADA[evento.categoria];
    return (
      <li className={`flex items-start gap-3 ${borde} border-hairline-soft py-3`}>
        <MarcaConAnillo categoria={evento.categoria} importante={false} />
        {enElDia ? (
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <Contenido evento={evento} hoy={hoy} enElDia />
            <div className="mt-1.5 flex flex-wrap items-center gap-2 rounded-field bg-surface px-2.5 py-2 text-meta leading-snug text-text-2">
              <Icono nombre="link-2" tamano={14} />
              <span className="min-w-[10rem] flex-1">
                {derivada.origen}. Para moverla, cambiá la fecha ahí.
              </span>
              <Button
                variant="secundario"
                size="chico"
                onClick={() => {
                  acciones.alAbrirTrabajo(evento);
                }}
              >
                {derivada.abrir}
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              acciones.alAbrirTrabajo(evento);
            }}
            className="flex min-w-0 flex-1 flex-col items-start gap-0.5 rounded-field text-left"
          >
            <Contenido evento={evento} hoy={hoy} enElDia={false} />
          </button>
        )}
        {!enElDia && (
          <span aria-hidden className="mt-0.5 flex-none text-text-3">
            <Icono nombre="chevron-right" tamano={18} />
          </span>
        )}
      </li>
    );
  }

  return (
    <li className={`flex items-start gap-3 ${borde} border-hairline-soft py-3`}>
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
          <button
            type="button"
            aria-label={
              evento.importante ? 'Sacarle la marca de importante' : 'Marcar como importante'
            }
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
