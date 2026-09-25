export {
  claveDeLaVistaCompartida,
  claveDeLaVistaDelTrabajo,
  elEnlaceNoSirve,
  NO_SIRVE,
  RAIZ_DE_LA_VISTA,
  useVistaCompartida,
  useVistaDelTrabajo,
  type ResultadoDeLaVista,
} from './api/consulta';
export { resultadoDelError, resultadoDeResponder, useMandarLaEntrega } from './api/responder';
export { AyudaDeLaVista, type AyudaDeLaVistaProps } from './ui/AyudaDeLaVista';
export { CaminoDeHitos, type CaminoDeHitosProps } from './ui/CaminoDeHitos';
export { ComoPagar, type ComoPagarProps } from './ui/ComoPagar';
export { CoordinarLaEntrega, type CoordinarLaEntregaProps } from './ui/CoordinarLaEntrega';
export type { MandarLaEntrega, ResultadoDeMandar } from './model/mandar';
export {
  ACA_NO_SE_GUARDA_NADA,
  COORDINEMOS_LA_ENTREGA,
  EL_PAGO_SE_COORDINA,
  LOS_PAGOS_LOS_ANOTA_EL_TALLER,
  NO_QUEDA_NADA,
  pieDeLosPagos,
  SIN_PAGOS_APROBADO,
  sinPagosTodavia,
} from './model/textos';
export { VistaDelCliente, type VistaDelClienteProps } from './ui/VistaDelCliente';
export { PantallaDeLaVista, type PantallaDeLaVistaProps } from './ui/PantallaDeLaVista';
