import { CATEGORIAS_PROPIAS, sumarDias } from '@maun/domain';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState, type SyntheticEvent } from 'react';

import {
  AYUDA_DE_LA_PROPIA,
  CaminosALosTrabajos,
  CATEGORIA,
  MarcaDeCategoria,
} from '@/entities/agenda';
import { useReplicaDelTaller } from '@/entities/replica';
import { filasDe } from '@/shared/api';
import { hoyLocal, uuidv7 } from '@/shared/lib';
import { Button, Campo, Hoja } from '@/shared/ui';

import { anotar, type Avisador } from '../model/acciones';
import {
  anotacionNueva,
  erroresDeLaAnotacion,
  esFecha,
  hayCambiosEnLaAnotacion,
  hayErrores,
  LARGO_MAXIMO_DEL_TEXTO,
  trabajosParaAnotar,
  valoresIniciales,
  type ErroresDeLaAnotacion,
  type ValoresDeLaAnotacion,
} from '../model/anotacion';

const RENGLONES_DEL_CUADERNO = {
  backgroundImage:
    'repeating-linear-gradient(transparent 0 27px, var(--paper-notas-line) 27px 28px)',
  backgroundAttachment: 'local',
  backgroundPosition: '0 8px',
} as const;

export interface HojaDeAnotacionProps {
  fechaInicial: string;
  alCerrar: () => void;
  alAnotar?: (fecha: string) => void;
  avisar?: Avisador;
}

