import { expect, test, type Page, type TestInfo } from '@playwright/test';

import {
  ajustarTaller,
  crearCliente,
  guardarProyectoPorRpc,
  hoyEnElTaller,
  iniciarSesionDePrueba,
  vaciarTaller,
  type FilaDeMovimiento,
  type SesionDePrueba,
} from '../apoyo/taller';

const CARGA = { timeout: 30_000 };
const TESOROS = ['hogar', 'maun', 'diezmo', 'cocos'] as const;
const ANCHOS_DEL_CELULAR = [320, 360, 390] as const;
const TEMAS = ['light', 'dark'] as const;

interface Escenario {
  nombre: string;
  centavos: number;
  texto: string;
  hogarEnNegativo?: boolean;
}

const ESCENARIOS: readonly Escenario[] = [
  { nombre: 'el de la captura', centavos: 150_629_184, texto: '$ 1.506.291,84' },
  { nombre: 'uno más largo', centavos: 1_234_567_890, texto: '$ 12.345.678,90' },
  {
    nombre: 'uno más largo, con Hogar en negativo',
    centavos: 1_234_567_890,
    texto: '-$ 12.345.678,90',
    hogarEnNegativo: true,
  },
];

interface Taller {
  proyectoId: string;
  clienteId: string;
  contactoId: string;
}

interface Pantalla {
  nombre: string;
  ruta: (taller: Taller) => string;
  listo: (page: Page) => Promise<void>;
}

const PANTALLAS: readonly Pantalla[] = [
  {
    nombre: 'Inicio',
    ruta: () => '/',
    listo: async (page) => {
      await expect(page.getByRole('region', { name: 'Tesoros' })).toBeVisible(CARGA);
    },
  },
  {
    nombre: 'Diezmo',
    ruta: () => '/diezmo',
    listo: async (page) => {
      await expect(page.getByRole('region', { name: 'Estado del diezmo' })).toBeVisible(CARGA);
    },
  },
  {
    nombre: 'Finanzas',
    ruta: () => '/finanzas',
    listo: async (page) => {
      await expect(page.getByRole('heading', { level: 1, name: 'Finanzas' })).toBeVisible(CARGA);
    },
  },
  {
    nombre: 'Ficha del trabajo',
    ruta: ({ proyectoId }) => `/proyectos/${proyectoId}`,
    listo: async (page) => {
      await expect(
        page.getByRole('heading', { level: 1, name: 'E2E Trabajo con montos largos' }),
      ).toBeVisible(CARGA);
    },
  },
  {
    nombre: 'Cobro',
    ruta: ({ proyectoId }) => `/proyectos/${proyectoId}/cobrar`,
    listo: async (page) => {
      await expect(page.getByRole('region', { name: 'Pago final' })).toBeVisible(CARGA);
    },
  },
  {
    nombre: 'Lo que ve el cliente',
    ruta: ({ proyectoId }) => `/proyectos/${proyectoId}/vista-cliente`,
    listo: async (page) => {
      await expect(page.getByRole('region', { name: 'Tu mueble' })).toBeVisible(CARGA);
    },
  },
  {
    nombre: 'Ficha del contacto',
    ruta: ({ contactoId }) => `/proyectos/${contactoId}`,
    listo: async (page) => {
      await expect(
        page.getByRole('heading', { level: 1, name: 'E2E Contacto con montos largos' }),
      ).toBeVisible(CARGA);
    },
  },
  {
    nombre: 'Ficha del cliente',
    ruta: ({ clienteId }) => `/clientes/${clienteId}`,
    listo: async (page) => {
      await expect(
        page.getByRole('heading', { level: 1, name: 'E2E Cliente con montos largos' }),
      ).toBeVisible(CARGA);
    },
  },
];

let sesion: SesionDePrueba;

test.beforeEach(async () => {
  sesion = await iniciarSesionDePrueba();
});

