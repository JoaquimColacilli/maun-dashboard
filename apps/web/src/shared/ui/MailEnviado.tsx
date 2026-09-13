import { useEffect, useState } from 'react';

import { Button } from '@maun/ui';

const ESPERA_PARA_REENVIAR_S = 60;

function reloj(segundos: number): string {
  const minutos = Math.floor(segundos / 60);
  return `${String(minutos)}:${String(segundos % 60).padStart(2, '0')}`;
}

export interface MailEnviadoProps {
  email: string;
  detalle: string;
  alCambiar: () => void;
  reenviar: () => Promise<string | undefined>;
}

export function MailEnviado({ email, detalle, alCambiar, reenviar }: MailEnviadoProps) {
  const [espera, setEspera] = useState(ESPERA_PARA_REENVIAR_S);
  const [reenviando, setReenviando] = useState(false);
  const [resultado, setResultado] = useState<{ error: boolean; texto: string } | undefined>(
    undefined,
  );

  useEffect(() => {
    if (espera <= 0) return;
    const tic = setTimeout(() => {
      setEspera((antes) => antes - 1);
    }, 1000);
    return () => {
      clearTimeout(tic);
    };
  }, [espera]);

  async function mandarDeNuevo(): Promise<void> {
    setReenviando(true);
    setResultado(undefined);
    const error = await reenviar();
    setReenviando(false);
    if (error === undefined) {
      setResultado({ error: false, texto: `Te lo mandamos de nuevo a ${email}.` });
      setEspera(ESPERA_PARA_REENVIAR_S);
      return;
    }
    setResultado({ error: true, texto: error });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex min-w-0 items-center gap-3 border-y border-hairline py-3">
        <dl className="min-w-0 flex-1">
          <dt className="text-meta text-text-2">Lo mandamos a</dt>
          <dd className="truncate text-body-lg font-semibold">{email}</dd>
        </dl>
        <Button variant="terciario" onClick={alCambiar} className="-mr-3 flex-none">
          Cambiar
        </Button>
      </div>

      <p className="text-body leading-relaxed text-text-2">{detalle}</p>

      <div className="flex flex-col gap-2.5">
        <Button
          variant="secundario"
          size="grande"
          className="w-full"
          disabled={espera > 0}
          cargando={reenviando}
          onClick={() => {
            void mandarDeNuevo();
          }}
        >
          {reenviando
            ? 'Mandándolo de nuevo…'
            : espera > 0
              ? `Reenviar en ${reloj(espera)}`
              : 'Reenviar el mail'}
        </Button>
        {resultado !== undefined && (
          <p
            role={resultado.error ? 'alert' : 'status'}
            className={`text-label leading-relaxed ${resultado.error ? 'font-medium text-alerta' : 'text-text-2'}`}
          >
            {resultado.texto}
          </p>
        )}
      </div>
    </div>
  );
}
