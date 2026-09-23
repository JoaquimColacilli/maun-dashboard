export { claveDeReplica, claveDeTodaReplica, RAIZ_DE_REPLICA } from '@/shared/lib';
export {
  sincronizarAhora,
  useSincronizarAhora,
  type DesenlaceDeLaSincronizacion,
} from './api/sincronizarAhora';
export { MINIMO_ENTRE_PEDIDOS_MS, useCambiosEnVivo } from './api/useCambiosEnVivo';
export { useReplica } from './api/useReplica';
export { describirDesenlace, type DescripcionDelDesenlace } from './model/desenlace';
export { useReplicaDelTaller } from './model/contexto';
export { ProveedorDeReplica } from './ui/ProveedorDeReplica';
