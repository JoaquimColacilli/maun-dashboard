import { describe, expect, it, vi } from 'vitest';

import WORKER from '../../../sw/sw.ts?raw';
import {
  CADA_CUANTO_PREGUNTA_SOLA_MS,
  crearVigiaDeLaVersion,
  decidirElChequeo,
  ESPERA_ENTRE_CHEQUEOS_SOLOS_MS,
  PEDIDO_DE_ACTUALIZAR,
  URL_DEL_SERVICE_WORKER,
  versionLista,
  type EntornoDeLaVersion,
  type RegistroDeLaVersion,
  type SituacionDelChequeo,
  type TrabajadorDeLaVersion,
} from './version-nueva';

class TrabajadorFalso extends EventTarget implements TrabajadorDeLaVersion {
  readonly mensajes: unknown[] = [];
  state: ServiceWorkerState;

  constructor(estado: ServiceWorkerState) {
    super();
    this.state = estado;
  }

  postMessage(mensaje: unknown): void {
    this.mensajes.push(mensaje);
  }

  pasarA(estado: ServiceWorkerState): void {
    this.state = estado;
    this.dispatchEvent(new Event('statechange'));
  }
}

class RegistroFalso extends EventTarget implements RegistroDeLaVersion {
  installing: TrabajadorFalso | null = null;
  waiting: TrabajadorFalso | null = null;
  active: TrabajadorFalso | null = new TrabajadorFalso('activated');
  readonly update = vi.fn(() => Promise.resolve(this));

  empezarAInstalar(): TrabajadorFalso {
    const nuevo = new TrabajadorFalso('installing');
    this.installing = nuevo;
    this.dispatchEvent(new Event('updatefound'));
    return nuevo;
  }

  terminarDeInstalar(): void {
    const nuevo = this.installing;
    if (nuevo === null) throw new Error('no había nada instalándose');
    const anterior = this.waiting;
    this.installing = null;
    this.waiting = nuevo;
    anterior?.pasarA('redundant');
    nuevo.pasarA('installed');
  }

  fallarLaInstalacion(): void {
    const nuevo = this.installing;
    if (nuevo === null) throw new Error('no había nada instalándose');
    this.installing = null;
    nuevo.pasarA('redundant');
  }

  activarLaQueEspera(): void {
    const nuevo = this.waiting;
    if (nuevo === null) throw new Error('no había nada esperando');
    this.waiting = null;
    this.active = nuevo;
    nuevo.pasarA('activating');
    nuevo.pasarA('activated');
  }
}

interface EntornoFalso extends EntornoDeLaVersion {
  cargar: () => void;
  cambiarElControlador: () => void;
  volverAVerse: () => void;
  ocultarse: () => void;
  cortarLaRed: () => void;
  volverLaRed: () => void;
  pasar: (milisegundos: number) => void;
  readonly recargas: () => number;
  readonly registros: () => number;
}

function entornoFalso(registro: RegistroFalso, { yaRegistrada = true } = {}): EntornoFalso {
  const alCargar: (() => void)[] = [];
  const alCambiar: (() => void)[] = [];
  const alVolver: (() => void)[] = [];
  const alVolverLaRed: (() => void)[] = [];
  const periodicas: { accion: () => void; cada: number; proxima: number }[] = [];
  let recargas = 0;
  let registros = 0;
  let red = true;
  let visible = true;
  let reloj = 1_000_000;
  return {
    registroActual: () => Promise.resolve(yaRegistrada ? registro : undefined),
    registrar: () => {
      registros += 1;
      return Promise.resolve(registro);
    },
    alCargar: (accion) => {
      alCargar.push(accion);
    },
    alCambiarElControlador: (accion) => {
      alCambiar.push(accion);
    },
    alVolverAVerse: (accion) => {
      alVolver.push(accion);
    },
    alVolverLaRed: (accion) => {
      alVolverLaRed.push(accion);
    },
    cadaTanto: (accion, cada) => {
      periodicas.push({ accion, cada, proxima: reloj + cada });
    },
    seVe: () => visible,
    hayRed: () => red,
    ahora: () => reloj,
    recargar: () => {
      recargas += 1;
    },
    cargar: () => {
      for (const accion of alCargar.splice(0)) accion();
    },
    cambiarElControlador: () => {
      for (const accion of alCambiar) accion();
    },
    volverAVerse: () => {
      visible = true;
      for (const accion of alVolver) accion();
    },
    ocultarse: () => {
      visible = false;
    },
    cortarLaRed: () => {
      red = false;
    },
    volverLaRed: () => {
      red = true;
      for (const accion of alVolverLaRed) accion();
    },
    pasar: (milisegundos) => {
      const hasta = reloj + milisegundos;
      for (const periodica of periodicas) {
        while (periodica.proxima <= hasta) {
          reloj = periodica.proxima;
          periodica.accion();
          periodica.proxima += periodica.cada;
        }
      }
      reloj = hasta;
    },
    recargas: () => recargas,
    registros: () => registros,
  };
}

