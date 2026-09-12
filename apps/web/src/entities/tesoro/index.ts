// El catálogo de tesoros vive en shared/lib y no acá: lo necesitan Inicio (por esta entidad) y el
// despiece de la distribución (entities/proyecto), y un slice de entities no puede importar a otro.
// Esta re-exportación deja la API pública de la entidad como estaba (ADR 0014 hizo lo mismo con las
// claves de la réplica).
export { TESORO, TESOROS_EN_ORDEN, type DatosDelTesoro } from '@/shared/lib';
