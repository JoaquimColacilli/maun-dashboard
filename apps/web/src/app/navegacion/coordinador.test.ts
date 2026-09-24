import { describe, expect, it, vi } from 'vitest';

import type { Compuerta, QueHacerConElAtras } from './compuerta';
import { crearCoordinador, destinoDelPlan, type Coordinador } from './coordinador';
import type { Escenario, Pieza, TarjetaTocada } from './escenario';
import type { EntradaDelHistorial, HistorialQueEscucha, Traslado } from './historial';
import { memoriaEn } from './memoria';
import type { AnchoDeLaPolitica } from './politica';

interface Llamada {
  a: string | number;
  opciones?: { replace: boolean; flushSync: boolean };
}

function armar(urls: string[], ancho: AnchoDeLaPolitica = 'movil') {
  const pila: EntradaDelHistorial[] = urls.map((url, indice) => ({
    key: `k${String(indice)}`,
    url,
  }));
  let indice = pila.length - 1;
  let proximaClave = pila.length;
  let clavesDelRouter = 0;
  let traslado: Traslado | null = null;
  let decidirElAtras: (evento: Event) => QueHacerConElAtras = () => 'ahora';
  const llamadas: Llamada[] = [];
  const decisionesPropias: QueHacerConElAtras[] = [];
  const empezadas: { donde: Element | Document; tipos: readonly string[] | null }[] = [];
  const salteadas = vi.fn();
  const nombres: { momento: number; piezas: string[] }[] = [];
  const nombradas: (readonly Pieza[])[] = [];
  const cambiosDeTipo = vi.fn();
  let alTocarUnaTarjeta: (tarjeta: TarjetaTocada) => void = () => undefined;
  let tarjetaALaVista: Element | null = null;
  let retenido = false;
  const entregar = () => {
    if (!retenido) return;
    retenido = false;
    router.state = { location: ubicacion() };
    coordinador?.avisarDelMarco(router.state.location.key);
  };
  const entregadas = vi.fn(entregar);
  let terminarLaTransicion: () => void = () => undefined;
  const valores = new Map<string, string>();
  const memoria = memoriaEn({
    getItem: (clave) => valores.get(clave) ?? null,
    setItem: (clave, valor) => {
      valores.set(clave, valor);
    },
  });

  const ubicacion = () => {
    const [pathname = '/', busqueda] = (pila[indice]?.url ?? '/').split('?');
    clavesDelRouter += 1;
    return {
      pathname,
      search: busqueda === undefined ? '' : `?${busqueda}`,
      key: `r${String(clavesDelRouter)}`,
    };
  };

  let coordinador: Coordinador | null = null;
  const router = {
    state: { location: ubicacion() },
    navigate: (a: string | number, opciones?: { replace: boolean; flushSync: boolean }) => {
      llamadas.push({ a, opciones });
      if (typeof a === 'number') {
        indice += a;
        decisionesPropias.push(decidirElAtras(new PopStateEvent('popstate')));
      } else if (opciones?.replace === true) {
        pila[indice] = { key: pila[indice]?.key ?? 'x', url: a };
      } else {
        pila.splice(indice + 1);
        pila.push({ key: `k${String(proximaClave)}`, url: a });
        proximaClave += 1;
        indice = pila.length - 1;
      }
      router.state = { location: ubicacion() };
      coordinador?.avisarDelMarco(router.state.location.key);
      return Promise.resolve();
    },
  };

  const historial: HistorialQueEscucha = {
    disponible: () => true,
    actual: () => pila[indice] ?? null,
    anteriores: () => pila.slice(0, indice).reverse(),
    escucharLosTraslados: () => () => undefined,
    olvidarElTraslado: () => {
      const ultimo = traslado;
      traslado = null;
      return ultimo;
    },
  };

  const escenario: Escenario = {
    nombrar: (_donde, piezas) => {
      nombradas.push(piezas);
      nombres.push({ momento: empezadas.length, piezas: piezas.map((pieza) => pieza.nombre) });
    },
    olvidarLosNombres: () => {
      nombres.push({ momento: empezadas.length, piezas: [] });
    },
    escucharLasTarjetas: (alTocar) => {
      alTocarUnaTarjeta = alTocar;
      return () => undefined;
    },
    primeraALaVista: () => tarjetaALaVista,
    conAlcanceEnElementos: () => true,
    conTransicionesDelDocumento: () => true,
    aLaVista: () => true,
    menosMovimiento: () => false,
    ancho: () => ancho,
    empezar: (donde, tipos, actualizar) => {
      empezadas.push({ donde, tipos });
      const terminada = new Promise<void>((listo) => {
        terminarLaTransicion = listo;
      });
      void actualizar();
      return {
        saltear: salteadas,
        lista: Promise.resolve(true),
        terminada,
        cambiarTipos: cambiosDeTipo,
      };
    },
  };

  const compuerta: Compuerta = {
    ventana: window,
    alVolver: (decidir) => {
      decidirElAtras = decidir;
    },
    entregarLoRetenido: entregadas,
    hayAlgoRetenido: () => false,
    escuchaAlgo: () => true,
  };

  coordinador = crearCoordinador({ router, historial, escenario, memoria, compuerta });
  coordinador.escuchar();
  const main = document.createElement('main');
  coordinador.registrarElMain(main);
  coordinador.avisarDelMarco(router.state.location.key);

  return {
    coordinador,
    main,
    pila: () => pila.slice(0, indice + 1).map((entrada) => entrada.url),
    claveDelRouter: () => router.state.location.key,
    actual: () => pila[indice],
    llamadas,
    decisionesPropias,
    empezadas,
    nombres,
    nombradas,
    cambiosDeTipo,
    tocarLaTarjeta: (proyectoId: string, elemento: Element) => {
      alTocarUnaTarjeta({ proyectoId, elemento });
    },
    ponerLaTarjetaALaVista: (elemento: Element | null) => {
      tarjetaALaVista = elemento;
    },
    salteadas,
    entregadas,
    memoria,
    terminarLaTransicion: () => {
      terminarLaTransicion();
    },
    volverConElTelefono: (saltos: number, navegadorYaAnimo = false) => {
      traslado = { desde: pila[indice]?.key ?? '', saltos: -saltos, navegadorYaAnimo };
      indice -= saltos;
      retenido = true;
      const queHacer = decidirElAtras(new PopStateEvent('popstate'));
      if (queHacer === 'ahora') entregar();
      return queHacer;
    },
  };
}

