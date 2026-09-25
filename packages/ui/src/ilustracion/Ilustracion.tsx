import type { ComponentType } from 'react';

import {
  AgendaVacia,
  Anulado,
  Gracias,
  SeCorto,
  SinClientes,
  SinConsultas,
  SinMovimientos,
  SinOpiniones,
  SinProyectos,
  SinSenal,
  SinSeguimiento,
} from './escenas.tsx';
import { TableroEntero } from './TableroCortado.tsx';

interface PropsDeLaEscena {
  animar: boolean;
}

function SinHistorial() {
  return <TableroEntero formato="escena" />;
}

const ESCENAS = {
  'sin-proyectos': SinProyectos,
  'sin-historial': SinHistorial,
  'sin-consultas': SinConsultas,
  'sin-seguimiento': SinSeguimiento,
  'sin-clientes': SinClientes,
  'sin-movimientos': SinMovimientos,
  'sin-opiniones': SinOpiniones,
  'agenda-vacia': AgendaVacia,
  'sin-senal': SinSenal,
  'se-corto': SeCorto,
  anulado: Anulado,
  gracias: Gracias,
} as const satisfies Record<string, ComponentType<PropsDeLaEscena>>;

export type NombreDeIlustracion = keyof typeof ESCENAS;

export const NOMBRES_DE_ILUSTRACION = Object.keys(ESCENAS) as readonly NombreDeIlustracion[];

export interface IlustracionProps {
  nombre: NombreDeIlustracion;
  animar?: boolean;
}

export function Ilustracion({ nombre, animar = false }: IlustracionProps) {
  const Dibujo: ComponentType<PropsDeLaEscena> = ESCENAS[nombre];
  return <Dibujo animar={animar} />;
}