export function HojaDeAnotacion({
  fechaInicial,
  alCerrar,
  alAnotar,
  avisar,
}: HojaDeAnotacionProps) {
  const cliente = useQueryClient();
  const replica = useReplicaDelTaller();
  const ids = useId();
  const campoDeTexto = useRef<HTMLTextAreaElement>(null);
  const [id] = useState(uuidv7);
  const [iniciales] = useState<ValoresDeLaAnotacion>(() => valoresIniciales(fechaInicial));
  const [valores, setValores] = useState<ValoresDeLaAnotacion>(iniciales);
  const [errores, setErrores] = useState<ErroresDeLaAnotacion>({});

  const hoy = hoyLocal();
  const manana = sumarDias(hoy, 1);
  const atajos = [
    { etiqueta: 'Hoy', fecha: hoy },
    { etiqueta: 'Mañana', fecha: manana },
    ...(fechaInicial === hoy || fechaInicial === manana
      ? []
      : [{ etiqueta: 'El día elegido', fecha: fechaInicial }]),
  ];
  const trabajos = trabajosParaAnotar(filasDe(replica, 'proyectos'), filasDe(replica, 'clientes'));

  useEffect(() => {
    campoDeTexto.current?.focus();
  }, []);

  function cambiar<Campo extends keyof ValoresDeLaAnotacion>(
    campo: Campo,
    valor: ValoresDeLaAnotacion[Campo],
  ): void {
    setValores((previos) => ({ ...previos, [campo]: valor }));
    setErrores((previos) => ({ ...previos, [campo]: undefined }));
  }

  function enviar(evento: SyntheticEvent<HTMLFormElement>): void {
    evento.preventDefault();
    const encontrados = erroresDeLaAnotacion(valores);
    setErrores(encontrados);
    if (hayErrores(encontrados)) {
      if (encontrados.texto !== undefined) campoDeTexto.current?.focus();
      return;
    }
    anotar(cliente, anotacionNueva(id, valores), avisar);
    alAnotar?.(valores.fecha);
    alCerrar();
  }

  return (
    <Hoja
      titulo="Anotar algo"
      alCerrar={alCerrar}
      conCambios={hayCambiosEnLaAnotacion(iniciales, valores)}
    >
      <form noValidate onSubmit={enviar} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4 md:px-6 md:py-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${ids}-texto`} className="text-label text-text-2">
              Qué hay que hacer
            </label>
            <textarea
              ref={campoDeTexto}
              id={`${ids}-texto`}
              rows={2}
              maxLength={LARGO_MAXIMO_DEL_TEXTO}
              value={valores.texto}
              onChange={(evento) => {
                cambiar('texto', evento.target.value);
              }}
              placeholder="Comprar melamina, retirar el pulpo, pintar la cajonera…"
              aria-invalid={errores.texto !== undefined}
              aria-describedby={errores.texto === undefined ? undefined : `${ids}-texto-error`}
              style={RENGLONES_DEL_CUADERNO}
              className={`resize-y rounded-field border bg-paper-notas px-3 py-2 text-body-lg leading-[28px] text-ink focus:border-ink ${
                errores.texto === undefined ? 'border-border' : 'border-alerta'
              }`}
            />
            {errores.texto !== undefined && (
              <span id={`${ids}-texto-error`} className="text-label font-medium text-alerta">
                {errores.texto}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <span id={`${ids}-categoria`} className="text-label text-text-2">
              Qué es
            </span>
            <div
              role="radiogroup"
              aria-labelledby={`${ids}-categoria`}
              className="grid grid-cols-2 gap-2"
            >
              {CATEGORIAS_PROPIAS.map((categoria) => {
                const elegida = valores.categoria === categoria;
                return (
                  <button
                    key={categoria}
                    type="button"
                    role="radio"
                    aria-checked={elegida}
                    onClick={() => {
                      cambiar('categoria', categoria);
                    }}
                    className={`flex min-h-[52px] items-center gap-2.5 rounded-field border px-3 py-2 text-left ${
                      elegida ? 'border-ink bg-surface' : 'border-border bg-paper'
                    }`}
                  >
                    <MarcaDeCategoria categoria={categoria} tamano="grande" />
                    <span className="leading-tight">
                      <span
                        className={`block text-body ${elegida ? 'font-semibold' : 'font-medium'}`}
                      >
                        {CATEGORIA[categoria].etiqueta}
                      </span>
                      <span className="block text-meta text-text-2">
                        {AYUDA_DE_LA_PROPIA[categoria]}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-1">
              <CaminosALosTrabajos
                fecha={esFecha(valores.fecha) ? valores.fecha : undefined}
                alIr={alCerrar}
              />
            </div>
          </div>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-label text-text-2">Cuándo</legend>
            <div className="flex flex-wrap gap-2">
              {atajos.map((atajo) => {
                const elegido = valores.fecha === atajo.fecha;
                return (
                  <button
                    key={atajo.etiqueta}
                    type="button"
                    aria-pressed={elegido}
                    onClick={() => {
                      cambiar('fecha', atajo.fecha);
                    }}
                    className={`apretable h-11 rounded-pill border px-3.5 text-body font-medium ${
                      elegido ? 'border-ink bg-ink text-paper' : 'border-border bg-paper text-ink'
                    }`}
                  >
                    {atajo.etiqueta}
                  </button>
                );
              })}
              <input
                type="date"
                aria-label="Otro día"
                value={valores.fecha}
                onChange={(evento) => {
                  cambiar('fecha', evento.target.value);
                }}
                aria-invalid={errores.fecha !== undefined}
                className="h-11 min-w-[150px] flex-1 rounded-field border border-border bg-paper px-3 text-body text-ink"
              />
            </div>
            {errores.fecha !== undefined && (
              <span role="alert" className="text-label font-medium text-alerta">
                {errores.fecha}
              </span>
            )}
          </fieldset>

          <div className="@container">
            <div className="grid gap-4 @sm:grid-cols-2">
              <Campo
                etiqueta="Hora"
                type="time"
                value={valores.hora}
                onChange={(evento) => {
                  cambiar('hora', evento.target.value);
                }}
                ayuda="Opcional: el día es lo que manda."
              />
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${ids}-trabajo`} className="text-label text-text-2">
                  Trabajo
                </label>
                <select
                  id={`${ids}-trabajo`}
                  value={valores.proyectoId}
                  onChange={(evento) => {
                    cambiar('proyectoId', evento.target.value);
                  }}
                  className="h-field min-w-0 rounded-field border border-border bg-paper px-3 text-body-lg text-ink"
                >
                  <option value="">Sin trabajo</option>
                  {trabajos.map((trabajo) => (
                    <option key={trabajo.id} value={trabajo.id}>
                      {trabajo.etiqueta}
                    </option>
                  ))}
                </select>
                <span className="text-meta text-text-3">Opcional.</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            aria-pressed={valores.importante}
            onClick={() => {
              cambiar('importante', !valores.importante);
            }}
            className={`flex min-h-[52px] items-center gap-3 rounded-field border px-3 py-2 text-left ${
              valores.importante ? 'border-ag-marca bg-surface' : 'border-border bg-paper'
            }`}
          >
            <span
              aria-hidden
              className="flex size-[22px] flex-none items-center justify-center rounded-pill ring-[1.5px] ring-ag-marca"
            >
              <span className={`size-2 rounded-pill ${valores.importante ? 'bg-ag-marca' : ''}`} />
            </span>
            <span className="text-body leading-snug">
              Marcarlo como importante
              <span className="block text-meta text-text-2">
                Como el círculo del cuaderno: lo importante de la semana.
              </span>
            </span>
          </button>
        </div>

        <footer className="flex-none border-t border-hairline bg-paper px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:px-6 md:pb-3">
          <Button type="submit" size="grande" className="w-full">
            Anotarlo
          </Button>
        </footer>
      </form>
    </Hoja>
  );
}
