import { direccionDe, pantallaDe, type Pantalla } from './catalogo';

export type Movimiento =
  | 'fundido'
  | 'empuje'
  | 'vuelta'
  | 'subida'
  | 'bajada'
  | 'tarjeta'
  | 'tarjeta-vuelta'
  | 'pestana-adelante'
  | 'pestana-atras';

export type Alcance = 'main' | 'documento';

export type Decision =
  | { tipo: 'ninguno' }
  | { tipo: 'fundido-del-navegador' }
  | { tipo: 'movimiento'; movimiento: Movimiento; alcance: Alcance };

export type NavegacionDeLaPolitica =
  | { tipo: 'apilar' | 'reemplazar' | 'terminar' }
  | { tipo: 'seccion'; saltos: number; cambiaDePestana: boolean }
  | { tipo: 'atras' | 'adelante'; saltos: number };

export type AnchoDeLaPolitica = 'movil' | 'tablet' | 'escritorio';

export interface EntradaDeLaPolitica {
  desde: string | null;
  hacia: string;
  navegacion: NavegacionDeLaPolitica;
  ancho: AnchoDeLaPolitica;
  alcanceEnElementos: boolean;
  transicionesDelDocumento: boolean;
  aLaVista: boolean;
  menosMovimiento: boolean;
  navegadorYaAnimo: boolean;
  desdeLaNavegacion: boolean;
  sinTransicion: boolean;
  desdeUnaTarjeta: boolean;
  memoria: { deLaQueSeVa?: Movimiento; deLaQueLlega?: Movimiento };
}

const NINGUNO: Decision = { tipo: 'ninguno' };

const INVERSO: Readonly<Record<Movimiento, Movimiento>> = {
  fundido: 'fundido',
  empuje: 'vuelta',
  vuelta: 'empuje',
  subida: 'bajada',
  bajada: 'subida',
  tarjeta: 'tarjeta-vuelta',
  'tarjeta-vuelta': 'tarjeta',
  'pestana-adelante': 'pestana-atras',
  'pestana-atras': 'pestana-adelante',
};

export function inverso(movimiento: Movimiento): Movimiento {
  return INVERSO[movimiento];
}

function entrePestanas(desde: Pantalla, hacia: Pantalla): Movimiento | null {
  if (!desde.pestana || !hacia.pestana || desde.pestana.grupo !== hacia.pestana.grupo) return null;
  if (desde.pestana.orden === hacia.pestana.orden) return null;
  return hacia.pestana.orden > desde.pestana.orden ? 'pestana-adelante' : 'pestana-atras';
}

export function movimientoAlApilar(
  desde: string,
  hacia: string,
  desdeUnaTarjeta = false,
): Movimiento {
  const origen = pantallaDe(desde);
  const destino = pantallaDe(hacia);
  if (!origen || !destino) return 'fundido';
  if (destino.forma === 'capa' && origen.forma !== 'capa') return 'subida';
  if (origen.forma === 'capa') return 'bajada';
  if (desdeUnaTarjeta && destino.id === 'ficha') return 'tarjeta';
  const pestana = entrePestanas(origen, destino);
  if (pestana) return pestana;
  if (destino.seccion !== origen.seccion) return destino.raiz ? 'fundido' : 'empuje';
  if (destino.profundidad < origen.profundidad) return 'vuelta';
  return 'empuje';
}

const DEL_DOCUMENTO: readonly Movimiento[] = ['subida', 'bajada', 'tarjeta', 'tarjeta-vuelta'];

function alcanceDe(movimiento: Movimiento, desde: string, hacia: string): Alcance {
  const conCapa = [desde, hacia].some((url) => pantallaDe(url)?.forma === 'capa');
  return conCapa || DEL_DOCUMENTO.includes(movimiento) ? 'documento' : 'main';
}

function soloCambiaLaBusqueda(desde: string, hacia: string): boolean {
  return direccionDe(desde).pathname === direccionDe(hacia).pathname;
}

function movimientoDelCelular(entrada: EntradaDeLaPolitica, desde: string): Movimiento {
  const { hacia, navegacion, memoria } = entrada;
  switch (navegacion.tipo) {
    case 'atras':
      if (navegacion.saltos > 1) return 'fundido';
      return inverso(memoria.deLaQueSeVa ?? movimientoAlApilar(hacia, desde));
    case 'adelante':
      if (navegacion.saltos > 1) return 'fundido';
      return memoria.deLaQueLlega ?? movimientoAlApilar(desde, hacia);
    case 'seccion': {
      const origen = pantallaDe(desde);
      const destino = pantallaDe(hacia);
      if (origen?.seccion !== destino?.seccion) return 'fundido';
      if (navegacion.saltos === 0 && origen && destino) {
        return entrePestanas(origen, destino) ?? 'fundido';
      }
      return navegacion.saltos === 1 && !navegacion.cambiaDePestana ? 'vuelta' : 'fundido';
    }
    default:
      return movimientoAlApilar(desde, hacia, entrada.desdeUnaTarjeta);
  }
}

export function decidir(entrada: EntradaDeLaPolitica): Decision {
  const { desde, hacia } = entrada;
  if (
    entrada.menosMovimiento ||
    !entrada.aLaVista ||
    entrada.navegadorYaAnimo ||
    entrada.sinTransicion ||
    desde === null
  ) {
    return NINGUNO;
  }
  const origen = pantallaDe(desde);
  const destino = pantallaDe(hacia);
  if (!origen || !destino) return NINGUNO;

  if (entrada.ancho !== 'movil') {
    return entrada.desdeLaNavegacion && entrada.transicionesDelDocumento
      ? { tipo: 'fundido-del-navegador' }
      : NINGUNO;
  }

  if (!entrada.alcanceEnElementos) return NINGUNO;
  if (origen.forma === 'hoja' || destino.forma === 'hoja') return NINGUNO;
  if (soloCambiaLaBusqueda(desde, hacia) && entrePestanas(origen, destino) === null) {
    return NINGUNO;
  }

  const movimiento = movimientoDelCelular(entrada, desde);
  return { tipo: 'movimiento', movimiento, alcance: alcanceDe(movimiento, desde, hacia) };
}
