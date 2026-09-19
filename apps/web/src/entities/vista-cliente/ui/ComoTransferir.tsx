import { claveBancariaDe, formatearCbu, type CobroDelTaller } from '@maun/domain';

import { DatoCopiable } from '@/shared/ui';

export interface ComoTransferirProps {
  cobro: CobroDelTaller;
}

export function ComoTransferir({ cobro }: ComoTransferirProps) {
  const clave = cobro.cbu === null ? null : claveBancariaDe(cobro.cbu);

  return (
    <section
      aria-label="Cómo transferir"
      className="mt-5 rounded-panel border border-hairline bg-surface px-4 py-3.5"
    >
      <h2 className="text-section font-semibold">Para transferirle al taller</h2>

      <div className="mt-1.5">
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
          <DatoCopiable etiqueta="CUIT del titular" valor={cobro.cuit} nombre="Copiar el CUIT" />
        )}
      </div>

      {(cobro.titular !== null || cobro.cuit !== null) && (
        <p className="mt-2.5 text-label leading-relaxed text-text-2">
          Antes de confirmar, tu banco te muestra a nombre de quién está la cuenta: fijate que sea
          esta.
        </p>
      )}
    </section>
  );
}