const LO_QUE_FLOTA = { selector: '[data-lo-que-flota-abajo]', nombre: 'lo-que-flota' };

function soltar(): Promise<void> {
  return new Promise((listo) => setTimeout(listo, 0));
}

describe('el coordinador', () => {
  it('apila con el movimiento de la política, sobre el <main>, y lo anota en la memoria', async () => {
    const prueba = armar(['/', '/clientes']);
    prueba.coordinador.ir('/clientes/1', {});
    await soltar();
    expect(prueba.empezadas).toEqual([{ donde: prueba.main, tipos: ['empuje'] }]);
    expect(prueba.llamadas).toEqual([
      { a: '/clientes/1', opciones: { replace: false, state: undefined, flushSync: true } },
    ]);
    expect(prueba.memoria.leer(prueba.actual()?.key ?? '')).toBe('empuje');
    expect(prueba.coordinador.hayUnaTransicion()).toBe(true);
    prueba.terminarLaTransicion();
    await soltar();
    expect(prueba.coordinador.hayUnaTransicion()).toBe(false);
  });

  it('sin el <main> registrado, cambia sin transición y sin apurar a React', async () => {
    const prueba = armar(['/', '/clientes']);
    prueba.coordinador.registrarElMain(null);
    prueba.coordinador.ir('/clientes/1', {});
    await soltar();
    expect(prueba.empezadas).toEqual([]);
    expect(prueba.llamadas[0]?.opciones?.flushSync).toBe(false);
  });

  it('en la compu, lo que viene de la navegación funde con el navegador, del documento y sin tipos', async () => {
    const prueba = armar(['/'], 'escritorio');
    prueba.coordinador.ir('/clientes', { desdeLaNavegacion: true });
    await soltar();
    expect(prueba.empezadas).toEqual([{ donde: document, tipos: null }]);
  });

  it('cambiar de sección son varios pasos adentro de una sola transición, y la raíz queda anotada con fundido', async () => {
    const prueba = armar(['/', '/clientes', '/clientes/1']);
    prueba.coordinador.ir('/finanzas', { desdeLaNavegacion: true });
    await soltar();
    expect(prueba.empezadas).toEqual([{ donde: prueba.main, tipos: ['fundido'] }]);
    expect(prueba.llamadas.map((llamada) => llamada.a)).toEqual([-2, '/finanzas']);
    expect(prueba.pila()).toEqual(['/', '/finanzas']);
    expect(prueba.memoria.leer(prueba.actual()?.key ?? '')).toBe('fundido');
  });

  it('volver sin entrada anterior arma Inicio abajo: se ve una vuelta y la raíz se anota con fundido', async () => {
    const prueba = armar(['/proyectos/1']);
    prueba.coordinador.volver('/proyectos');
    await soltar();
    expect(prueba.empezadas).toEqual([{ donde: prueba.main, tipos: ['vuelta'] }]);
    expect(prueba.pila()).toEqual(['/', '/proyectos']);
    expect(prueba.memoria.leer(prueba.actual()?.key ?? '')).toBe('fundido');
  });

  it('el botón del teléfono desanda lo que hizo el toque: retiene el popstate y lo entrega adentro de la transición', async () => {
    const prueba = armar(['/', '/proyectos/1']);
    prueba.coordinador.ir('/proyectos/1/editar', {});
    await soltar();
    prueba.terminarLaTransicion();
    await soltar();
    prueba.entregadas.mockClear();
    expect(prueba.volverConElTelefono(1)).toBe('retener');
    await soltar();
    expect(prueba.empezadas.at(-1)).toEqual({ donde: document, tipos: ['bajada'] });
    expect(prueba.entregadas).toHaveBeenCalledTimes(1);
  });

  it('si el navegador ya animó el gesto, ninguna transición y el router se actualiza en el acto', () => {
    const prueba = armar(['/', '/clientes', '/clientes/1']);
    expect(prueba.volverConElTelefono(1, true)).toBe('ahora');
    expect(prueba.empezadas).toEqual([]);
  });

  it('lo que dispara el mismo coordinador pasa derecho por la compuerta', async () => {
    const prueba = armar(['/', '/clientes', '/clientes/1']);
    prueba.coordinador.volver('/clientes');
    await soltar();
    expect(prueba.llamadas.map((llamada) => llamada.a)).toEqual([-1]);
    expect(prueba.decisionesPropias).toEqual(['ahora']);
    expect(prueba.empezadas).toEqual([{ donde: prueba.main, tipos: ['vuelta'] }]);
  });

  it('una navegación nueva entrega lo retenido y saltea la transición en curso antes de arrancar la suya', async () => {
    const prueba = armar(['/', '/clientes']);
    prueba.coordinador.ir('/clientes/1', {});
    await soltar();
    prueba.coordinador.ir('/finanzas', { desdeLaNavegacion: true });
    expect(prueba.entregadas).toHaveBeenCalled();
    expect(prueba.salteadas).toHaveBeenCalled();
    await soltar();
    expect(prueba.pila()).toEqual(['/', '/finanzas']);
  });

  it('anuncia la salida con la entrada que se va y la levanta cuando la cola se vacía, aunque no haya nada que hacer', async () => {
    const prueba = armar(['/', '/clientes']);
    const avisos: (string | null)[] = [];
    prueba.coordinador.escucharLaSalida((saliendoDe) => avisos.push(saliendoDe));
    const clave = prueba.claveDelRouter();
    prueba.coordinador.anunciarLaSalida();
    prueba.coordinador.ir('/clientes/1', {});
    expect(avisos).toEqual([clave]);
    await soltar();
    expect(avisos).toEqual([clave, null]);

    avisos.length = 0;
    prueba.coordinador.anunciarLaSalida();
    prueba.coordinador.ir('/clientes/1', { como: 'terminar' });
    await soltar();
    expect(avisos).toEqual([prueba.claveDelRouter(), null]);
    expect(prueba.pila()).toEqual(['/', '/clientes', '/clientes/1']);
  });

  it('entre pestañas nombra el fondo y lo de abajo antes de capturar y después de actualizar, y los olvida al terminar', async () => {
    const prueba = armar(['/', '/proyectos']);
    prueba.coordinador.ir('/proyectos?etapa=historial', {});
    await soltar();
    expect(prueba.empezadas).toEqual([{ donde: prueba.main, tipos: ['pestana-adelante'] }]);
    const piezas = ['fondo-de-la-pestana', 'etiqueta-de-la-pestana', 'contenido-de-la-pestana'];
    expect(prueba.nombres).toEqual([
      { momento: 0, piezas },
      { momento: 1, piezas },
    ]);
    prueba.terminarLaTransicion();
    await soltar();
    expect(prueba.nombres.at(-1)).toEqual({ momento: 1, piezas: [] });
  });

  it('lo que sale de una tarjeta es tarjeta: nombra la tarjeta tocada antes y el encabezado de su ficha después', async () => {
    const prueba = armar(['/', '/proyectos']);
    const tarjeta = document.createElement('li');
    prueba.tocarLaTarjeta('p1', tarjeta);
    prueba.coordinador.ir('/proyectos/p1', {});
    await soltar();
    expect(prueba.empezadas).toEqual([{ donde: document, tipos: ['tarjeta'] }]);
    expect(prueba.nombradas).toEqual([
      [LO_QUE_FLOTA, { nombre: 'tarjeta', elemento: tarjeta }],
      [LO_QUE_FLOTA, { nombre: 'tarjeta', selector: '[data-destino-de="p1"]' }],
    ]);
    expect(prueba.memoria.leer(prueba.actual()?.key ?? '')).toBe('tarjeta');
  });

  it('la tarjeta tocada no vale para ir a otra ficha', async () => {
    const prueba = armar(['/', '/proyectos']);
    prueba.tocarLaTarjeta('p1', document.createElement('li'));
    prueba.coordinador.ir('/proyectos/p2', {});
    await soltar();
    expect(prueba.empezadas).toEqual([{ donde: prueba.main, tipos: ['empuje'] }]);
  });

  it('al volver, el encabezado vuelve a su tarjeta si quedó a la vista; si no, se apaga en su lugar y la lista funde', async () => {
    const prueba = armar(['/', '/proyectos']);
    prueba.tocarLaTarjeta('p1', document.createElement('li'));
    prueba.coordinador.ir('/proyectos/p1', {});
    await soltar();
    prueba.terminarLaTransicion();
    await soltar();

    const deVuelta = document.createElement('li');
    prueba.ponerLaTarjetaALaVista(deVuelta);
    expect(prueba.volverConElTelefono(1)).toBe('retener');
    await soltar();
    expect(prueba.empezadas.at(-1)).toEqual({ donde: document, tipos: ['tarjeta-vuelta'] });
    expect(prueba.nombradas.slice(-2)).toEqual([
      [LO_QUE_FLOTA, { nombre: 'tarjeta', selector: '[data-destino-de="p1"]' }],
      [LO_QUE_FLOTA, { nombre: 'tarjeta', elemento: deVuelta }],
    ]);
    expect(prueba.cambiosDeTipo).not.toHaveBeenCalled();
    prueba.terminarLaTransicion();
    await soltar();

    prueba.tocarLaTarjeta('p1', document.createElement('li'));
    prueba.coordinador.ir('/proyectos/p1', {});
    await soltar();
    prueba.terminarLaTransicion();
    await soltar();
    prueba.ponerLaTarjetaALaVista(null);
    prueba.coordinador.volver('/proyectos');
    await soltar();
    expect(prueba.cambiosDeTipo).toHaveBeenCalledWith(['tarjeta-vuelta'], ['fundido']);
    expect(prueba.nombradas.at(-1)).toEqual([LO_QUE_FLOTA]);
  });

  it('la etiqueta de volver sale de la entrada anterior', () => {
    const prueba = armar(['/', '/agenda', '/proyectos/1']);
    expect(prueba.coordinador.etiquetaDeVolver('/proyectos', 'Proyectos')).toBe('Agenda');
  });

  it('sabe adónde lleva un plan con varios pasos', () => {
    const situacion = {
      actual: '/clientes/1',
      anteriores: [
        { key: 'b', url: '/clientes' },
        { key: 'a', url: '/' },
      ],
      movil: true,
      conHistorial: true,
    };
    expect(
      destinoDelPlan(
        {
          tipo: 'seccion',
          pasos: [
            { tipo: 'atras', saltos: 2 },
            { tipo: 'apilar', url: '/finanzas' },
          ],
        },
        situacion,
      ),
    ).toBe('/finanzas');
    expect(
      destinoDelPlan({ tipo: 'atras', pasos: [{ tipo: 'atras', saltos: 1 }] }, situacion),
    ).toBe('/clientes');
    expect(
      destinoDelPlan(
        {
          tipo: 'seccion',
          pasos: [
            { tipo: 'atras', saltos: 1 },
            { tipo: 'reemplazar', url: '/proyectos' },
          ],
        },
        situacion,
      ),
    ).toBe('/proyectos');
  });
});