async function enCalma(): Promise<void> {
  await new Promise((resolver) => setTimeout(resolver, 0));
}

describe('la versión lista sale del registro', () => {
  it('hay versión lista si espera una y ya hay una activa', () => {
    const registro = new RegistroFalso();
    registro.waiting = new TrabajadorFalso('installed');
    expect(versionLista(registro)).toBe(registro.waiting);
  });

  it('la primera instalación no es una versión nueva: no hay ninguna activa', () => {
    const registro = new RegistroFalso();
    registro.active = null;
    registro.waiting = new TrabajadorFalso('installed');
    expect(versionLista(registro)).toBeNull();
  });

  it('una que se está bajando todavía no está lista', () => {
    const registro = new RegistroFalso();
    registro.installing = new TrabajadorFalso('installing');
    expect(versionLista(registro)).toBeNull();
  });
});

describe('el vigía de la versión nueva', () => {
  it('si ya había una esperando, la ve apenas lee el registro, antes de que cargue la página', async () => {
    const registro = new RegistroFalso();
    registro.waiting = new TrabajadorFalso('installed');
    const entorno = entornoFalso(registro);
    const vigia = crearVigiaDeLaVersion(entorno);
    await enCalma();

    expect(vigia.lista()).toBe(registro.waiting);
    expect(entorno.registros()).toBe(0);
  });

  it('registra recién cuando termina de cargar la página, y una sola vez', async () => {
    const registro = new RegistroFalso();
    const entorno = entornoFalso(registro, { yaRegistrada: false });
    crearVigiaDeLaVersion(entorno);
    await enCalma();
    expect(entorno.registros()).toBe(0);

    entorno.cargar();
    entorno.cargar();
    await enCalma();
    expect(entorno.registros()).toBe(1);
  });

  it('una que se estaba bajando al arrancar se sigue hasta que queda lista, sin esperar un updatefound', async () => {
    const registro = new RegistroFalso();
    registro.installing = new TrabajadorFalso('installing');
    const vigia = crearVigiaDeLaVersion(entornoFalso(registro));
    await enCalma();
    const avisos = vi.fn();
    vigia.suscribir(avisos);

    registro.terminarDeInstalar();

    expect(vigia.lista()).toBe(registro.waiting);
    expect(avisos).toHaveBeenCalledTimes(1);
  });

  it('una instalación que aparece después se sigue hasta que queda lista', async () => {
    const registro = new RegistroFalso();
    const vigia = crearVigiaDeLaVersion(entornoFalso(registro));
    await enCalma();

    registro.empezarAInstalar();
    expect(vigia.lista()).toBeNull();
    registro.terminarDeInstalar();

    expect(vigia.lista()).toBe(registro.waiting);
  });

  it('una instalación que falla no deja nada roto: la siguiente que sale bien queda lista', async () => {
    const registro = new RegistroFalso();
    const vigia = crearVigiaDeLaVersion(entornoFalso(registro));
    await enCalma();

    registro.empezarAInstalar();
    registro.fallarLaInstalacion();
    expect(vigia.lista()).toBeNull();

    registro.empezarAInstalar();
    registro.terminarDeInstalar();
    expect(vigia.lista()).toBe(registro.waiting);

    registro.empezarAInstalar();
    registro.terminarDeInstalar();
    expect(vigia.lista()).toBe(registro.waiting);
  });

  it('si llega una versión más nueva mientras otra espera, la lista pasa a ser la más nueva', async () => {
    const registro = new RegistroFalso();
    const vigia = crearVigiaDeLaVersion(entornoFalso(registro));
    await enCalma();
    registro.empezarAInstalar();
    registro.terminarDeInstalar();
    const primera = vigia.lista();
    const avisos = vi.fn();
    vigia.suscribir(avisos);

    registro.empezarAInstalar();
    registro.terminarDeInstalar();

    expect(vigia.lista()).not.toBe(primera);
    expect(vigia.lista()).toBe(registro.waiting);
    expect(avisos).toHaveBeenCalled();
  });

  it('leer dos veces sin cambios devuelve lo mismo, y no avisa si nada cambió', async () => {
    const registro = new RegistroFalso();
    registro.waiting = new TrabajadorFalso('installed');
    const vigia = crearVigiaDeLaVersion(entornoFalso(registro));
    await enCalma();
    const avisos = vi.fn();
    vigia.suscribir(avisos);

    registro.dispatchEvent(new Event('updatefound'));

    expect(vigia.lista()).toBe(vigia.lista());
    expect(avisos).not.toHaveBeenCalled();
  });

  it('el registro que devuelve register() es el mismo: no escucha dos veces', async () => {
    const registro = new RegistroFalso();
    const entorno = entornoFalso(registro);
    const vigia = crearVigiaDeLaVersion(entorno);
    entorno.cargar();
    await enCalma();
    const avisos = vi.fn();
    vigia.suscribir(avisos);

    registro.empezarAInstalar();
    registro.terminarDeInstalar();

    expect(avisos).toHaveBeenCalledTimes(1);
  });

  it('cuando otra pestaña la aplica, la lista se va', async () => {
    const registro = new RegistroFalso();
    registro.waiting = new TrabajadorFalso('installed');
    const vigia = crearVigiaDeLaVersion(entornoFalso(registro));
    await enCalma();

    registro.activarLaQueEspera();

    expect(vigia.lista()).toBeNull();
  });
});

