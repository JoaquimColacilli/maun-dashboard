import { useEffect, useState } from 'react';

import { enlaceActivo } from '@/entities/enlace';
import { useReplicaDelTaller } from '@/entities/replica';
import { filasDe } from '@/shared/api';
import { ConSalida, Icono, precargarElQr } from '@/shared/ui';

import { comoSeVeElEnlace } from '../model/compartir';
import { HojaDelQr } from './HojaDelQr';

export interface BotonDelQrProps {
  proyectoId: string;
  trabajo: string;
  className?: string;
}

export const MOSTRAR_EL_QR = 'Mostrarle el código QR';

export function BotonDelQr({ proyectoId, trabajo, className = '' }: BotonDelQrProps) {
  const replica = useReplicaDelTaller();
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    precargarElQr();
  }, []);

  const activo = enlaceActivo(replica, proyectoId);
  const huboAlguno = filasDe(replica, 'enlaces_publicos').some(
    (enlace) => enlace.proyecto_id === proyectoId,
  );
  const vista = comoSeVeElEnlace(activo, huboAlguno);
  if (vista.como !== 'activo') return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setAbierto(true);
        }}
        className={`flex min-h-tap w-fit items-center gap-2 rounded-field border border-border px-3 text-label font-medium hover:bg-surface ${className}`}
      >
        <Icono nombre="qr-code" tamano={16} />
        {MOSTRAR_EL_QR}
      </button>
      <ConSalida valor={abierto}>
        {() => (
          <HojaDelQr
            trabajo={trabajo}
            url={vista.url}
            alCerrar={() => {
              setAbierto(false);
            }}
          />
        )}
      </ConSalida>
    </>
  );
}
