import { useCallback, useEffect, useRef, useState } from 'react';

import {
  esFalloDeRed,
  estadoDeMisAvisos,
  guardarMisPreferenciasDeAvisos,
  mandarAvisoDePrueba,
  servidorDeAvisos,
  type EstadoDeLosAvisos,
  type PreferenciasDeLaPersona,
  type ServidorDeAvisos,
} from '@/shared/api';
import {
  abiertaComoApp,
  avisarEnPantalla,
  avisosSoportados,
  esteDispositivoEsIphone,
  permisoDeAvisos,
  suscripcionDelDispositivo,
} from '@/shared/lib';

import {
  apagarEnEsteDispositivo,
  olvidarLaSuscripcionLocal,
  terminarDeActivar,
} from '../model/activacion';
import type { EsteDispositivo } from '../model/fase';
import { avisoDeLaPrueba, TODAVIA_BLOQUEADO } from '../model/textos';

export type CargaDeLosAvisos =
  | { tipo: 'cargando' }
  | { tipo: 'error'; sinSenal: boolean }
  | {
      tipo: 'lista';
      servidor: ServidorDeAvisos;
      estado: EstadoDeLosAvisos;
      dispositivo: EsteDispositivo;
    };

const CLAVE_DEL_DISPOSITIVO = 'avisos-del-dispositivo';
const CLAVE_DE_LAS_PREFERENCIAS = 'preferencias-de-avisos';
const CLAVE_DE_LA_PRUEBA = 'prueba-de-avisos';

async function leerEsteDispositivo(): Promise<EsteDispositivo> {
  const soportado = avisosSoportados();
  const suscripcion = soportado ? await suscripcionDelDispositivo().catch(() => null) : null;
  return {
    soportado,
    iphone: esteDispositivoEsIphone(),
    comoApp: abiertaComoApp(),
    permiso: permisoDeAvisos(),
    endpoint: suscripcion?.endpoint ?? null,
  };
}

async function leerLosAvisos(): Promise<CargaDeLosAvisos> {
  try {
    const dispositivo = await leerEsteDispositivo();
    const [servidor, estado] = await Promise.all([
      servidorDeAvisos(),
      estadoDeMisAvisos(dispositivo.endpoint),
    ]);
    return { tipo: 'lista', servidor, estado, dispositivo };
  } catch (error) {
    return { tipo: 'error', sinSenal: esFalloDeRed(error) || !navigator.onLine };
  }
}

function conEstado(
  carga: CargaDeLosAvisos,
  cambiar: (
    lista: Extract<CargaDeLosAvisos, { tipo: 'lista' }>,
  ) => Partial<Omit<Extract<CargaDeLosAvisos, { tipo: 'lista' }>, 'tipo'>>,
): CargaDeLosAvisos {
  return carga.tipo === 'lista' ? { ...carga, ...cambiar(carga) } : carga;
}