describe('cuándo se pregunta si hay una versión nueva', () => {
  const tranquila: SituacionDelChequeo = {
    motivo: 'vuelta',
    hayRegistro: true,
    hayUnoEnCurso: false,
    seEstaBajando: false,
    hayRed: true,
    quedoUnoPendiente: false,
    desdeElUltimo: null,
  };
  const HACE_UN_RATO = ESPERA_ENTRE_CHEQUEOS_SOLOS_MS - 1;

  it('con todo en calma, pregunta', () => {
    expect(decidirElChequeo(tranquila)).toBe('preguntar');
  });

  it('si ya hay uno en curso, se suma a ese: nunca dos a la vez, tampoco el de tirar', () => {
    expect(decidirElChequeo({ ...tranquila, hayUnoEnCurso: true })).toBe('sumarse');
    expect(decidirElChequeo({ ...tranquila, motivo: 'a-mano', hayUnoEnCurso: true })).toBe(
      'sumarse',
    );
  });

  it('mientras se baja una versión, no pregunta: no suma nada y le compite a la descarga', () => {
    expect(decidirElChequeo({ ...tranquila, seEstaBajando: true })).toBe('no');
    expect(decidirElChequeo({ ...tranquila, motivo: 'a-mano', seEstaBajando: true })).toBe('no');
  });

  it('sin señal no sale a la red: queda para cuando vuelva', () => {
    expect(decidirElChequeo({ ...tranquila, hayRed: false })).toBe('cuando-haya-red');
    expect(decidirElChequeo({ ...tranquila, motivo: 'a-mano', hayRed: false })).toBe(
      'cuando-haya-red',
    );
  });

  it('antes de conocer el registro no hay a quién preguntarle', () => {
    expect(decidirElChequeo({ ...tranquila, hayRegistro: false })).toBe('no');
  });

  it('los automáticos, como mucho uno por minuto', () => {
    for (const motivo of ['arranque', 'vuelta', 'red', 'hora'] as const) {
      expect(decidirElChequeo({ ...tranquila, motivo, desdeElUltimo: HACE_UN_RATO })).toBe('no');
      expect(
        decidirElChequeo({ ...tranquila, motivo, desdeElUltimo: ESPERA_ENTRE_CHEQUEOS_SOLOS_MS }),
      ).toBe('preguntar');
    }
  });

  it('el de tirar no tiene ese límite', () => {
    expect(decidirElChequeo({ ...tranquila, motivo: 'a-mano', desdeElUltimo: 0 })).toBe(
      'preguntar',
    );
  });

  it('al volver la red, pregunta aunque haga menos de un minuto si quedó uno sin hacer', () => {
    expect(
      decidirElChequeo({
        ...tranquila,
        motivo: 'red',
        desdeElUltimo: HACE_UN_RATO,
        quedoUnoPendiente: true,
      }),
    ).toBe('preguntar');
    expect(
      decidirElChequeo({
        ...tranquila,
        motivo: 'vuelta',
        desdeElUltimo: HACE_UN_RATO,
        quedoUnoPendiente: true,
      }),
    ).toBe('no');
  });
});

