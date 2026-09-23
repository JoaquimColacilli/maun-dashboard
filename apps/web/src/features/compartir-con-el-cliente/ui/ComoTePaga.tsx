import { conLaForma, FORMAS_DE_COBRO, ofrece, type FormaDeCobro } from '@maun/domain';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import {
  cambioDeFormas,
  elTallerRecibeTransferencias,
  ETIQUETA_DE_LA_FORMA,
  formasComoEstan,
  MUTACION_DE_FORMAS_DE_COBRO,
  NOMBRE_DE_LA_INSTANCIA,
  type ResumenDeProyecto,
} from '@/entities/proyecto';
import { useReplicaDelTaller } from '@/entities/replica';
import { ajustesDe, mensajeDeSincronizacion } from '@/shared/api';
import { metaDeAvisos, RUTA_DE_AJUSTES, Ir } from '@/shared/lib';
import { Icono } from '@/shared/ui';

import {
  AL_MENOS_UNA,
  filasDeCobro,
  NADA_QUE_COBRAR,
  SIN_DATOS_PARA_TRANSFERIR,
} from '../model/comoTePaga';

export interface ComoTePagaProps {
  resumen: ResumenDeProyecto;
}

export function ComoTePaga({ resumen }: ComoTePagaProps) {
  const replica = useReplicaDelTaller();
  const ajustes = ajustesDe(replica);
  const guardar = useMutation({
    ...MUTACION_DE_FORMAS_DE_COBRO,
    meta: metaDeAvisos('formasDeCobro', { errorEnPantalla: true }),
  });
  const [insistiendo, setInsistiendo] = useState<string | null>(null);

  const filas = filasDeCobro(resumen, ajustes);
  const hayComoTransferir = elTallerRecibeTransferencias(ajustes);

  function tocar(
    instancia: 'sena' | 'saldo',
    forma: FormaDeCobro,
    formas: readonly FormaDeCobro[],
  ) {
    const siguiente = conLaForma(formas, forma, !ofrece(formas, forma));
    if (siguiente === null) {
      setInsistiendo(`${instancia}:${forma}`);
      return;
    }
    setInsistiendo(null);
    guardar.mutate({
      id: resumen.proyecto.id,
      cambios: cambioDeFormas(instancia, siguiente),
      previos: formasComoEstan(resumen.proyecto),
      version: resumen.proyecto.version,
    });
  }

  return (
    <section aria-label="Cómo te paga" className="mt-7">
      <h2 className="text-section font-semibold">Cómo te paga</h2>
      <p className="mt-1.5 mb-3 max-w-[520px] text-body leading-normal text-text-2">
        Elegí por cada pago cómo se lo cobrás. Tu cliente lo ve en su página, al lado de cuánto
        tiene que pagarte. La transferencia no te cuesta comisión.
      </p>

      {filas.length === 0 ? (
        <p className="border-t border-hairline py-3.5 text-body text-text-2">{NADA_QUE_COBRAR}</p>
      ) : (
        <ul className="list-none">
          {filas.map(({ instancia, formas }) => (
            <li
              key={instancia}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-hairline-soft py-3"
            >
              <span className="min-w-0 flex-1 text-body font-medium">
                {NOMBRE_DE_LA_INSTANCIA[instancia]}
              </span>
              <div
                role="group"
                aria-label={`${NOMBRE_DE_LA_INSTANCIA[instancia]}: cómo te la paga`}
                className="flex flex-none gap-0.5 rounded-field bg-surface p-1"
              >
                {FORMAS_DE_COBRO.map((forma) => {
                  const elegida = ofrece(formas, forma);
                  return (
                    <button
                      key={forma}
                      type="button"
                      role="checkbox"
                      aria-checked={elegida}
                      onClick={() => {
                        tocar(instancia, forma, formas);
                      }}
                      className={`flex min-h-tap items-center gap-1.5 rounded-control px-3 text-label ${
                        elegida
                          ? 'bg-elevado font-semibold text-ink shadow-float'
                          : 'font-medium text-text-2'
                      }`}
                    >
                      <Icono
                        nombre={elegida ? 'check' : 'plus'}
                        tamano={14}
                        className={elegida ? '' : 'text-text-3'}
                      />
                      {ETIQUETA_DE_LA_FORMA[forma]}
                    </button>
                  );
                })}
              </div>
              {FORMAS_DE_COBRO.some((forma) => insistiendo === `${instancia}:${forma}`) && (
                <p role="alert" className="w-full text-label leading-normal text-atencion">
                  {AL_MENOS_UNA}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {!hayComoTransferir && filas.length > 0 && (
        <p className="mt-2.5 flex flex-wrap items-baseline gap-x-1.5 text-label leading-normal text-text-2">
          <Icono nombre="circle-alert" tamano={14} className="translate-y-0.5 text-atencion" />
          <span>{SIN_DATOS_PARA_TRANSFERIR}</span>
          <Ir a={RUTA_DE_AJUSTES} className="font-semibold underline">
            Cargalos en Ajustes
          </Ir>
        </p>
      )}

      {guardar.isError && (
        <p role="alert" className="mt-2 text-label font-medium text-alerta">
          {mensajeDeSincronizacion(guardar.error, {
            operacion: 'proyecto',
            sujeto: resumen.proyecto.titulo,
          })}
        </p>
      )}
    </section>
  );
}
