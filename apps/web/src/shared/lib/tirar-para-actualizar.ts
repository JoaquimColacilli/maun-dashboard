import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

export const UMBRAL_DEL_TIRON = 64;
export const TIRON_MAXIMO = 96;
export const RESISTENCIA_DEL_TIRON = 0.5;
export const TIEMPO_MINIMO_SINCRONIZANDO_MS = 500;
export const MUESTRA_DEL_DESENLACE_MS = 1200;
export const DURACION_DE_LA_VUELTA_MS = 220;

export type FaseDelTiron = 'quieto' | 'tirando' | 'sincronizando' | 'desenlace' | 'volviendo';

export interface Tiron<R> {
  distancia: number;
  avance: number;
  sincronizando: boolean;
  fase: FaseDelTiron;
  desenlace: R | null;
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, ms));
}

export function useTirarParaActualizar<R>(
  actualizar: () => Promise<R>,
  contenedor: RefObject<HTMLElement | null>,
  deshabilitado: boolean,
  enTransicion: () => boolean = () => false,
): Tiron<R> {
  const [distancia, setDistancia] = useState(0);
  const [fase, setFase] = useState<FaseDelTiron>('quieto');
  const [desenlace, setDesenlace] = useState<R | null>(null);
  const alActualizar = useRef(actualizar);
  const frenado = useRef(deshabilitado);
  const enMovimiento = useRef(enTransicion);
  const desde = useRef<number | null>(null);
  const tiron = useRef(0);
  const empezo = useRef(false);
  const ocupado = useRef(false);

  useLayoutEffect(() => {
    alActualizar.current = actualizar;
    frenado.current = deshabilitado;
    enMovimiento.current = enTransicion;
  });

  useEffect(() => {
    const elemento = contenedor.current;
    if (!elemento) return;
    let vigente = true;
    const sigueVigente = () => vigente;
    let cuadro: number | null = null;
    let reloj: ReturnType<typeof setTimeout> | undefined;

    const dibujar = () => {
      cuadro = null;
      setDistancia(tiron.current);
    };

    const pedirCuadro = () => {
      cuadro ??= requestAnimationFrame(dibujar);
    };

    const olvidarCuadro = () => {
      if (cuadro !== null) cancelAnimationFrame(cuadro);
      cuadro = null;
    };

    const volver = () => {
      olvidarCuadro();
      desde.current = null;
      empezo.current = false;
      tiron.current = 0;
      setDistancia(0);
      setFase('volviendo');
      clearTimeout(reloj);
      reloj = setTimeout(() => {
        if (vigente) setFase('quieto');
      }, DURACION_DE_LA_VUELTA_MS);
    };

    const sincronizar = async () => {
      ocupado.current = true;
      olvidarCuadro();
      tiron.current = UMBRAL_DEL_TIRON;
      setDistancia(UMBRAL_DEL_TIRON);
      setFase('sincronizando');
      const [resultado] = await Promise.all([
        alActualizar.current().catch(() => null),
        esperar(TIEMPO_MINIMO_SINCRONIZANDO_MS),
      ]);
      if (!sigueVigente()) return;
      if (resultado !== null) {
        setDesenlace(resultado);
        setFase('desenlace');
        await esperar(MUESTRA_DEL_DESENLACE_MS);
        if (!sigueVigente()) return;
      }
      ocupado.current = false;
      volver();
    };

    const alTocar = (evento: TouchEvent) => {
      const dedo = evento.touches[0];
      const puedeEmpezar =
        !frenado.current &&
        !ocupado.current &&
        !enMovimiento.current() &&
        evento.touches.length === 1 &&
        elemento.scrollTop <= 0;
      desde.current = puedeEmpezar && dedo ? dedo.clientY : null;
      empezo.current = false;
    };

    const alMover = (evento: TouchEvent) => {
      const inicio = desde.current;
      const dedo = evento.touches[0];
      if (inicio === null || !dedo) return;
      const seCorta =
        frenado.current || evento.touches.length > 1 || (!empezo.current && elemento.scrollTop > 0);
      if (seCorta) {
        if (empezo.current) volver();
        desde.current = null;
        return;
      }
      const siguiente = Math.min(
        TIRON_MAXIMO,
        Math.max(0, (dedo.clientY - inicio) * RESISTENCIA_DEL_TIRON),
      );
      if (!empezo.current) {
        if (siguiente === 0) return;
        empezo.current = true;
        clearTimeout(reloj);
        setDesenlace(null);
        setFase('tirando');
      }
      if (siguiente === tiron.current) return;
      tiron.current = siguiente;
      pedirCuadro();
    };

    const alSoltar = () => {
      if (desde.current === null) return;
      desde.current = null;
      if (!empezo.current) return;
      if (frenado.current || tiron.current < UMBRAL_DEL_TIRON) {
        volver();
        return;
      }
      empezo.current = false;
      void sincronizar();
    };

    const alCancelar = () => {
      if (empezo.current) volver();
      desde.current = null;
    };

    const pasivo = { passive: true };
    elemento.addEventListener('touchstart', alTocar, pasivo);
    elemento.addEventListener('touchmove', alMover, pasivo);
    elemento.addEventListener('touchend', alSoltar, pasivo);
    elemento.addEventListener('touchcancel', alCancelar, pasivo);
    return () => {
      vigente = false;
      olvidarCuadro();
      clearTimeout(reloj);
      elemento.removeEventListener('touchstart', alTocar);
      elemento.removeEventListener('touchmove', alMover);
      elemento.removeEventListener('touchend', alSoltar);
      elemento.removeEventListener('touchcancel', alCancelar);
      desde.current = null;
      empezo.current = false;
      ocupado.current = false;
      tiron.current = 0;
    };
  }, [contenedor]);

  return {
    distancia,
    avance: Math.min(1, distancia / UMBRAL_DEL_TIRON),
    sincronizando: fase === 'sincronizando',
    fase,
    desenlace,
  };
}