describe('preguntar', () => {
  it('le pide al registro que busque la versión nueva', async () => {
    const registro = new RegistroFalso();
    const vigia = crearVigiaDeLaVersion(entornoFalso(registro));
    await enCalma();

    await vigia.buscar('a-mano');

    expect(registro.update).toHaveBeenCalledTimes(1);
  });

  it('pregunta sola cuando terminó de cargar la página, después de registrar', async () => {
    const registro = new RegistroFalso();
    const entorno = entornoFalso(registro);
    crearVigiaDeLaVersion(entorno);
    await enCalma();
    expect(registro.update).not.toHaveBeenCalled();

    entorno.cargar();
    await enCalma();

    expect(entorno.registros()).toBe(1);
    expect(registro.update).toHaveBeenCalledTimes(1);
  });

  it('volver a la app muchas veces seguidas pregunta como mucho una vez por minuto', async () => {
    const registro = new RegistroFalso();
    const entorno = entornoFalso(registro);
    crearVigiaDeLaVersion(entorno);
    entorno.cargar();
    await enCalma();

    for (let vez = 0; vez < 5; vez += 1) {
      entorno.pasar(5_000);
      entorno.volverAVerse();
      await enCalma();
    }
    expect(registro.update).toHaveBeenCalledTimes(1);

    entorno.pasar(ESPERA_ENTRE_CHEQUEOS_SOLOS_MS);
    entorno.volverAVerse();
    await enCalma();
    expect(registro.update).toHaveBeenCalledTimes(2);
  });

  it('una vez por hora mientras se ve, y nunca mientras está oculta', async () => {
    const registro = new RegistroFalso();
    const entorno = entornoFalso(registro);
    crearVigiaDeLaVersion(entorno);
    entorno.cargar();
    await enCalma();

    entorno.pasar(CADA_CUANTO_PREGUNTA_SOLA_MS);
    await enCalma();
    expect(registro.update).toHaveBeenCalledTimes(2);

    entorno.ocultarse();
    entorno.pasar(3 * CADA_CUANTO_PREGUNTA_SOLA_MS);
    await enCalma();
    expect(registro.update).toHaveBeenCalledTimes(2);
  });

  it('lo que quedó sin preguntar por falta de señal se pregunta cuando vuelve, aunque haga menos de un minuto', async () => {
    const registro = new RegistroFalso();
    const entorno = entornoFalso(registro);
    const vigia = crearVigiaDeLaVersion(entorno);
    entorno.cargar();
    await enCalma();
    entorno.cortarLaRed();

    await vigia.buscar('a-mano');
    expect(registro.update).toHaveBeenCalledTimes(1);

    entorno.pasar(5_000);
    entorno.volverLaRed();
    await enCalma();
    expect(registro.update).toHaveBeenCalledTimes(2);

    entorno.pasar(5_000);
    entorno.volverLaRed();
    await enCalma();
    expect(registro.update).toHaveBeenCalledTimes(2);
  });

  it('diez pedidos seguidos mientras el primero no terminó salen como uno solo', async () => {
    const registro = new RegistroFalso();
    let terminar: () => void = () => undefined;
    registro.update.mockImplementation(
      () =>
        new Promise((resolver) => {
          terminar = () => {
            resolver(registro);
          };
        }),
    );
    const vigia = crearVigiaDeLaVersion(entornoFalso(registro));
    await enCalma();

    const pedidos = Array.from({ length: 10 }, () => vigia.buscar('a-mano'));
    terminar();
    await Promise.all(pedidos);

    expect(registro.update).toHaveBeenCalledTimes(1);
  });

  it('mientras se baja una versión, no pregunta', async () => {
    const registro = new RegistroFalso();
    const vigia = crearVigiaDeLaVersion(entornoFalso(registro));
    await enCalma();
    registro.empezarAInstalar();

    await vigia.buscar('a-mano');

    expect(registro.update).not.toHaveBeenCalled();
  });

  it('sin señal no pregunta', async () => {
    const registro = new RegistroFalso();
    const entorno = entornoFalso(registro);
    const vigia = crearVigiaDeLaVersion(entorno);
    await enCalma();
    entorno.cortarLaRed();

    await vigia.buscar('a-mano');

    expect(registro.update).not.toHaveBeenCalled();
  });

  it('si no puede bajar el script, el rechazo queda adentro, no reintenta solo y al volver la red pregunta', async () => {
    const registro = new RegistroFalso();
    registro.update.mockRejectedValueOnce(new TypeError('Failed to update a ServiceWorker'));
    const entorno = entornoFalso(registro);
    const vigia = crearVigiaDeLaVersion(entorno);
    await enCalma();

    await expect(vigia.buscar('a-mano')).resolves.toBeUndefined();
    entorno.pasar(5_000);
    await enCalma();
    expect(registro.update).toHaveBeenCalledTimes(1);

    entorno.volverLaRed();
    await enCalma();
    expect(registro.update).toHaveBeenCalledTimes(2);
  });

  it('antes de conocer el registro no hace nada', async () => {
    const registro = new RegistroFalso();
    const vigia = crearVigiaDeLaVersion(entornoFalso(registro, { yaRegistrada: false }));

    await vigia.buscar('a-mano');

    expect(registro.update).not.toHaveBeenCalled();
  });
});

