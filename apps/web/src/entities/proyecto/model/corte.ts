import { CERO, maximo, mesDe, restar, sumar, sumarTodos, type Money } from '@maun/domain';

import { filasDe, type Replica } from '@/shared/api';
import { nombreDelMes, TESORO } from '@/shared/lib';
import type { PiezaDelTablero } from '@/shared/ui';

import { distribucionCongelada } from './despiece';
import { porcentaje } from './porcentaje';

export interface CorteDelMes {
  trabajos: number;
  tablero: Money;
  hogar: Money;
  maun: Money;
  diezmo: Money;
  gastos: Money;
}

const PARTES = ['hogar', 'maun', 'diezmo'] as const;

const A_DONDE_VA: Readonly<Record<(typeof PARTES)[number], string>> = {
  hogar: 'al hogar',
  maun: 'al taller',
  diezmo: 'al diezmo',
};

export function corteDelMes(replica: Replica, mes: string): CorteDelMes | null {
  let trabajos = 0;
  let tablero = CERO;
  let hogar = CERO;
  let maun = CERO;
  let diezmo = CERO;

  for (const proyecto of filasDe(replica, 'proyectos')) {
    if (proyecto.fecha_cobro === null || mesDe(proyecto.fecha_cobro) !== mes) continue;
    const distribucion = distribucionCongelada(proyecto);
    if (distribucion === null) continue;
    trabajos += 1;
    tablero = sumar(tablero, distribucion.cobrado);
    hogar = sumar(hogar, distribucion.sueldo);
    maun = sumarTodos([maun, distribucion.fijos, maximo(distribucion.remanente, CERO)]);
    diezmo = sumar(diezmo, distribucion.diezmo);
  }

  if (trabajos === 0) return null;
  return {
    trabajos,
    tablero,
    hogar,
    maun,
    diezmo,
    gastos: restar(tablero, sumarTodos([hogar, maun, diezmo])),
  };
}

export function piezasDelCorte(corte: CorteDelMes): PiezaDelTablero[] {
  if (corte.tablero === 0) return [];
  const piezas = [
    { id: 'hogar', tono: 'hogar', nombre: TESORO.hogar.nombre, monto: corte.hogar },
    { id: 'maun', tono: 'maun', nombre: TESORO.maun.nombre, monto: corte.maun },
    { id: 'diezmo', tono: 'diezmo', nombre: TESORO.diezmo.nombre, monto: corte.diezmo },
    { id: 'gastos', tono: 'sobrante', nombre: 'Gastos', monto: corte.gastos },
  ] as const;

  return piezas
    .filter((pieza) => pieza.monto > 0)
    .map(({ monto, ...pieza }) => {
      const parte = monto / corte.tablero;
      return { ...pieza, parte, porcentaje: porcentaje(parte) };
    });
}

function enLista(partes: readonly string[]): string {
  const ultima = partes.at(-1) ?? '';
  if (partes.length < 2) return ultima;
  return `${partes.slice(0, -1).join(', ')} y ${ultima}`;
}

function parteDelTablero(monto: Money, tablero: Money): string {
  const texto = porcentaje(monto / tablero);
  return texto === '0%' ? 'menos del 1%' : texto;
}

export function fraseDelCorte(corte: CorteDelMes | null, mes: string): string {
  const nombre = nombreDelMes(mes);
  if (corte === null) {
    return `${nombre} todavía no se cortó. Cuando cierres un trabajo, acá vas a ver a dónde va cada peso.`;
  }

  const enElMes = nombre.toLowerCase();
  const cerrados =
    corte.trabajos === 1
      ? `Un trabajo cerrado en ${enElMes}`
      : `${String(corte.trabajos)} trabajos cerrados en ${enElMes}`;
  if (corte.tablero === 0) return `${cerrados}, sin nada cobrado: no hubo nada para repartir.`;

  const partes = PARTES.filter((parte) => corte[parte] > 0).map(
    (parte) => `${parteDelTablero(corte[parte], corte.tablero)} ${A_DONDE_VA[parte]}`,
  );
  if (partes.length === 0) {
    return `${cerrados}, y los gastos se comieron lo cobrado: no quedó ganancia para repartir.`;
  }

  const gastos = corte.gastos > 0 ? ' Lo demás fueron gastos.' : '';
  return `${cerrados}: ${enLista(partes)}.${gastos}`;
}
