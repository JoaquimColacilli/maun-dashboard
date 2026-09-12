export {
  CLAVE_DE_BAJA_DE_CLIENTE,
  CLAVE_DE_CLIENTE,
  CLAVE_DE_CLIENTE_NUEVO,
  MUTACION_DE_BAJA_DE_CLIENTE,
  MUTACION_DE_CLIENTE,
  MUTACION_DE_CLIENTE_NUEVO,
  type BajaDeCliente,
  type EdicionDeCliente,
} from './api/mutacion';
export {
  buscarClientes,
  corteDeOrigenes,
  ordenarClientes,
  ORDENES,
  type CorteDeOrigen,
  type Orden,
} from './model/busqueda';
export {
  CONDICION,
  CONDICIONES_EN_ORDEN,
  etiquetaDeCuit,
  ORIGEN,
  ORIGENES_EN_ORDEN,
  pideDatosFiscales,
  type Cliente,
  type CondicionFiscal,
  type DatosDeLaCondicion,
  type DatosDelOrigen,
  type OrigenDeContacto,
} from './model/catalogos';
export {
  enlaceDeEmail,
  enlaceDeLlamada,
  enlaceDeMapa,
  enlaceDeWhatsapp,
  iniciales,
  nombreCorto,
  telefonoParaWhatsapp,
} from './model/contacto';
export {
  advertenciaDeCuit,
  cambiosDeCliente,
  CLIENTE_EN_BLANCO,
  datosDelFormulario,
  esquemaDeCliente,
  valoresDelFormulario,
  type FormularioDeCliente,
} from './model/formulario';
export {
  cobradoDelProyecto,
  fechaDelProyecto,
  resumenDeCliente,
  resumenesDeClientes,
  type Proyecto,
  type ResumenDeCliente,
} from './model/resumen';
export { AccionesDeContacto, type AccionesDeContactoProps } from './ui/AccionesDeContacto';
export { ClienteCombobox, type ClienteComboboxProps } from './ui/ClienteCombobox';
export { rutaDelCliente } from './model/rutas';
export { EnlaceACliente } from './ui/EnlaceACliente';
