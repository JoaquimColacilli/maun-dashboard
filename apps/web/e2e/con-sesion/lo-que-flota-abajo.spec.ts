import { expect, test, type CDPSession, type Page } from '@playwright/test';

import {
  ajustarTaller,
  contactoPorRpc,
  crearCliente,
  guardarProyectoPorRpc,
  hoyEnElTaller,
  iniciarSesionDePrueba,
  vaciarTaller,
  type SesionDePrueba,
} from '../apoyo/taller';

const CARGA = { timeout: 30_000 };
const LETRA_DE_FABRICA = 16;
const ESTILO_DE_LA_RAIZ_MAS_ALTA = 'e2e-raiz-mas-alta';

let sesion: SesionDePrueba;

interface Taller {
  clienteId: string;
  obraId: string;
  entregadoId: string;
  contactoId: string;
}

interface Condicion {
  codigo: string;
  nombre: string;
  zonaSegura: number;
  raizDeMas: number;
  letra: number;
}

const BASE: Condicion = {
  codigo: 'base',
  nombre: 'base',
  zonaSegura: 0,
  raizDeMas: 0,
  letra: LETRA_DE_FABRICA,
};

const CONDICIONES_DEL_CELULAR: Condicion[] = [
  BASE,
  { ...BASE, codigo: 'zs24', nombre: 'zona segura 24', zonaSegura: 24 },
  { ...BASE, codigo: 'zs34', nombre: 'zona segura 34', zonaSegura: 34 },
  { ...BASE, codigo: 'zs48', nombre: 'zona segura 48', zonaSegura: 48 },
  { ...BASE, codigo: 'raiz48', nombre: 'raíz 48 px más alta que la ventana', raizDeMas: 48 },
  { ...BASE, codigo: 'raiz64', nombre: 'raíz 64 px más alta que la ventana', raizDeMas: 64 },
  {
    ...BASE,
    codigo: 'raiz64-zs48',
    nombre: 'raíz 64 px más alta y zona segura 48',
    raizDeMas: 64,
    zonaSegura: 48,
  },
  { ...BASE, codigo: 'letra', nombre: 'letra grande', letra: 22 },
];

const CAPTURADAS = new Set(['base', 'raiz64']);

function nombreDeCaptura(indice: number, senal: string, condicion: Condicion): string {
  const numero = String(indice + 1).padStart(2, '0');
  return `${numero}-${senal === 'con señal' ? 'con' : 'sin'}-${condicion.codigo}`;
}

function filas(cantidad: number, crear: (indice: number) => Record<string, unknown>): unknown[] {
  return Array.from({ length: cantidad }, (_, indice) => crear(indice));
}

