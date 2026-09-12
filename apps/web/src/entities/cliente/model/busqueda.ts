import { ORIGEN, ORIGENES_EN_ORDEN, type DatosDelOrigen } from './catalogos';
import type { ResumenDeCliente } from './resumen';

export type Orden = 'nombre' | 'ultimo' | 'facturado';

export const ORDENES: readonly { id: Orden; etiqueta: string }[] = [
  { id: 'nombre', etiqueta: 'Nombre' },
  { id: 'ultimo', etiqueta: 'Último trabajo' },
  { id: 'facturado', etiqueta: 'Total facturado' },
];

function sinAcentos(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

// La réplica está en memoria: la búsqueda responde desde la primera letra y no hay debounce.
export function buscarClientes(
  resumenes: readonly ResumenDeCliente[],
  consulta: string,
): ResumenDeCliente[] {
  const texto = sinAcentos(consulta.trim());
  if (texto === '') return [...resumenes];
  const digitos = texto.replace(/\D/g, '');

  return resumenes.filter(({ cliente }) => {
    const campos = [cliente.nombre, cliente.zona, cliente.direccion, cliente.razon_social];
    if (campos.some((campo) => sinAcentos(campo).includes(texto))) return true;
    return digitos !== '' && cliente.telefono.replace(/\D/g, '').includes(digitos);
  });
}

export function ordenarClientes(
  resumenes: readonly ResumenDeCliente[],
  orden: Orden,
): ResumenDeCliente[] {
  const lista = [...resumenes];
  if (orden === 'nombre') {
    return lista.sort((uno, otro) =>
      uno.cliente.nombre.localeCompare(otro.cliente.nombre, 'es', { sensitivity: 'base' }),
    );
  }
  if (orden === 'facturado') {
    return lista.sort((uno, otro) => otro.facturado - uno.facturado);
  }
  return lista.sort((uno, otro) =>
    (otro.fechaDelUltimo ?? '').localeCompare(uno.fechaDelUltimo ?? ''),
  );
}

export interface CorteDeOrigen extends DatosDelOrigen {
  cantidad: number;
}

// De dónde vienen los trabajos: el único dato agregado de esta pantalla que sirve para decidir
// dónde poner esfuerzo. Los orígenes sin clientes no ocupan lugar.
export function corteDeOrigenes(resumenes: readonly ResumenDeCliente[]): CorteDeOrigen[] {
  return ORIGENES_EN_ORDEN.map((id) => ({
    ...ORIGEN[id],
    cantidad: resumenes.filter(({ cliente }) => cliente.origen_contacto === id).length,
  }))
    .filter((corte) => corte.cantidad > 0)
    .sort((uno, otro) => otro.cantidad - uno.cantidad);
}
