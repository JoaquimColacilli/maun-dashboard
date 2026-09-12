import { BotonSalir } from '@/features/cerrar-sesion';
import { mensajeDeSincronizacion } from '@/shared/api';
import { Aviso, Button } from '@/shared/ui';

const SIN_NADA_GUARDADO =
  'En este dispositivo todavía no hay nada guardado para mostrarte mientras tanto.';

export function ErrorDeCarga({
  error,
  reintentar,
  detalle = SIN_NADA_GUARDADO,
}: {
  error: unknown;
  reintentar: () => void;
  detalle?: string;
}) {
  return (
    <Aviso
      titulo="No pudimos leer tus datos"
      mensaje={mensajeDeSincronizacion(error)}
      detalle={detalle}
    >
      <Button onClick={reintentar}>Reintentar</Button>
      <BotonSalir />
    </Aviso>
  );
}
