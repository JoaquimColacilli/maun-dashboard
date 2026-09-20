import {
  formasDeCobro,
  hayComoTransferir,
  INSTANCIAS_DE_PAGO,
  type CobroDelTaller,
  type FormaDeCobro,
  type InstanciaDePago,
} from '@maun/domain';

import type { CambiosDeFormasDeCobro, ColumnaDeFormaDeCobro, FilaDe } from '@/shared/api';

import type { Proyecto } from './catalogos';

export const COLUMNA_DE_LA_INSTANCIA: Readonly<Record<InstanciaDePago, ColumnaDeFormaDeCobro>> = {
  sena: 'cobro_sena',
  saldo: 'cobro_saldo',
};

export const NOMBRE_DE_LA_INSTANCIA: Readonly<Record<InstanciaDePago, string>> = {
  sena: 'La seña',
  saldo: 'El saldo',
};

export const ETIQUETA_DE_LA_FORMA: Readonly<Record<FormaDeCobro, string>> = {
  transferencia: 'Transferencia',
  efectivo: 'Efectivo',
};

type FilaQuizasSinFormas = Partial<Pick<Proyecto, ColumnaDeFormaDeCobro>>;

export function vacioEsNulo(valor: string | undefined): string | null {
  const limpio = (valor ?? '').trim();
  return limpio === '' ? null : limpio;
}

export function cobroDelTaller(ajustes: FilaDe<'ajustes'> | undefined): CobroDelTaller {
  return {
    alias: vacioEsNulo(ajustes?.cobro_alias),
    cbu: vacioEsNulo(ajustes?.cobro_cbu),
    titular: vacioEsNulo(ajustes?.cobro_titular),
    cuit: vacioEsNulo(ajustes?.cobro_cuit),
  };
}

export function elTallerRecibeTransferencias(ajustes: FilaDe<'ajustes'> | undefined): boolean {
  return hayComoTransferir(cobroDelTaller(ajustes));
}

export function formasGuardadas(
  proyecto: Proyecto,
  instancia: InstanciaDePago,
): readonly FormaDeCobro[] | null {
  return (proyecto as FilaQuizasSinFormas)[COLUMNA_DE_LA_INSTANCIA[instancia]] ?? null;
}

export function formasDelTrabajo(
  proyecto: Proyecto,
  instancia: InstanciaDePago,
  ajustes: FilaDe<'ajustes'> | undefined,
): readonly FormaDeCobro[] {
  return formasDeCobro(formasGuardadas(proyecto, instancia), elTallerRecibeTransferencias(ajustes));
}

export function cambioDeFormas(
  instancia: InstanciaDePago,
  formas: readonly FormaDeCobro[],
): CambiosDeFormasDeCobro {
  return { [COLUMNA_DE_LA_INSTANCIA[instancia]]: [...formas] };
}

function comoEstan(proyecto: Proyecto, instancia: InstanciaDePago): FormaDeCobro[] | null {
  const guardadas = formasGuardadas(proyecto, instancia);
  return guardadas === null ? null : [...guardadas];
}

export function formasComoEstan(proyecto: Proyecto): CambiosDeFormasDeCobro {
  return {
    cobro_sena: comoEstan(proyecto, 'sena'),
    cobro_saldo: comoEstan(proyecto, 'saldo'),
  };
}

function iguales(
  una: readonly FormaDeCobro[] | null,
  otra: readonly FormaDeCobro[] | null | undefined,
): boolean {
  if (una === null || otra === null || otra === undefined) return una === (otra ?? null);
  return una.length === otra.length && una.every((forma, indice) => forma === otra[indice]);
}

export function cambiaAlgunaForma(proyecto: Proyecto, cambios: CambiosDeFormasDeCobro): boolean {
  return INSTANCIAS_DE_PAGO.some((instancia) => {
    const columna = COLUMNA_DE_LA_INSTANCIA[instancia];
    if (!(columna in cambios)) return false;
    return !iguales(formasGuardadas(proyecto, instancia), cambios[columna]);
  });
}
