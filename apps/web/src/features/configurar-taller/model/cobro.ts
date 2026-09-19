import {
  claveBancariaDe,
  digitosDeCbu,
  formatearCbu,
  formatearCuit,
  normalizarAlias,
  revisarAlias,
  revisarCbu,
  revisarCuit,
} from '@maun/domain';

import type { CambiosDeAjustes, FilaDe } from '@/shared/api';

export type CampoDeCobro = 'alias' | 'cbu' | 'titular' | 'cuit';

export interface DatosDeCobro {
  alias: string;
  cbu: string;
  titular: string;
  cuit: string;
}

export interface ErrorDeCobro {
  campo: CampoDeCobro;
  mensaje: string;
}

export const LARGO_DEL_TITULAR = 200;

export function cobroDeLosAjustes(ajustes: FilaDe<'ajustes'>): DatosDeCobro {
  return {
    alias: ajustes.cobro_alias,
    cbu: formatearCbu(ajustes.cobro_cbu),
    titular: ajustes.cobro_titular,
    cuit: ajustes.cobro_cuit,
  };
}

export function cambiosDeCobro(datos: DatosDeCobro): CambiosDeAjustes {
  return {
    cobro_alias: normalizarAlias(datos.alias),
    cobro_cbu: digitosDeCbu(datos.cbu),
    cobro_titular: datos.titular.trim(),
    cobro_cuit: formatearCuit(datos.cuit),
  };
}

function errorDelAlias(alias: string): ErrorDeCobro | null {
  const revision = revisarAlias(alias);
  if (revision.estado !== 'invalido') return null;
  return {
    campo: 'alias',
    mensaje:
      revision.motivo === 'caracteres'
        ? 'Un alias lleva letras, números, punto y guion medio. Nada más: ni espacios, ni guion bajo, ni acentos.'
        : 'Un alias tiene entre 6 y 20 caracteres. Si no te acordás, miralo en tu banco.',
  };
}

function errorDelCbu(cbu: string): ErrorDeCobro | null {
  const revision = revisarCbu(cbu);
  if (revision.estado !== 'invalido') return null;
  return {
    campo: 'cbu',
    mensaje:
      revision.motivo === 'largo'
        ? 'Un CBU o un CVU tiene 22 dígitos. Copialo de tu banco, no lo escribas de memoria.'
        : revision.motivo === 'banco'
          ? 'Este número no cierra: el control del banco da otro dígito. Revisá los primeros ocho.'
          : 'Este número no cierra: el control de la cuenta da otro dígito. Revisá los últimos catorce.',
  };
}

function errorDelCuit(cuit: string): ErrorDeCobro | null {
  const revision = revisarCuit(cuit);
  if (revision.estado !== 'invalido' || revision.motivo !== 'largo') return null;
  return {
    campo: 'cuit',
    mensaje: 'Un CUIT tiene 11 dígitos. Dejalo vacío si no lo tenés a mano.',
  };
}

function errorDelTitular(titular: string): ErrorDeCobro | null {
  if (titular.trim().length <= LARGO_DEL_TITULAR) return null;
  return {
    campo: 'titular',
    mensaje: `El nombre del titular entra en ${String(LARGO_DEL_TITULAR)} caracteres.`,
  };
}

export function errorDeCobro(datos: DatosDeCobro): ErrorDeCobro | null {
  return (
    errorDelAlias(datos.alias) ??
    errorDelCbu(datos.cbu) ??
    errorDelTitular(datos.titular) ??
    errorDelCuit(datos.cuit)
  );
}

export function avisoDelAlias(alias: string): string | undefined {
  const revision = revisarAlias(alias);
  if (revision.estado !== 'valido' || revision.aviso === null) return undefined;
  return revision.aviso === 'separador-en-la-punta'
    ? 'Arranca o termina con un punto o un guion. La norma del banco central no lo prohíbe: si es el tuyo, guardalo igual.'
    : 'Tiene dos puntos o guiones seguidos. La norma del banco central no lo prohíbe: si es el tuyo, guardalo igual.';
}

export function avisoDelCuitDelTaller(cuit: string): string | undefined {
  const revision = revisarCuit(cuit);
  if (revision.estado === 'ambiguo') {
    return 'El verificador de este CUIT cae en el caso que no tiene una convención única. Guardalo igual si lo copiaste bien.';
  }
  if (revision.estado === 'invalido' && revision.motivo === 'prefijo') {
    return 'Los CUIT arrancan con 20, 23, 24, 27, 30, 33 o 34. Revisalo, pero podés guardarlo igual.';
  }
  if (revision.estado === 'invalido' && revision.motivo === 'verificador') {
    return 'El dígito verificador no cierra. Revisalo, pero podés guardarlo igual.';
  }
  return undefined;
}

export function etiquetaDeLaClave(cbu: string): string {
  return revisarCbu(cbu).estado === 'valido' && claveBancariaDe(cbu) === 'cvu'
    ? 'CVU de la billetera'
    : 'CBU o CVU';
}
