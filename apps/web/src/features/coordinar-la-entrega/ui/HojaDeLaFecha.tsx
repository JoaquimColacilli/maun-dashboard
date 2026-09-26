import { FRANJAS_DE_ENTREGA, type FranjaDeEntrega } from '@maun/domain';
import { useState, type SyntheticEvent } from 'react';

import { FRANJA_DE_LA_ENTREGA } from '@/entities/proyecto';
import { mensajeDeSincronizacion } from '@/shared/api';
import { Button, Campo, FilaDeAcciones, Hoja } from '@/shared/ui';

import { desdeCuando, errorDeLaFecha, type FechaQueSeElige } from '../model/entrega';

const OPCIONES_DE_FRANJA: readonly { valor: FranjaDeEntrega | null; etiqueta: string }[] = [
  { valor: null, etiqueta: 'Sin horario' },
  ...FRANJAS_DE_ENTREGA.map((franja) => ({
    valor: franja,
    etiqueta: FRANJA_DE_LA_ENTREGA[franja].replace(/^a la /, 'A la '),
  })),
];

export interface HojaDeLaFechaProps {
  que: FechaQueSeElige;
  titulo: string;
  bajada: string;
  ayuda: string;
  boton: string;
  hoy: string;
  fecha: string;
  franja: FranjaDeEntrega | null;
  conFranja: boolean;
  cargando?: boolean;
  rechazo?: unknown;
  sujeto: string;
  alGuardar: (fecha: string, franja: FranjaDeEntrega | null) => void;
  alCerrar: () => void;
}

export function HojaDeLaFecha({
  que,
  titulo,
  bajada,
  ayuda,
  boton,
  hoy,
  fecha: inicial,
  franja: franjaInicial,
  conFranja,
  cargando = false,
  rechazo = null,
  sujeto,
  alGuardar,
  alCerrar,
}: HojaDeLaFechaProps) {
  const [fecha, setFecha] = useState(inicial);
  const [franja, setFranja] = useState<FranjaDeEntrega | null>(franjaInicial);
  const [error, setError] = useState<string | undefined>(undefined);
  const conCambios = fecha !== inicial || franja !== franjaInicial;

  function enviar(evento: SyntheticEvent<HTMLFormElement>): void {
    evento.preventDefault();
    const encontrado = errorDeLaFecha(que, fecha, hoy);
    setError(encontrado);
    if (encontrado !== undefined) return;
    alGuardar(fecha, conFranja ? franja : null);
  }

  return (
    <Hoja titulo={titulo} bajada={bajada} alCerrar={alCerrar} conCambios={conCambios}>
      {(pedirCierre) => (
        <form noValidate onSubmit={enviar} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4 md:px-6 md:py-5">
            <Campo
              etiqueta="Día"
              type="date"
              min={desdeCuando(que, hoy)}
              value={fecha}
              ayuda={ayuda}
              error={error}
              onChange={(evento) => {
                setFecha(evento.target.value);
                setError(undefined);
              }}
            />

            {conFranja && (
              <fieldset className="flex flex-col gap-1.5">
                <legend className="mb-1.5 text-label text-text-2">Horario</legend>
                <div role="radiogroup" aria-label="Horario" className="flex flex-wrap gap-2">
                  {OPCIONES_DE_FRANJA.map((opcion) => {
                    const elegida = franja === opcion.valor;
                    return (
                      <button
                        key={opcion.etiqueta}
                        type="button"
                        role="radio"
                        aria-checked={elegida}
                        onClick={() => {
                          setFranja(opcion.valor);
                        }}
                        className={`apretable min-h-tap rounded-pill border px-4 text-body font-medium ${
                          elegida
                            ? 'border-ink bg-ink text-paper'
                            : 'border-border bg-paper text-ink'
                        }`}
                      >
                        {opcion.etiqueta}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}

            {rechazo !== null && (
              <p role="alert" className="text-label font-medium text-alerta">
                {mensajeDeSincronizacion(rechazo, { operacion: 'proyecto', sujeto })}
              </p>
            )}
          </div>

          <footer className="flex-none border-t border-hairline bg-paper px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:px-6 md:pb-3">
            <FilaDeAcciones>
              <Button type="button" variant="secundario" onClick={pedirCierre}>
                Cancelar
              </Button>
              <Button type="submit" cargando={cargando}>
                {boton}
              </Button>
            </FilaDeAcciones>
          </footer>
        </form>
      )}
    </Hoja>
  );
}