export function useAvisosDelDispositivo() {
  const [carga, setCarga] = useState<CargaDeLosAvisos>({ tipo: 'cargando' });
  const [activando, setActivando] = useState(false);
  const [apagando, setApagando] = useState(false);
  const [probando, setProbando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const montado = useRef(true);
  const confirmadas = useRef<PreferenciasDeLaPersona | null>(null);
  const cadena = useRef<Promise<void>>(Promise.resolve());
  const ultimoGuardado = useRef(0);

  const leer = useCallback(
    () =>
      leerLosAvisos().then((nueva) => {
        if (!montado.current) return;
        if (nueva.tipo === 'lista') confirmadas.current = nueva.estado.preferencias;
        setCarga(nueva);
      }),
    [],
  );

  useEffect(() => {
    montado.current = true;
    void leer();
    const alVolver = () => {
      if (document.visibilityState === 'visible') void leer();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      montado.current = false;
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [leer]);

  const reintentar = useCallback(() => {
    setCarga({ tipo: 'cargando' });
    void leer();
  }, [leer]);

  const activar = useCallback(
    (permiso: Promise<NotificationPermission>, zona: string) => {
      if (carga.tipo !== 'lista' || carga.servidor.clavePublica === null) return;
      setActivando(true);
      setMensaje(null);
      void terminarDeActivar(permiso, carga.servidor.clavePublica, zona).then((desenlace) => {
        if (!montado.current) return;
        setActivando(false);
        if (desenlace.tipo === 'activos') {
          confirmadas.current = desenlace.estado.preferencias;
          setCarga((previa) =>
            conEstado(previa, (lista) => ({
              estado: desenlace.estado,
              dispositivo: {
                ...lista.dispositivo,
                permiso: 'granted',
                endpoint: desenlace.endpoint,
              },
            })),
          );
          avisarEnPantalla({
            clave: CLAVE_DEL_DISPOSITIVO,
            tono: 'hecho',
            texto: 'Avisos activados en este dispositivo.',
          });
          return;
        }
        if (desenlace.tipo === 'denegado') {
          setCarga((previa) =>
            conEstado(previa, (lista) => ({
              dispositivo: { ...lista.dispositivo, permiso: 'denied' },
            })),
          );
          return;
        }
        setMensaje(desenlace.mensaje);
      });
    },
    [carga],
  );

  const apagar = useCallback(() => {
    if (carga.tipo !== 'lista' || carga.dispositivo.endpoint === null) return;
    const endpoint = carga.dispositivo.endpoint;
    setApagando(true);
    void apagarEnEsteDispositivo(endpoint).then((desenlace) => {
      if (!montado.current) return;
      setApagando(false);
      if (desenlace.tipo === 'no-se-pudo') {
        avisarEnPantalla({ clave: CLAVE_DEL_DISPOSITIVO, tono: 'error', texto: desenlace.mensaje });
        return;
      }
      setMensaje(null);
      setCarga((previa) =>
        conEstado(previa, (lista) => ({
          estado: {
            ...lista.estado,
            suscripto: false,
            ultimoEnvio: null,
            dispositivos: Math.max(0, lista.estado.dispositivos - 1),
          },
          dispositivo: { ...lista.dispositivo, endpoint: null },
        })),
      );
      avisarEnPantalla({
        clave: CLAVE_DEL_DISPOSITIVO,
        tono: 'hecho',
        texto: 'Este dispositivo ya no recibe avisos.',
      });
    });
  }, [carga]);

  const guardar = useCallback((nuevas: PreferenciasDeLaPersona) => {
    ultimoGuardado.current += 1;
    const numero = ultimoGuardado.current;
    setCarga((previa) =>
      conEstado(previa, (lista) => ({ estado: { ...lista.estado, preferencias: nuevas } })),
    );
    cadena.current = cadena.current.then(async () => {
      try {
        const estado = await guardarMisPreferenciasDeAvisos(nuevas);
        confirmadas.current = estado.preferencias;
        if (!montado.current) return;
        if (numero === ultimoGuardado.current) {
          setCarga((previa) =>
            conEstado(previa, (lista) => ({
              estado: { ...lista.estado, preferencias: estado.preferencias },
            })),
          );
        }
        avisarEnPantalla({
          clave: CLAVE_DE_LAS_PREFERENCIAS,
          tono: 'hecho',
          texto: 'Cambios de los avisos guardados.',
          reemplaza: CLAVE_DE_LAS_PREFERENCIAS,
        });
      } catch (error) {
        if (!montado.current) return;
        const vuelta = confirmadas.current;
        setCarga((previa) =>
          conEstado(previa, (lista) => ({ estado: { ...lista.estado, preferencias: vuelta } })),
        );
        avisarEnPantalla({
          clave: CLAVE_DE_LAS_PREFERENCIAS,
          tono: 'error',
          texto: esFalloDeRed(error)
            ? 'Sin señal no se guardan los avisos: el cambio no quedó. Probá cuando vuelva.'
            : 'No se guardó el cambio de los avisos. Probá de nuevo.',
          reemplaza: CLAVE_DE_LAS_PREFERENCIAS,
        });
      }
    });
  }, []);

  const probar = useCallback(() => {
    if (carga.tipo !== 'lista' || carga.dispositivo.endpoint === null) return;
    const endpoint = carga.dispositivo.endpoint;
    setProbando(true);
    void mandarAvisoDePrueba(endpoint)
      .then(
        async (resultado) => {
          avisarEnPantalla({ clave: CLAVE_DE_LA_PRUEBA, ...avisoDeLaPrueba(resultado) });
          if (resultado.podados > 0) await olvidarLaSuscripcionLocal();
          if (resultado.podados > 0 || !resultado.configurado) await leer();
        },
        (error: unknown) => {
          avisarEnPantalla({
            clave: CLAVE_DE_LA_PRUEBA,
            tono: 'error',
            texto: esFalloDeRed(error)
              ? 'Sin señal no se puede mandar la prueba.'
              : 'No se pudo mandar la prueba. Probá de nuevo en un rato.',
          });
        },
      )
      .finally(() => {
        if (montado.current) setProbando(false);
      });
  }, [carga, leer]);

  const revisarElPermiso = useCallback(() => {
    if (permisoDeAvisos() === 'denied') {
      setMensaje(TODAVIA_BLOQUEADO);
      return;
    }
    setMensaje(null);
    void leer();
  }, [leer]);

  return {
    carga,
    activando,
    apagando,
    probando,
    mensaje,
    reintentar,
    activar,
    apagar,
    guardar,
    probar,
    revisarElPermiso,
  };
}
