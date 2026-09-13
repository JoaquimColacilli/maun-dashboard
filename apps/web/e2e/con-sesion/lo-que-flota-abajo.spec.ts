import { expect, test, type Page } from '@playwright/test';

import {
  ajustarTaller,
  contactoPorRpc,
  crearCliente,
  guardarProyectoPorRpc,
  iniciarSesionDePrueba,
  vaciarTaller,
  type SesionDePrueba,
} from '../apoyo/taller';

const CARGA = { timeout: 30_000 };

let sesion: SesionDePrueba;

interface Taller {
  clienteId: string;
  obraId: string;
  entregadoId: string;
  contactoId: string;
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

  const hoy = new Date().toISOString().slice(0, 10);
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
  await page.waitForTimeout(300);
}

async function tapadosAlFondo(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const main = document.querySelector('main');
    if (!main) return [];
    const alto = window.visualViewport?.height ?? window.innerHeight;
    const limpio = (texto: string | null) => (texto ?? '').trim().replace(/\s+/g, ' ').slice(0, 60);
    const describir = (elemento: Element): string => {
      const conNombre = elemento.closest('nav, [role="status"], [role="alert"], [aria-label]');
      if (!conNombre) return elemento.tagName.toLowerCase();
      const rol = conNombre.getAttribute('role');
      const nombre = conNombre.getAttribute('aria-label') ?? limpio(conNombre.textContent);
      return `${conNombre.tagName.toLowerCase()}${rol === null ? '' : `[${rol}]`} «${nombre}»`;
    };
    const controles = main.querySelectorAll<HTMLElement>(
      'a[href], button, input, textarea, select, [role="tab"]',
    );
    const tapados: string[] = [];
    for (const control of controles) {
      const caja = control.getBoundingClientRect();
      if (caja.width === 0 || caja.height === 0 || caja.top >= alto || caja.bottom <= 0) continue;
      const puntos = [
        [caja.left + caja.width / 2, caja.top + caja.height / 2],
        [caja.left + caja.width / 2, caja.bottom - 2],
        [caja.left + 4, caja.bottom - 2],
        [caja.right - 4, caja.bottom - 2],
      ];
      for (const [x, y] of puntos) {
        if (x === undefined || y === undefined || y >= alto) continue;
        const encima = document.elementFromPoint(x, y);
        if (encima !== null && !main.contains(encima)) {
          const nombre = limpio(control.getAttribute('aria-label') ?? control.textContent);
          tapados.push(
            `${control.tagName.toLowerCase()} «${nombre}», tapado por ${describir(encima)}`,
          );
          break;
        }
      }
    }
    return tapados;
  });
}

test.beforeEach(async () => {
  sesion = await iniciarSesionDePrueba();
});

test('al final del scroll, con señal y sin señal, nada de lo que flota abajo tapa un control', async ({
  page,
  context,
}, testInfo) => {
  test.setTimeout(300_000);
  const taller = await sembrar();

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
  ];

  const resultado: Record<string, string[]> = {};
  for (const ruta of pantallas) {
    await page.goto(ruta);
    await expect(page.getByRole('main')).toBeVisible(CARGA);
    await expect(
      page.getByRole('status').filter({ hasText: /Abriendo la app|Trayendo los datos/ }),
    ).toHaveCount(0, CARGA);
    await page.waitForTimeout(800);

    for (const senal of ['con señal', 'sin señal'] as const) {
      if (senal === 'sin señal') {
        await context.setOffline(true);
        await expect(
          page.getByRole('status').filter({ hasText: 'Sin conexión' }).first(),
        ).toBeAttached();
        await page.waitForTimeout(300);
      }
      await alFinalDelScroll(page);
      const tapados = await tapadosAlFondo(page);
      if (tapados.length > 0) {
        const clave = `${ruta} (${senal})`;
        resultado[clave] = tapados;
        await page.screenshot({
          path: testInfo.outputPath(`tapado-${clave.replace(/[^a-z0-9]+/gi, '-')}.png`),
        });
      }
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
