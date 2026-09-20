import {
  claveBancariaDe,
  comoPagar,
  formatearCbu,
  PEDILE_LOS_DATOS,
  type ComoPagar as Como,
  type TrabajoDelCliente,
} from '@maun/domain';

import { formatearPesos } from '@/shared/lib';
import { DatoCopiable } from '@/shared/ui';

export interface ComoPagarProps {
  trabajo: TrabajoDelCliente;
}

function DespuesViene({ siguiente }: { siguiente: NonNullable<Como['siguiente']> }) {
  const importe = siguiente.monto === null ? '' : `: ${formatearPesos(siguiente.monto)}`;
  return (
    <p className="mt-2.5 border-t border-hairline-soft pt-2.5 text-label leading-normal text-text-2">
      Después, {siguiente.nombre}
      {importe}, {siguiente.comoSePaga}.
    </p>
  );
}

export function ComoPagar({ trabajo }: ComoPagarProps) {
  const como = comoPagar(trabajo);
  if (como === null) return null;
  if (!como.transferencia && !como.efectivo && !como.faltanLosDatos) return null;

  const { cobro } = trabajo;
  const clave = cobro.cbu === null ? null : claveBancariaDe(cobro.cbu);

  return (
    <section
      aria-label="Cómo pagar"
      className="mt-5 rounded-panel border border-hairline bg-surface px-4 py-3.5"
    >
      <h2 className="text-section font-semibold">{como.titulo}</h2>

      <div className="mt-1.5">
        {como.monto !== null && como.montoParaPegar !== null && (
          <DatoCopiable
            etiqueta={como.etiquetaDelImporte}
            valor={formatearPesos(como.monto)}
            paraCopiar={como.montoParaPegar}
            nombre="Copiar el monto"
            destacado
          />
        )}

        {como.transferencia && (
          <>
            {cobro.alias !== null && (
              <DatoCopiable etiqueta="Alias" valor={cobro.alias} nombre="Copiar el alias" />
            )}
            {cobro.cbu !== null && (
              <DatoCopiable
                etiqueta={clave === 'cvu' ? 'CVU' : 'CBU'}
                valor={formatearCbu(cobro.cbu)}
                paraCopiar={cobro.cbu}
                nombre={clave === 'cvu' ? 'Copiar el CVU' : 'Copiar el CBU'}
              />
            )}
            {cobro.titular !== null && (
              <DatoCopiable
                etiqueta="Titular de la cuenta"
                valor={cobro.titular}
                nombre="Copiar el titular"
              />
            )}
            {cobro.cuit !== null && (
              <DatoCopiable
                etiqueta="CUIT del titular"
                valor={cobro.cuit}
                nombre="Copiar el CUIT"
              />
            )}
          </>
        )}
      </div>

      {como.transferencia && (
        <p className="mt-2.5 text-label leading-relaxed text-text-2">{como.pasos}</p>
      )}

      {como.transferencia && (cobro.titular !== null || cobro.cuit !== null) && (
        <p className="mt-1.5 text-label leading-relaxed text-text-2">
          Antes de confirmar, tu banco te muestra a nombre de quién está la cuenta: fijate que sea
          esta.
        </p>
      )}

      {como.faltanLosDatos && (
        <p className="mt-1.5 text-label leading-relaxed text-text-2">{PEDILE_LOS_DATOS}</p>
      )}

      {como.efectivo && (
        <p className="mt-1.5 text-label leading-relaxed text-text-2">{como.enEfectivo}</p>
      )}

      {como.siguiente !== null && <DespuesViene siguiente={como.siguiente} />}
    </section>
  );
}