async function movimientosPorRest(filas: readonly Omit<FilaDeMovimiento, 'id'>[]): Promise<void> {
  const { entorno, accessToken } = sesion;
  const respuesta = await fetch(`${entorno.url}/rest/v1/movimientos`, {
    method: 'POST',
    headers: {
      apikey: entorno.publishableKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(filas.map((fila) => ({ id: crypto.randomUUID(), ...fila }))),
  });
  expect(respuesta.ok).toBe(true);
}

async function sembrar(escenario: Escenario): Promise<Taller> {
  const { centavos } = escenario;
  await vaciarTaller(sesion);
  await ajustarTaller(sesion, {
    sueldo_mensual_centavos: 50_000_000,
    costos_fijos_centavos: 25_000_000,
    meta_cocos_centavos: centavos * 2,
    tasa_cocos_anual_bp: 3000,
  });

  const hoy = hoyEnElTaller();
  await movimientosPorRest(
    TESOROS.map((tesoro) =>
      tesoro === 'hogar' && escenario.hogarEnNegativo === true
        ? {
            fecha: hoy,
            tipo: 'gasto',
            tesoro_origen: 'hogar',
            tesoro_destino: null,
            monto_centavos: centavos,
            categoria: 'E2E',
            descripcion: 'Gasto de prueba del hogar',
          }
        : {
            fecha: hoy,
            tipo: 'ingreso',
            tesoro_origen: null,
            tesoro_destino: tesoro,
            monto_centavos: centavos,
            categoria: 'E2E',
            descripcion: `Saldo de prueba de ${tesoro}`,
          },
    ),
  );

  const clienteId = await crearCliente(sesion, 'E2E Cliente con montos largos');
  const proyectoId = crypto.randomUUID();
  await guardarProyectoPorRpc(sesion, {
    proyecto: {
      id: proyectoId,
      version: null,
      cliente_id: clienteId,
      titulo: 'E2E Trabajo con montos largos',
      estado: 'entregado',
      presupuesto_centavos: centavos,
      comprobante: 'sin_comprobante',
    },
    pagos: [
      {
        id: crypto.randomUUID(),
        fecha: hoy,
        concepto: 'Seña',
        monto_centavos: Math.floor(centavos / 2),
      },
    ],
    gastos: [
      {
        id: crypto.randomUUID(),
        fecha: hoy,
        descripcion: 'Melamina',
        monto_centavos: Math.floor(centavos / 8),
      },
    ],
  });

  const contactoId = crypto.randomUUID();
  await guardarProyectoPorRpc(sesion, {
    proyecto: {
      id: contactoId,
      version: null,
      cliente_id: clienteId,
      titulo: 'E2E Contacto con montos largos',
      estado: 'presupuesto_enviado',
      presupuesto_centavos: centavos,
      comprobante: 'sin_comprobante',
    },
    pagos: [],
    gastos: [],
  });
  const { entorno, accessToken } = sesion;
  const costos = await fetch(`${entorno.url}/rest/v1/proyectos?id=eq.${contactoId}`, {
    method: 'PATCH',
    headers: {
      apikey: entorno.publishableKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      costo_madera_centavos: centavos,
      costo_herrajes_centavos: centavos,
      costo_flete_centavos: centavos,
      costo_ayudante_centavos: centavos,
    }),
  });
  expect(costos.ok).toBe(true);

  return { proyectoId, clienteId, contactoId };
}

interface Medida {
  texto: string;
  tarjeta: string;
  anchoDelMonto: number;
  anchoUtil: number;
  sobra: number;
  renglones: number;
}

