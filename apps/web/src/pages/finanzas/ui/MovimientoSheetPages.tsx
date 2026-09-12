import { Navigate, useParams, useSearchParams } from 'react-router';

import { CLASES_EN_ORDEN, type ClaseDeMovimiento } from '@/entities/movimiento';
import { useReplicaDelTaller } from '@/entities/replica';
import { HojaDeMovimiento } from '@/features/registrar-movimiento';
import { ajustesDe, filaPorId, saldosDeLaReplica } from '@/shared/api';
import { RUTA_DE_FINANZAS, useCerrarHoja } from '@/shared/lib';

function esClase(valor: string | null): valor is ClaseDeMovimiento {
  return valor !== null && (CLASES_EN_ORDEN as readonly string[]).includes(valor);
}

export function MovimientoNuevoPage() {
  const replica = useReplicaDelTaller();
  const cerrar = useCerrarHoja();
  const [parametros] = useSearchParams();
  const clase = parametros.get('clase');

  return (
    <HojaDeMovimiento
      claseInicial={esClase(clase) ? clase : undefined}
      saldos={saldosDeLaReplica(replica)}
      metaCocos={ajustesDe(replica)?.meta_cocos_centavos ?? 0}
      alCerrar={cerrar}
    />
  );
}

export function MovimientoEdicionPage() {
  const replica = useReplicaDelTaller();
  const cerrar = useCerrarHoja();
  const { id = '' } = useParams();
  const movimiento = filaPorId(replica, 'movimientos', id);

  if (!movimiento) return <Navigate to={RUTA_DE_FINANZAS} replace />;

  return (
    <HojaDeMovimiento
      movimiento={movimiento}
      saldos={saldosDeLaReplica(replica)}
      metaCocos={ajustesDe(replica)?.meta_cocos_centavos ?? 0}
      alCerrar={cerrar}
    />
  );
}