describe('tocar «Actualizar»', () => {
  it('le pide a la que espera que tome el control con el mismo mensaje que escucha el service worker', async () => {
    const registro = new RegistroFalso();
    const esperando = new TrabajadorFalso('installed');
    registro.waiting = esperando;
    const vigia = crearVigiaDeLaVersion(entornoFalso(registro));
    await enCalma();

    vigia.aplicar();

    expect(esperando.mensajes).toEqual([{ type: PEDIDO_DE_ACTUALIZAR }]);
    expect(WORKER).toContain(`datos.type === '${PEDIDO_DE_ACTUALIZAR}'`);
  });

  it('recarga una sola vez cuando toma el control, aunque además termine de activarse', async () => {
    const registro = new RegistroFalso();
    registro.waiting = new TrabajadorFalso('installed');
    const entorno = entornoFalso(registro);
    const vigia = crearVigiaDeLaVersion(entorno);
    await enCalma();

    vigia.aplicar();
    vigia.aplicar();
    expect(entorno.recargas()).toBe(0);
    entorno.cambiarElControlador();
    entorno.cambiarElControlador();
    registro.activarLaQueEspera();

    expect(entorno.recargas()).toBe(1);
  });

  it('en una página sin controlar, que no recibe el cambio de controlador, recarga cuando la nueva queda activa', async () => {
    const registro = new RegistroFalso();
    registro.waiting = new TrabajadorFalso('installed');
    const entorno = entornoFalso(registro);
    const vigia = crearVigiaDeLaVersion(entorno);
    await enCalma();

    vigia.aplicar();
    registro.activarLaQueEspera();

    expect(entorno.recargas()).toBe(1);
  });

  it('si ya no hay ninguna esperando, porque entró por otro lado, recarga igual', async () => {
    const registro = new RegistroFalso();
    const entorno = entornoFalso(registro);
    const vigia = crearVigiaDeLaVersion(entorno);
    await enCalma();

    vigia.aplicar();

    expect(entorno.recargas()).toBe(1);
  });

  it('como hoy: si la pestaña mostró el aviso y otra aplica la versión, esta también recarga', async () => {
    const registro = new RegistroFalso();
    registro.waiting = new TrabajadorFalso('installed');
    const entorno = entornoFalso(registro);
    crearVigiaDeLaVersion(entorno);
    await enCalma();

    registro.activarLaQueEspera();
    entorno.cambiarElControlador();

    expect(entorno.recargas()).toBe(1);
  });

  it('una pestaña que nunca mostró el aviso no recarga cuando cambia el controlador', async () => {
    const registro = new RegistroFalso();
    const entorno = entornoFalso(registro);
    crearVigiaDeLaVersion(entorno);
    await enCalma();

    entorno.cambiarElControlador();

    expect(entorno.recargas()).toBe(0);
  });
});

describe('el service worker se registra como antes', () => {
  it('con la misma dirección, que no puede cambiar', () => {
    expect(URL_DEL_SERVICE_WORKER).toBe('/sw.js');
  });
});
