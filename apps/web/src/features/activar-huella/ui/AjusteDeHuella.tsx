import { useEffect, useState } from 'react';

import { useSesionActiva } from '@/entities/sesion';
import { avisarEnPantalla, huellaDisponible, olvidarBloqueo, useBloqueoActivo } from '@/shared/lib';
import { Button, Icono } from '@/shared/ui';

import { activarHuella } from '../model/activar';

export function AjusteDeHuella() {
  const { usuarioId } = useSesionActiva();
  const activo = useBloqueoActivo(usuarioId);
  const [disponible, setDisponible] = useState<boolean | undefined>(undefined);
  const [activando, setActivando] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let vigente = true;
    void huellaDisponible().then((hay) => {
      if (vigente) setDisponible(hay);
    });
    return () => {
      vigente = false;
    };
  }, []);

  async function activar(): Promise<void> {
    setActivando(true);
    setError(undefined);
    const fallo = await activarHuella(usuarioId);
    setActivando(false);
    if (fallo !== undefined) {
      setError(fallo);
      return;
    }
    avisarEnPantalla({
      clave: 'huella',
      tono: 'hecho',
      texto: 'Listo: la próxima vez que abras la app te pide la huella.',
    });
  }

  function desactivar(): void {
    olvidarBloqueo();
    setError(undefined);
    avisarEnPantalla({
      clave: 'huella',
      tono: 'hecho',
      texto: 'La app ya no pide la huella en este teléfono.',
    });
  }

  let descripcion =
    'La app se abre sin pedir nada. Podés hacer que te pida la huella, como la app del banco.';
  if (disponible === undefined) descripcion = 'Fijándonos si este teléfono tiene huella…';
  if (disponible === false) {
    descripcion =
      'Este teléfono no tiene huella ni bloqueo de pantalla configurado, así que la app no puede pedirla.';
  }
  if (activo) {
    descripcion =
      'Este teléfono tiene el bloqueo con huella: la app te la pide cada vez que la abrís, también sin señal.';
  }

  return (
    <div className="flex flex-col items-start gap-2.5">
      <p className="text-body leading-relaxed text-text-2">{descripcion}</p>
      {activo ? (
        <Button variant="secundario" size="chico" onClick={desactivar}>
          Dejar de pedir la huella
        </Button>
      ) : (
        disponible === true && (
          <Button
            variant="secundario"
            size="chico"
            cargando={activando}
            onClick={() => {
              void activar();
            }}
          >
            {!activando && <Icono nombre="fingerprint" tamano={18} />}
            {activando ? 'Registrando la huella…' : 'Pedir la huella al abrir'}
          </Button>
        )
      )}
      {error !== undefined && (
        <p role="alert" className="text-label leading-relaxed font-medium text-alerta">
          {error}
        </p>
      )}
    </div>
  );
}