async function movimientos(cantidad: number): Promise<void> {
  const { entorno, accessToken } = sesion;
  const respuesta = await fetch(`${entorno.url}/rest/v1/movimientos`, {
    method: 'POST',
    headers: {
      apikey: entorno.publishableKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(
      filas(cantidad, (indice) => ({
        id: crypto.randomUUID(),
        fecha: new Date().toISOString().slice(0, 10),
        tipo: 'ingreso',
        tesoro_origen: null,
        tesoro_destino: 'hogar',
        monto_centavos: 1_000_000 + indice,
        categoria: 'Docencia',
        descripcion: `Ingreso de prueba ${String(indice + 1)}`,
      })),
    ),
  });
  expect(respuesta.ok).toBe(true);
}

async function sembrar(): Promise<Taller> {
  await vaciarTaller(sesion);
  await ajustarTaller(sesion, {
    sueldo_mensual_centavos: 50_000_000,
    costos_fijos_centavos: 25_000_000,
  });

  const clienteId = await crearCliente(sesion, 'E2E Cliente de la barra', {
    telefono: '11 5555 5555',
    direccion: 'Av. Maipú 1234',
  });
  for (let indice = 0; indice < 8; indice += 1) {
    await crearCliente(sesion, `E2E Cliente ${String(indice + 1)}`);
  }

  const hoy = hoyEnElTaller();
  const obraId = crypto.randomUUID();
  await guardarProyectoPorRpc(sesion, {
    proyecto: {
      id: obraId,
      version: null,
      cliente_id: clienteId,
      titulo: 'E2E Placard con muchos movimientos',
      estado: 'en_curso',
      presupuesto_centavos: 300_000_000,
      comprobante: 'sin_comprobante',
      direccion_entrega: 'Av. Libertador 5500, Núñez',
    },
    pagos: filas(6, (indice) => ({
      id: crypto.randomUUID(),
      fecha: hoy,
      concepto: `Pago ${String(indice + 1)}`,
      monto_centavos: 10_000_000,
    })),
    gastos: filas(8, (indice) => ({
      id: crypto.randomUUID(),
      fecha: hoy,
      descripcion: `Insumo ${String(indice + 1)}`,
      monto_centavos: 1_000_000,
    })),
  });

  const entregadoId = crypto.randomUUID();
  await guardarProyectoPorRpc(sesion, {
    proyecto: {
      id: entregadoId,
      version: null,
      cliente_id: clienteId,
      titulo: 'E2E Mesada para cobrar',
      estado: 'entregado',
      presupuesto_centavos: 70_000_000,
      comprobante: 'sin_comprobante',
    },
    pagos: [{ id: crypto.randomUUID(), fecha: hoy, concepto: 'Seña', monto_centavos: 70_000_000 }],
    gastos: [],
  });

  const contacto = await contactoPorRpc(sesion, {
    titulo: 'E2E Contacto de la barra',
    sena: 5_000_000,
    telefono: '11 4444 4444',
  });
  for (let indice = 0; indice < 5; indice += 1) {
    await contactoPorRpc(sesion, { titulo: `E2E Contacto ${String(indice + 1)}` });
  }

  await movimientos(14);

  return { clienteId, obraId, entregadoId, contactoId: contacto.id };
}

async function alFinalDelScroll(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const elemento of document.querySelectorAll<HTMLElement>('*')) {
      const estilo = getComputedStyle(elemento);
      if (/(auto|scroll)/.test(estilo.overflowY) && elemento.scrollHeight > elemento.clientHeight) {
        elemento.scrollTop = elemento.scrollHeight;
      }
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
  await page.waitForTimeout(350);
}

async function aplicar(page: Page, cdp: CDPSession, condicion: Condicion): Promise<void> {
  await cdp.send('Emulation.setSafeAreaInsetsOverride', {
    insets: { bottom: condicion.zonaSegura },
  });
  await cdp.send('Page.setFontSizes', { fontSizes: { standard: condicion.letra } });
  await page.evaluate(
    ({ id, deMas }) => {
      document.getElementById(id)?.remove();
      if (deMas === 0) return;
      const estilo = document.createElement('style');
      estilo.id = id;
      estilo.textContent = `#root { height: calc(100dvh + ${String(deMas)}px) !important; }`;
      document.head.append(estilo);
      window.dispatchEvent(new Event('resize'));
    },
    { id: ESTILO_DE_LA_RAIZ_MAS_ALTA, deMas: condicion.raizDeMas },
  );
  await page.waitForTimeout(250);
}

async function contenidoTapado(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const principal = document.querySelector('main');
    if (!principal) return [];
    const ancho = document.documentElement.clientWidth;
    const alto = window.innerHeight;
    const PASO = 6;
    const limpio = (texto: string | null) => (texto ?? '').trim().replace(/\s+/g, ' ').slice(0, 60);

    const describir = (elemento: Element): string => {
      const conNombre = elemento.closest('nav, [role="status"], [role="alert"], [aria-label]');
      if (!conNombre) return elemento.tagName.toLowerCase();
      const rol = conNombre.getAttribute('role');
      const nombre = conNombre.getAttribute('aria-label') ?? limpio(conNombre.textContent);
      return `${conNombre.tagName.toLowerCase()}${rol === null ? '' : `[${rol}]`} «${nombre}»`;
    };

    const esDelContenido = (elemento: Element) => principal.contains(elemento);
    const esDelMarco = (elemento: Element) => elemento.contains(principal);

    const flotantes = Array.from(document.querySelectorAll<HTMLElement>('body *')).filter(
      (elemento) =>
        !esDelContenido(elemento) &&
        !esDelMarco(elemento) &&
        elemento.closest('dialog') === null &&
        getComputedStyle(elemento).position === 'fixed',
    );

    const puntos = new Map<string, [number, number]>();
    for (const flotante of flotantes) {
      for (const pieza of [flotante, ...Array.from(flotante.querySelectorAll('*'))]) {
        const caja = pieza.getBoundingClientRect();
        if (caja.width === 0 || caja.height === 0) continue;
        const desdeY = Math.max(0, Math.ceil(caja.top / PASO) * PASO);
        const hastaY = Math.min(alto - 1, caja.bottom);
        const desdeX = Math.max(0, Math.ceil(caja.left / PASO) * PASO);
        const hastaX = Math.min(ancho - 1, caja.right);
        for (let y = desdeY; y <= hastaY; y += PASO) {
          for (let x = desdeX; x <= hastaX; x += PASO) {
            puntos.set(`${String(x)},${String(y)}`, [x, y]);
          }
        }
      }
    }

    const encima = new Map<string, Element>();
    for (const [clave, [x, y]] of puntos) {
      const tocado = document.elementFromPoint(x, y);
      if (tocado && !esDelContenido(tocado) && !esDelMarco(tocado)) encima.set(clave, tocado);
    }

    const textoEnElPunto = (elemento: Element, x: number, y: number): string | null => {
      const estilo = getComputedStyle(elemento);
      if (estilo.visibility === 'hidden' || Number(estilo.opacity) === 0) return null;
      const rango = document.createRange();
      for (const nodo of Array.from(elemento.childNodes)) {
        if (nodo.nodeType !== Node.TEXT_NODE || limpio(nodo.textContent) === '') continue;
        rango.selectNodeContents(nodo);
        for (const renglon of Array.from(rango.getClientRects())) {
          if (renglon.width < 2 || renglon.height < 2) continue;
          if (
            x >= renglon.left - 1 &&
            x <= renglon.right + 1 &&
            y >= renglon.top - 1 &&
            y <= renglon.bottom + 1
          ) {
            return limpio(nodo.textContent);
          }
        }
      }
      return null;
    };

    const tapados = new Map<string, string>();
    const sinPuntero = document.createElement('style');
    sinPuntero.textContent =
      'body * { pointer-events: none !important; } main, main * { pointer-events: auto !important; }';
    document.head.append(sinPuntero);
    try {
      for (const [clave, flotante] of encima) {
        const [x, y] = puntos.get(clave) ?? [0, 0];
        const debajo = document.elementFromPoint(x, y);
        if (!debajo || !esDelContenido(debajo)) continue;
        const control = debajo.closest('a[href], button, input, textarea, select, [role="tab"]');
        const texto = textoEnElPunto(debajo, x, y);
        if (control === null && texto === null) continue;
        const que =
          control === null
            ? `texto «${texto ?? ''}»`
            : `${control.tagName.toLowerCase()} «${limpio(control.getAttribute('aria-label') ?? control.textContent)}»`;
        if (!tapados.has(que)) tapados.set(que, `${que}, tapado por ${describir(flotante)}`);
      }
    } finally {
      sinPuntero.remove();
    }
    return Array.from(tapados.values());
  });
}

