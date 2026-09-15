import {
  ANTICIPACIONES,
  type Anticipacion,
  type AvisoDeLaAgenda,
  type CategoriaDeAgenda,
} from '@maun/domain';

import type { ResultadoDeLaPrueba } from '@/shared/api';
import { diasHasta, fechaLarga, hoyLocal, type TonoDelAviso } from '@/shared/lib';

export interface DatosDelAviso {
  etiqueta: string;
  detalle: string;
  categoria: CategoriaDeAgenda;
  anticipaciones: readonly Anticipacion[];
}

export const QUE_AVISA: Readonly<Record<AvisoDeLaAgenda, DatosDelAviso>> = {
  entregas: {
    etiqueta: 'Entregas',
    detalle: 'La entrega estimada de cada proyecto en curso',
    categoria: 'entrega',
    anticipaciones: [0, 1, 2, 3],
  },
  visitas: {
    etiqueta: 'Visitas y relevamientos',
    detalle: 'Las visitas que tenés agendadas en seguimiento',
    categoria: 'visita',
    anticipaciones: [0, 1, 2, 3],
  },
  presupuestos: {
    etiqueta: 'Presupuestos por vencer',
    detalle: 'La fecha límite para entregar un presupuesto',
    categoria: 'presupuesto',
    anticipaciones: [0, 1, 2, 3],
  },
  anotaciones: {
    etiqueta: 'Mis anotaciones',
    detalle: 'Lo que anotás vos: materiales, trabajo de taller',
    categoria: 'taller',
    anticipaciones: [0, 1],
  },
};

export const ANTICIPACION_EN_PALABRAS: Readonly<Record<Anticipacion, string>> = {
  0: 'la mañana del día',
  1: 'el día anterior',
  2: '2 días antes',
  3: '3 días antes',
};

export function anticipacionesDe(
  aviso: AvisoDeLaAgenda,
  actual: Anticipacion,
): readonly Anticipacion[] {
  const posibles = QUE_AVISA[aviso].anticipaciones;
  return ANTICIPACIONES.filter(
    (anticipacion) => posibles.includes(anticipacion) || anticipacion === actual,
  );
}

export const HORA_INICIAL = '07:30';

export const HORAS_SUGERIDAS = ['06:30', '07:30', '13:00', '20:00'] as const;

export function esHora(valor: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(valor);
}

const HORA_LOCAL = new Intl.DateTimeFormat('es-AR', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function cuandoSalio(ultimoEnvio: string | null, ahora: Date = new Date()): string {
  const momento = ultimoEnvio === null ? null : new Date(ultimoEnvio);
  if (momento === null || Number.isNaN(momento.getTime())) return 'Todavía no salió ninguno.';
  const dia = hoyLocal(momento);
  const hoy = hoyLocal(ahora);
  const hora = HORA_LOCAL.format(momento);
  const atras = diasHasta(hoy, dia);
  if (atras === 0) return `El último salió hoy a las ${hora}.`;
  if (atras === 1) return `El último salió ayer a las ${hora}.`;
  return `El último salió el ${fechaLarga(dia, hoy)} a las ${hora}.`;
}

export function otrosDispositivos(dispositivos: number): string {
  const otros = dispositivos - 1;
  if (otros <= 0) return '';
  return otros === 1
    ? ' También llegan a otro dispositivo tuyo.'
    : ` También llegan a otros ${String(otros)} dispositivos tuyos.`;
}

export function avisoDeLaPrueba(resultado: ResultadoDeLaPrueba): {
  tono: TonoDelAviso;
  texto: string;
} {
  if (!resultado.configurado) {
    return { tono: 'error', texto: 'El servidor todavía no puede mandar avisos.' };
  }
  if (resultado.mandados > 0) {
    return {
      tono: 'hecho',
      texto: 'Te mandamos un aviso de prueba: tiene que llegar en unos segundos.',
    };
  }
  if (resultado.podados > 0) {
    return {
      tono: 'error',
      texto: 'Este dispositivo ya no recibía avisos y lo sacamos de la lista. Activalos de nuevo.',
    };
  }
  return { tono: 'error', texto: 'El servicio de avisos no respondió. Probá de nuevo en un rato.' };
}

export const PASOS_EN_EL_IPHONE: readonly string[] = [
  'Tocá el botón de compartir, abajo en el medio.',
  'Elegí «Agregar a inicio».',
  'Abrí MAUN desde el ícono nuevo.',
];

export function pasosParaDesbloquear(comoApp: boolean): readonly string[] {
  return comoApp
    ? [
        'Abrí los ajustes del teléfono.',
        'Buscá MAUN en la lista de apps.',
        'Activá «Permitir notificaciones» y volvé acá.',
      ]
    : [
        'Tocá el ícono que está a la izquierda de la dirección de la página.',
        'Buscá «Notificaciones» y ponelo en permitir.',
        'Volvé acá y tocá «Ya lo habilité».',
      ];
}

export const FALTA_LA_ZONA = 'Elegí dónde vivís para activar los avisos.';

export const TODAVIA_BLOQUEADO = 'Todavía figura bloqueado. Revisá los pasos y volvé a tocar.';
