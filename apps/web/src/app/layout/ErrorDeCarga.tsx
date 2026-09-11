import { BotonSalir } from '@/features/cerrar-sesion';
import { mensajeDeSincronizacion } from '@/shared/api';
import { Aviso, Button } from '@/shared/ui';

export function ErrorDeCarga({ error, reintentar }: { error: unknown; reintentar: () => void }) {
  return (
    <Aviso
      titulo="No pudimos leer tus datos"
      mensaje={mensajeDeSincronizacion(error)}
      detalle="En este dispositivo todavía no hay nada guardado para mostrarte mientras tanto."
    >
      <Button onClick={reintentar}>Reintentar</Button>
      <BotonSalir />
    </Aviso>
  );
}
