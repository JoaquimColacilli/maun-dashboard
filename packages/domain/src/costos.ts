import { restar, sumarTodos, type Money } from './money.ts';

export const CATEGORIAS_DE_COSTO = ['madera', 'herrajes', 'flete', 'ayudante'] as const;

export type CategoriaDeCosto = (typeof CATEGORIAS_DE_COSTO)[number];

export type CostosEstimados = Readonly<Record<CategoriaDeCosto, Money | null>>;

export const SIN_ESTIMAR: CostosEstimados = {
  madera: null,
  herrajes: null,
  flete: null,
  ayudante: null,
};

export interface EntradaDelMargen {
  presupuesto: Money | null;
  costos: CostosEstimados;
}

export type MargenDelTrabajo =
  | { situacion: 'sin-estimar' }
  | { situacion: 'sin-presupuesto'; estimado: Money; cargadas: number }
  | {
      situacion: 'con-margen';
      estimado: Money;
      cargadas: number;
      presupuesto: Money;
      margen: Money;
    };

export function categoriasEstimadas(costos: CostosEstimados): number {
  return CATEGORIAS_DE_COSTO.filter((categoria) => costos[categoria] !== null).length;
}

export function costoEstimado(costos: CostosEstimados): Money {
  return sumarTodos(
    CATEGORIAS_DE_COSTO.map((categoria) => costos[categoria]).filter(
      (importe): importe is Money => importe !== null,
    ),
  );
}

export function calcularMargen(entrada: EntradaDelMargen): MargenDelTrabajo {
  const cargadas = categoriasEstimadas(entrada.costos);
  if (cargadas === 0) return { situacion: 'sin-estimar' };

  const estimado = costoEstimado(entrada.costos);
  if (entrada.presupuesto === null) return { situacion: 'sin-presupuesto', estimado, cargadas };

  return {
    situacion: 'con-margen',
    estimado,
    cargadas,
    presupuesto: entrada.presupuesto,
    margen: restar(entrada.presupuesto, estimado),
  };
}
