import { estaLiquidado, sumarDias, type CategoriaPropia } from '@maun/domain';

import type { AnotacionNueva, FilaDe } from '@/shared/api';

export const LARGO_MAXIMO_DEL_TEXTO = 500;

export interface ValoresDeLaAnotacion {
  texto: string;
  categoria: CategoriaPropia;
  fecha: string;
  hora: string;
  proyectoId: string;
  importante: boolean;
}

export interface ErroresDeLaAnotacion {
  texto?: string;
  fecha?: string;
}

export function valoresIniciales(fecha: string): ValoresDeLaAnotacion {
  return {
    texto: '',
    categoria: 'materiales',
    fecha,
    hora: '',
    proyectoId: '',
    importante: false,
  };
}

export function esFecha(valor: string | null): valor is string {
  if (valor === null || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  try {
    return sumarDias(valor, 0) === valor;
  } catch {
    return false;
  }
}

export function fechaDelParametro(valor: string | null, porDefecto: string): string {
  return esFecha(valor) ? valor : porDefecto;
}

export function erroresDeLaAnotacion(valores: ValoresDeLaAnotacion): ErroresDeLaAnotacion {
  const errores: ErroresDeLaAnotacion = {};
  const texto = valores.texto.trim();
  if (texto === '') errores.texto = 'Escribí qué hay que hacer.';
  else if (texto.length > LARGO_MAXIMO_DEL_TEXTO) {
    errores.texto = `No puede pasar de ${String(LARGO_MAXIMO_DEL_TEXTO)} caracteres.`;
  }
  if (!esFecha(valores.fecha)) errores.fecha = 'Elegí el día.';
  return errores;
}

export function hayErrores(errores: ErroresDeLaAnotacion): boolean {
  return Object.values(errores).some((mensaje) => mensaje !== undefined);
}

export function anotacionNueva(id: string, valores: ValoresDeLaAnotacion): AnotacionNueva {
  return {
    id,
    fecha: valores.fecha,
    hora: valores.hora.trim() === '' ? null : valores.hora,
    texto: valores.texto.trim(),
    categoria: valores.categoria,
    proyecto_id: valores.proyectoId === '' ? null : valores.proyectoId,
    hecha: false,
    importante: valores.importante,
  };
}

export interface TrabajoParaAnotar {
  id: string;
  etiqueta: string;
}

export function trabajosParaAnotar(
  proyectos: readonly FilaDe<'proyectos'>[],
  clientes: readonly FilaDe<'clientes'>[],
): TrabajoParaAnotar[] {
  const nombres = new Map(clientes.map((cliente) => [cliente.id, cliente.nombre]));
  return proyectos
    .filter((proyecto) => !estaLiquidado(proyecto.estado))
    .map((proyecto) => {
      const cliente = nombres.get(proyecto.cliente_id);
      return {
        id: proyecto.id,
        etiqueta: cliente === undefined ? proyecto.titulo : `${proyecto.titulo} — ${cliente}`,
      };
    })
    .sort((uno, otro) => uno.etiqueta.localeCompare(otro.etiqueta, 'es'));
}