async function medirLosMontos(page: Page): Promise<Medida[]> {
  return page.evaluate(() => {
    const MONTO = /-?\$\s?\d{1,3}(?:\.\d{3})*(?:,\d{2})?/g;
    const principal = document.querySelector('main');
    if (principal === null) return [];

    const visible = (elemento: Element): boolean =>
      elemento.getClientRects().length > 0 && elemento.closest('svg, [hidden]') === null;

    const rangoDe = (elemento: Element, inicio: number, fin: number): Range => {
      const rango = document.createRange();
      const caminante = document.createTreeWalker(elemento, NodeFilter.SHOW_TEXT);
      let recorrido = 0;
      let empezado = false;
      for (let nodo = caminante.nextNode(); nodo !== null; nodo = caminante.nextNode()) {
        const largo = (nodo as Text).data.length;
        if (!empezado && inicio < recorrido + largo) {
          rango.setStart(nodo, inicio - recorrido);
          empezado = true;
        }
        if (empezado && fin <= recorrido + largo) {
          rango.setEnd(nodo, fin - recorrido);
          break;
        }
        recorrido += largo;
      }
      return rango;
    };

    const bloqueDe = (nodo: Node): Element | null => {
      for (
        let elemento = nodo instanceof Element ? nodo : nodo.parentElement;
        elemento !== null;
        elemento = elemento.parentElement
      ) {
        if (getComputedStyle(elemento).display !== 'inline') return elemento;
      }
      return null;
    };

    const encontrados: { elemento: Element; monto: string; rango: Range }[] = [];
    for (const elemento of principal.querySelectorAll('*')) {
      if (!visible(elemento)) continue;
      const texto = elemento.textContent;
      for (const coincidencia of texto.matchAll(MONTO)) {
        const monto = coincidencia[0];
        const deUnHijo = [...elemento.children].some((hijo) => hijo.textContent.includes(monto));
        if (deUnHijo) continue;
        const inicio = coincidencia.index;
        const rango = rangoDe(elemento, inicio, inicio + monto.length);
        if (bloqueDe(rango.startContainer) !== bloqueDe(rango.endContainer)) continue;
        encontrados.push({ elemento, monto, rango });
      }
    }
    const montos = encontrados.filter(
      (uno) =>
        !encontrados.some(
          (otro) =>
            otro !== uno &&
            otro.elemento.contains(uno.elemento) &&
            otro.rango.compareBoundaryPoints(Range.START_TO_START, uno.rango) <= 0 &&
            otro.rango.compareBoundaryPoints(Range.END_TO_END, uno.rango) >= 0,
        ),
    );

    const pinta = (elemento: Element): boolean => {
      const estilo = getComputedStyle(elemento);
      const fondo = estilo.backgroundColor;
      const conFondo = fondo !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(fondo);
      const conBorde = ['Left', 'Right', 'Top', 'Bottom'].some(
        (lado) =>
          Number.parseFloat(estilo.getPropertyValue(`border-${lado.toLowerCase()}-width`)) > 0,
      );
      return conFondo || conBorde || elemento.tagName === 'BUTTON';
    };

    const limitesDe = (elemento: Element, sinPadding: boolean): { izq: number; der: number } => {
      const caja = elemento.getBoundingClientRect();
      if (!sinPadding) return { izq: caja.left, der: caja.right };
      const estilo = getComputedStyle(elemento);
      return {
        izq:
          caja.left +
          Number.parseFloat(estilo.borderLeftWidth) +
          Number.parseFloat(estilo.paddingLeft),
        der:
          caja.right -
          Number.parseFloat(estilo.borderRightWidth) -
          Number.parseFloat(estilo.paddingRight),
      };
    };

    return montos.map(({ elemento, monto, rango }) => {
      const trozos = [...rango.getClientRects()].filter((trozo) => trozo.width > 0);
      const izquierda = Math.min(...trozos.map((trozo) => trozo.left));
      const derecha = Math.max(...trozos.map((trozo) => trozo.right));

      const renglones: DOMRect[] = [];
      for (const trozo of trozos) {
        const mismo = renglones.find(
          (renglon) => trozo.top < renglon.bottom && trozo.bottom > renglon.top,
        );
        if (mismo === undefined) renglones.push(trozo);
      }

      let tarjeta: Element = principal;
      let sobra = 0;
      let anchoUtil = Number.POSITIVE_INFINITY;
      for (let caja: Element | null = elemento; caja !== null; caja = caja.parentElement) {
        const esLaTarjeta = caja === principal || (caja !== elemento && pinta(caja));
        if (getComputedStyle(caja).display !== 'inline' || esLaTarjeta) {
          const { izq, der } = limitesDe(caja, esLaTarjeta);
          sobra = Math.max(sobra, derecha - der, izq - izquierda);
          anchoUtil = Math.min(anchoUtil, der - izq);
        }
        if (esLaTarjeta) {
          tarjeta = caja;
          break;
        }
      }

      const nombre =
        tarjeta.getAttribute('aria-label') ??
        tarjeta.textContent.replace(/\s+/g, ' ').trim().slice(0, 28);
      return {
        texto: monto.replace(/\s+/g, ' '),
        tarjeta: `${tarjeta.tagName.toLowerCase()} «${nombre}»`,
        anchoDelMonto: Math.round((derecha - izquierda) * 10) / 10,
        anchoUtil: Math.round(anchoUtil * 10) / 10,
        sobra: Math.round(sobra * 10) / 10,
        renglones: renglones.length,
      };
    });
  });
}

const TARJETAS_DE_PLATA = [
  'section[aria-label="Tesoros"] > button',
  'section[aria-label="Estado del diezmo"]',
  'section[aria-label="Proyección de Cocos"]',
  'section[aria-label="Seña para confirmar"]',
].join(', ');

interface TextoQueSeSale {
  tarjeta: string;
  texto: string;
  sobra: number;
}