async function finDeLaVistaTapado(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const fin = document.querySelector('[data-fin-de-la-vista]');
    if (!fin) return ['no se encontró el final de la vista del cliente'];
    const piezas = Array.from(document.querySelectorAll('[data-lo-que-flota-abajo] > *'))
      .map((pieza) => pieza.getBoundingClientRect())
      .filter((caja) => caja.width > 0 && caja.height > 0);
    if (piezas.length === 0) return [];
    const arriba = Math.min(...piezas.map((caja) => caja.top));
    const abajo = fin.getBoundingClientRect().bottom;
    return abajo <= arriba
      ? []
      : [
          `el final de la vista del cliente termina en ${String(Math.round(abajo))} px y lo que flota abajo arranca en ${String(Math.round(arriba))} px`,
        ];
  });
}

test.beforeEach(async () => {
  sesion = await iniciarSesionDePrueba();
});

test('al final del scroll nada del contenido queda debajo de lo que flota abajo, con señal y sin señal', async ({
  page,
  context,
  isMobile,
}, testInfo) => {
  test.setTimeout(900_000);
  const taller = await sembrar();
  const cdp = await context.newCDPSession(page);
  const condiciones = isMobile ? CONDICIONES_DEL_CELULAR : [BASE];

  const pantallas = [
    '/',
    '/seguimiento',
    '/proyectos',
    '/proyectos?etapa=historial',
    '/clientes',
    '/finanzas',
    '/diezmo',
    '/ajustes',
    `/proyectos/${taller.obraId}`,
    `/proyectos/${taller.contactoId}`,
    `/clientes/${taller.clienteId}`,
    `/proyectos/${taller.entregadoId}/cobrar`,
    `/proyectos/${taller.obraId}/cerrar`,
    `/proyectos/${taller.contactoId}/aprobar`,
    '/proyectos/nuevo',
    `/proyectos/${taller.obraId}/editar`,
    `/proyectos/${taller.obraId}/vista-cliente`,
    `/proyectos/${taller.contactoId}/vista-cliente`,
  ];

  const resultado: Record<string, string[]> = {};
  for (const [indice, ruta] of pantallas.entries()) {
    await page.goto(ruta);
    await expect(page.getByRole('main')).toBeVisible(CARGA);
    await expect(
      page.getByRole('status').filter({ hasText: /Abriendo la app|Trayendo los datos/ }),
    ).toHaveCount(0, CARGA);
    if (ruta.endsWith('/vista-cliente')) {
      await expect(page.locator('[data-fin-de-la-vista]')).toBeAttached(CARGA);
    }
    await page.waitForTimeout(800);

    for (const senal of ['con señal', 'sin señal'] as const) {
      if (senal === 'sin señal') {
        await context.setOffline(true);
        await expect(
          page.getByRole('status').filter({ hasText: 'Sin conexión' }).first(),
        ).toBeAttached();
        await page.waitForTimeout(300);
      }
      for (const condicion of condiciones) {
        await aplicar(page, cdp, condicion);
        await alFinalDelScroll(page);
        const tapados = [
          ...(await contenidoTapado(page)),
          ...(ruta.endsWith('/vista-cliente') ? await finDeLaVistaTapado(page) : []),
        ];
        const clave = `${String(indice + 1).padStart(2, '0')} ${ruta} (${senal}, ${condicion.nombre})`;
        if (tapados.length > 0) resultado[clave] = tapados;
        if (CAPTURADAS.has(condicion.codigo) || tapados.length > 0) {
          await page.screenshot({
            path: testInfo.outputPath(`${nombreDeCaptura(indice, senal, condicion)}.png`),
          });
        }
      }
      await aplicar(page, cdp, BASE);
    }
    await context.setOffline(false);
  }

  await testInfo.attach('tapados-al-fondo', {
    body: JSON.stringify(resultado, null, 2),
    contentType: 'application/json',
  });
  console.log(`tapados al fondo: ${JSON.stringify(resultado, null, 2)}`);
  expect(resultado).toEqual({});
});
