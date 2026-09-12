import { formatearCuit, LARGO_DE_CUIT, revisarCuit } from '@maun/domain';
import { z } from 'zod';

import { COLUMNAS_DE_CLIENTE, type DatosDeCliente } from '@/shared/api';

import { CONDICIONES_EN_ORDEN, ORIGENES_EN_ORDEN, type Cliente } from './catalogos';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function largoDeCuitAceptable(cuit: string): boolean {
  const revision = revisarCuit(cuit);
  return revision.estado !== 'invalido' || revision.motivo !== 'largo';
}

export const CLIENTE_EN_BLANCO: DatosDeCliente = {
  nombre: '',
  zona: '',
  telefono: '',
  email: '',
  direccion: '',
  origen_contacto: null,
  origen_detalle: '',
  condicion_fiscal: 'consumidor_final',
  cuit: '',
  razon_social: '',
  domicilio_fiscal: '',
  notas: '',
};

function texto(maximo: number) {
  return z
    .string()
    .trim()
    .max(maximo, { error: `No puede pasar de ${String(maximo)} caracteres.` });
}

export const esquemaDeCliente = z.object({
  nombre: texto(200).min(1, { error: 'El nombre es lo único que no puede faltar.' }),
  zona: texto(200),
  telefono: texto(200),
  email: texto(200).refine((valor) => valor === '' || EMAIL.test(valor), {
    error: 'Revisá el mail: le falta el arroba o el punto.',
  }),
  direccion: texto(500),
  origen_contacto: z.enum(ORIGENES_EN_ORDEN).nullable(),
  origen_detalle: texto(500),
  condicion_fiscal: z.enum(CONDICIONES_EN_ORDEN),
  cuit: texto(20).refine(largoDeCuitAceptable, {
    error: `Un CUIT tiene ${String(LARGO_DE_CUIT)} dígitos. Dejalo vacío si no lo tenés a mano.`,
  }),
  razon_social: texto(200),
  domicilio_fiscal: texto(500),
  notas: texto(10_000),
});

export type FormularioDeCliente = z.infer<typeof esquemaDeCliente>;

export function advertenciaDeCuit(cuit: string): string | undefined {
  const revision = revisarCuit(cuit);
  if (revision.estado === 'ambiguo') {
    return 'El verificador de este CUIT cae en el caso que no tiene convención única. Guardalo igual si lo copiaste bien.';
  }
  if (revision.estado === 'invalido' && revision.motivo === 'prefijo') {
    return 'Los CUIT arrancan con 20, 23, 24, 27, 30, 33 o 34. Guardalo igual si es el que te pasaron.';
  }
  if (revision.estado === 'invalido' && revision.motivo === 'verificador') {
    return 'El dígito verificador no cierra. Revisalo, pero podés guardarlo igual.';
  }
  return undefined;
}

export function valoresDelFormulario(cliente: Cliente | undefined): FormularioDeCliente {
  const datos = cliente ?? CLIENTE_EN_BLANCO;
  return {
    nombre: datos.nombre,
    zona: datos.zona,
    telefono: datos.telefono,
    email: datos.email,
    direccion: datos.direccion,
    origen_contacto: datos.origen_contacto,
    origen_detalle: datos.origen_detalle,
    condicion_fiscal: datos.condicion_fiscal,
    cuit: datos.cuit,
    razon_social: datos.razon_social,
    domicilio_fiscal: datos.domicilio_fiscal,
    notas: datos.notas,
  };
}

export function datosDelFormulario(valores: FormularioDeCliente): DatosDeCliente {
  return { ...valores, cuit: formatearCuit(valores.cuit) };
}

export function cambiosDeCliente(
  antes: DatosDeCliente,
  ahora: DatosDeCliente,
): Partial<DatosDeCliente> {
  const cambios: Partial<DatosDeCliente> = {};
  for (const columna of COLUMNAS_DE_CLIENTE) {
    if (antes[columna] === ahora[columna]) continue;
    if (columna === 'origen_contacto') cambios.origen_contacto = ahora.origen_contacto;
    else if (columna === 'condicion_fiscal') cambios.condicion_fiscal = ahora.condicion_fiscal;
    else cambios[columna] = ahora[columna];
  }
  return cambios;
}
