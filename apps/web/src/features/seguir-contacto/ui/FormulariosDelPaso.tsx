import { useEffect, useRef, useState, type SyntheticEvent } from 'react';

import type { Proyecto } from '@/entities/proyecto';
import type { CambiosDeProyecto, PagoParaGuardar } from '@/shared/api';
import { hoyLocal, uuidv7 } from '@/shared/lib';
import { Button, Campo, FilaDeAcciones, MoneyInput } from '@/shared/ui';

import {
  conOtroDia,
  conOtroVencimiento,
  errorDelDia,
  pasoDelRelevamiento,
  valoresDelRelevamiento,
} from '../model/relevamiento';

export interface FormularioDelRelevamientoProps {
  proyecto: Proyecto;
  conPago: boolean;
  alListo: (cambios: CambiosDeProyecto, dia: string, pagos: PagoParaGuardar[]) => void;
  alCancelar: () => void;
}

export function FormularioDelRelevamiento({
  proyecto,
  conPago,
  alListo,
  alCancelar,
}: FormularioDelRelevamientoProps) {
  const hoy = hoyLocal();
  const [valores, setValores] = useState(() => valoresDelRelevamiento(proyecto, hoy));
  const [error, setError] = useState<string | undefined>(undefined);
  const campoDelDia = useRef<HTMLInputElement>(null);
  const idDelPago = useRef(uuidv7());

  useEffect(() => {
    campoDelDia.current?.focus();
  }, []);

  function enviar(evento: SyntheticEvent<HTMLFormElement>): void {
    evento.preventDefault();
    const encontrado = errorDelDia(valores, hoy);
    setError(encontrado);
    if (encontrado !== undefined) return;
    const { cambios, pagos } = pasoDelRelevamiento(valores, idDelPago.current);
    alListo(cambios, valores.dia, pagos);
  }

  return (
    <form noValidate onSubmit={enviar} className="mt-3 flex flex-col gap-3">
      <Campo
        ref={campoDelDia}
        etiqueta="Qué día fuiste"
        type="date"
        max={hoy}
        value={valores.dia}
        onChange={(evento) => {
          const dia = evento.target.value;
          setValores((previos) => conOtroDia(previos, dia, hoy));
          setError(undefined);
        }}
        error={error}
      />
      <Campo
        etiqueta="Entregar el presupuesto antes del"
        type="date"
        value={valores.vencimiento}
        onChange={(evento) => {
          const vencimiento = evento.target.value;
          setValores((previos) => conOtroVencimiento(previos, vencimiento));
        }}
        ayuda="Una semana de trabajo desde la visita. Cambiala si lo prometiste para otro día."
      />
      {conPago && (
        <MoneyInput
          etiqueta="Cuánto te pagó la visita"
          placeholder="Opcional"
          value={valores.pago}
          onChange={(pago) => {
            setValores((previos) => ({ ...previos, pago }));
          }}
          ayuda="Si no te la pagó, lo que sigue es un estimativo. Igual podés presupuestar."
        />
      )}
      <FilaDeAcciones>
        <Button type="submit">Anotar el relevamiento</Button>
        <Button variant="secundario" onClick={alCancelar}>
          Todavía no
        </Button>
      </FilaDeAcciones>
    </form>
  );
}

export interface FormularioDeUnMontoProps {
  alListo: (monto: number | null) => void;
  alCancelar: () => void;
}

function FormularioDeUnMonto({
  etiqueta,
  ayuda,
  enviar,
  alListo,
  alCancelar,
}: FormularioDeUnMontoProps & { etiqueta: string; ayuda: string; enviar: string }) {
  const [monto, setMonto] = useState<number | null>(null);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    campo.current?.focus();
  }, []);

  return (
    <form
      noValidate
      onSubmit={(evento) => {
        evento.preventDefault();
        alListo(monto);
      }}
      className="mt-3 flex flex-col gap-2.5"
    >
      <MoneyInput
        ref={campo}
        etiqueta={etiqueta}
        placeholder="Opcional"
        value={monto}
        onChange={setMonto}
        ayuda={ayuda}
      />
      <FilaDeAcciones>
        <Button type="submit">{enviar}</Button>
        <Button variant="secundario" onClick={alCancelar}>
          Todavía no
        </Button>
      </FilaDeAcciones>
    </form>
  );
}

export function FormularioDelPresupuesto(props: FormularioDeUnMontoProps) {
  return (
    <FormularioDeUnMonto
      {...props}
      etiqueta="Cuánto presupuestaste"
      ayuda="Si lo dejás vacío, lo cargás cuando lo apruebe."
      enviar="Marcar como enviado"
    />
  );
}

export function FormularioDelPago(props: FormularioDeUnMontoProps) {
  return (
    <FormularioDeUnMonto
      {...props}
      etiqueta="Cuánto te pagó"
      ayuda="Si todavía no te pagó y vas a presupuestar igual, dejalo vacío."
      enviar="Pasar a presupuestar"
    />
  );
}