async function medirElTextoDeLasTarjetas(page: Page): Promise<TextoQueSeSale[]> {
  return page.evaluate((selector) => {
    const salidos: TextoQueSeSale[] = [];
    for (const tarjeta of document.querySelectorAll(selector)) {
      const caja = tarjeta.getBoundingClientRect();
      const estilo = getComputedStyle(tarjeta);
      const izquierda =
        caja.left +
        Number.parseFloat(estilo.borderLeftWidth) +
        Number.parseFloat(estilo.paddingLeft);
      const derecha =
        caja.right -
        Number.parseFloat(estilo.borderRightWidth) -
        Number.parseFloat(estilo.paddingRight);
      const caminante = document.createTreeWalker(tarjeta, NodeFilter.SHOW_TEXT);
      for (let nodo = caminante.nextNode(); nodo !== null; nodo = caminante.nextNode()) {
        const texto = (nodo as Text).data.trim();
        if (texto === '') continue;
        const rango = document.createRange();
        rango.selectNodeContents(nodo);
        for (const trozo of rango.getClientRects()) {
          if (trozo.width === 0) continue;
          const sobra = Math.max(trozo.right - derecha, izquierda - trozo.left);
          if (sobra > 0.5) {
            salidos.push({
              tarjeta:
                tarjeta.getAttribute('aria-label') ??
                tarjeta.textContent.replace(/\s+/g, ' ').trim().slice(0, 28),
              texto,
              sobra: Math.round(sobra * 10) / 10,
            });
          }
        }
      }
    }
    return salidos;
  }, TARJETAS_DE_PLATA);
}

async function capturar(page: Page, testInfo: TestInfo, nombre: string): Promise<void> {
  await page.screenshot({ path: testInfo.outputPath(`${nombre}.png`) });
}

async function recorrer(
  page: Page,
  testInfo: TestInfo,
  taller: Taller,
  anchos: readonly number[],
  prefijo: string,
): Promise<string[]> {
  const problemas: string[] = [];
  for (const tema of TEMAS) {
    await page.emulateMedia({ colorScheme: tema });
    for (const ancho of anchos) {
      await page.setViewportSize({ width: ancho, height: 844 });
      for (const pantalla of PANTALLAS) {
        await page.goto(pantalla.ruta(taller));
        await pantalla.listo(page);
        await page.evaluate(() => document.fonts.ready.then(() => undefined));

        const medidas = await medirLosMontos(page);
        for (const medida of medidas) {
          const linea = `${pantalla.nombre} ${String(ancho)} px ${tema}: ${medida.texto} en ${medida.tarjeta} mide ${String(medida.anchoDelMonto)} de ${String(medida.anchoUtil)} px útiles`;
          if (medida.sobra > 0.5 || medida.renglones > 1) {
            problemas.push(
              `${linea}: se sale ${String(medida.sobra)} px${medida.renglones > 1 ? `, en ${String(medida.renglones)} renglones` : ''}`,
            );
          }
          console.log(linea);
        }

        for (const salido of await medirElTextoDeLasTarjetas(page)) {
          problemas.push(
            `${pantalla.nombre} ${String(ancho)} px ${tema}: «${salido.texto}» se sale ${String(salido.sobra)} px de la tarjeta «${salido.tarjeta}»`,
          );
        }

        if (pantalla.nombre === 'Inicio' || pantalla.nombre === 'Diezmo') {
          await capturar(page, testInfo, `${prefijo}-${pantalla.nombre}-${String(ancho)}-${tema}`);
        }
      }
    }
  }
  return problemas;
}

for (const [indice, escenario] of ESCENARIOS.entries()) {
  test(`en el celular, ${escenario.nombre} (${escenario.texto}) entra entero en cada tarjeta de plata`, async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'celular', 'los tres anchos se recorren desde el celular');
    test.setTimeout(240_000);
    const taller = await sembrar(escenario);

    const problemas = await recorrer(
      page,
      testInfo,
      taller,
      ANCHOS_DEL_CELULAR,
      `escenario-${String(indice + 1)}`,
    );
    expect(problemas).toEqual([]);
  });
}

for (const [indice, escenario] of ESCENARIOS.slice(0, 2).entries()) {
  test(`en la computadora, ${escenario.nombre} (${escenario.texto}) entra entero en cada tarjeta de plata`, async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'escritorio', 'el ancho de la computadora');
    test.setTimeout(240_000);
    const taller = await sembrar(escenario);

    const problemas = await recorrer(
      page,
      testInfo,
      taller,
      [1024, 1440],
      `escenario-${String(indice + 1)}`,
    );
    expect(problemas).toEqual([]);
  });
}
