import { useEffect, useState } from 'react';

import { useSesionActiva } from '@/entities/sesion';
import {
  anotarPreguntaPorLaHuella,
  avisarEnPantalla,
  bloqueoDe,
  entroRecienConContrasena,
  esCelular,
  huellaDisponible,
  yaSePreguntoPorLaHuella,
} from '@/shared/lib';
import { Button, ConSalida, Hoja, Icono } from '@/shared/ui';

import { activarHuella } from '../model/activar';

export function OfertaDeHuella() {
  const { usuarioId } = useSesionActiva();
  const [abierta, setAbierta] = useState(false);
  const [activando, setActivando] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (
      !esCelular() ||
      !entroRecienConContrasena() ||
      yaSePreguntoPorLaHuella(usuarioId) ||
      bloqueoDe(usuarioId) !== null
    ) {
      return;
    }
    let vigente = true;
    void huellaDisponible().then((hay) => {
      if (!vigente || !hay) return;
      anotarPreguntaPorLaHuella(usuarioId);
      setAbierta(true);
    });
    return () => {
      vigente = false;
    };
  }, [usuarioId]);

  async function aceptar(): Promise<void> {
    setActivando(true);
    setError(undefined);
    const fallo = await activarHuella(usuarioId);
    setActivando(false);
    if (fallo !== undefined) {
      setError(fallo);
      return;
    }
    setAbierta(false);
    avisarEnPantalla({
      clave: 'huella',
      tono: 'hecho',
      texto: 'Listo: la próxima vez que abras la app te pide la huella.',
    });
  }

  return (
    <ConSalida valor={abierta}>
      {() => (
        <Hoja
          titulo="¿Querés entrar con la huella la próxima vez?"
          ancho="angosto"
          desdeAbajo
          alCerrar={() => {
            if (!activando) setAbierta(false);
          }}
        >
          <div className="flex flex-col gap-4 px-5 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:px-6 md:pb-5">
            <div className="flex items-start gap-3.5">
              <span
                aria-hidden
                className="flex size-11 flex-none items-center justify-center rounded-field bg-surface text-ink"
              >
                <Icono nombre="fingerprint" tamano={24} />
              </span>
              <p className="text-body leading-relaxed text-text-2">
                La app se abre pidiendo tu huella, como la del banco, y anda también sin señal. Si
                algún día la huella no responde, entrás con tu contraseña.
              </p>
            </div>
            {error !== undefined && (
              <p role="alert" className="text-label leading-relaxed font-medium text-alerta">
                {error}
              </p>
            )}
            <div className="flex flex-col gap-2">
              <Button
                size="grande"
                className="w-full"
                cargando={activando}
                onClick={() => {
                  void aceptar();
                }}
              >
                {activando ? 'Registrando la huella…' : 'Sí, usar la huella'}
              </Button>
              <Button
                variant="terciario"
                className="w-full"
                disabled={activando}
                onClick={() => {
                  setAbierta(false);
                }}
              >
                Ahora no
              </Button>
            </div>
            <p className="text-meta leading-relaxed text-text-3">
              Lo podés cambiar cuando quieras en Ajustes.
            </p>
          </div>
        </Hoja>
      )}
    </ConSalida>
  );
}
