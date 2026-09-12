import { criterioPorId, ordenar, type Criterio } from '@/shared/lib';

import { ORIGEN, ORIGENES_EN_ORDEN, type DatosDelOrigen } from './catalogos';
import type { ResumenDeCliente } from './resumen';

export type Orden = 'nombre' | 'ultimo' | 'facturado';

export const ORDENES: readonly (Criterio<ResumenDeCliente> & { id: Orden })[] = [
  {
    id: 'nombre',
    etiqueta: 'Nombre',
    tipo: 'texto',
    leer: (resumen) => resumen.cliente.nombre,
    inicial: 'asc',
  },
  {
    id: 'ultimo',
    etiqueta: 'Último trabajo',
    tipo: 'fecha',
    leer: (resumen) => resumen.fechaDelUltimo,
    inicial: 'desc',
  },
  {
    id: 'facturado',
    etiqueta: 'Total facturado',
    tipo: 'numero',
    leer: (resumen) => resumen.facturado,
    inicial: 'desc',
  },
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
  const criterio = criterioPorId(ORDENES, orden) ?? ORDENES[0];
  if (criterio === undefined) return [...resumenes];
  return ordenar(resumenes, criterio, criterio.inicial, (resumen) => resumen.cliente.nombre);
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
