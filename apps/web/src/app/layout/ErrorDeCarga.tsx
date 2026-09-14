import { BotonSalir } from '@/features/cerrar-sesion';
import { mensajeDeSincronizacion } from '@/shared/api';
import { Aviso, Button, Cargando } from '@/shared/ui';

export function CargaQueTarda({ que, reintentar }: { que: string; reintentar: () => void }) {
  return (
    <div className="flex flex-col">
      <Cargando que={que} />
      <div className="mx-auto flex w-full max-w-content flex-col items-start gap-3 px-(--page-pad-mobile) pb-8 md:px-(--page-pad-tablet)">
        <p role="status" className="text-body leading-relaxed text-text-2">
          Está tardando más de lo normal. Sigue intentando solo; si no avanza, reintentá o cerrá
          sesión.
        </p>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button onClick={reintentar}>Reintentar</Button>
          <BotonSalir />
        </div>
      </div>
    </div>
  );
}

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
