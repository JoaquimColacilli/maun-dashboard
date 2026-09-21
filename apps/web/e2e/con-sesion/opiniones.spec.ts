import { expect, test, type Page } from '@playwright/test';

import {
  borrarPreguntasConTexto,
  contestarComoCliente,
  crearCliente,
  encuestaComoCliente,
  encuestaPorRest,
  encuestasDe,
  guardarProyectoPorRpc,
  iniciarSesionDePrueba,
  preguntasConTexto,
  vaciarTaller,
  type SesionDePrueba,
} from '../apoyo/taller';

const CARGA = { timeout: 30_000 };
const PREGUNTA_DE_PRUEBA = '¿Cómo nos conociste? (prueba)';
const COMENTARIO = 'Quedó impecable, mejor de lo que me imaginaba.';

let sesion: SesionDePrueba;

test.beforeEach(async () => {
  sesion = await iniciarSesionDePrueba();
  await vaciarTaller(sesion);
});

async function trabajoTerminado(): Promise<string> {
  const clienteId = await crearCliente(sesion, 'Marcela Duarte', { telefono: '11 5523 4410' });
  const id = crypto.randomUUID();
  await guardarProyectoPorRpc(sesion, {
    proyecto: {
      id,
      version: null,
      cliente_id: clienteId,
      titulo: 'Placard 3 puertas con interior en melamina',
      estado: 'entregado',
      presupuesto_centavos: 100_000_000,
      comprobante: 'sin_comprobante',
    },
    pagos: [],
    gastos: [],
  });
  return id;
}

interface PreguntaCompartida {
  id: string;
  tipo: string;
  obligatoria: boolean;
}

async function contestarBien(token: string): Promise<unknown> {
  const encuesta = (await encuestaComoCliente(sesion, token)) as {
    preguntas: PreguntaCompartida[];
  };
  const valor = (pregunta: PreguntaCompartida): number | string =>
    pregunta.tipo === 'texto' ? COMENTARIO : pregunta.tipo === 'sitalvezno' ? 3 : 5;
  return contestarComoCliente(sesion, token, {
    id: crypto.randomUUID(),
    renglones: encuesta.preguntas.map((pregunta) => ({
      pregunta: pregunta.id,
      valor: valor(pregunta),
    })),
  });
}

function titulo(page: Page, nombre: string) {
  return page.getByRole('heading', { level: 1, name: nombre });
}

async function laReplicaGuardadaDice(page: Page, texto: string): Promise<boolean> {
  return page.evaluate(async (buscado) => {
    const base = await new Promise<IDBDatabase>((resolver, fallar) => {
      const pedido = indexedDB.open('maun');
      pedido.onsuccess = () => {
        resolver(pedido.result);
      };
      pedido.onerror = () => {
        fallar(new Error('no se pudo abrir la base del aparato'));
      };
    });
    try {
      if (!base.objectStoreNames.contains('react-query')) return false;
      const guardado = await new Promise<unknown>((resolver, fallar) => {
        const pedido = base.transaction('react-query').objectStore('react-query').get('cache');
        pedido.onsuccess = () => {
          resolver(pedido.result);
        };
        pedido.onerror = () => {
          fallar(new Error('no se pudo leer lo guardado'));
        };
      });
      return JSON.stringify(guardado ?? null).includes(buscado);
    } finally {
      base.close();
    }
  }, texto);
}

async function sincronizarEIrAInicio(page: Page): Promise<void> {
  await page.goto('/ajustes');
  const sincronizar = page.getByRole('button', { name: 'Sincronizar ahora' });
  await expect(sincronizar).toBeEnabled(CARGA);
  await Promise.all([
    page.waitForResponse((respuesta) => /\/rest\/v1\/rpc\/(delta|bootstrap)/.test(respuesta.url())),
    sincronizar.click(),
  ]);
  await page
    .getByRole('navigation', { name: 'Principal' })
    .getByRole('button', { name: 'Inicio', exact: true })
    .click();
  await expect(titulo(page, 'Inicio')).toBeVisible(CARGA);
}

test('se pide desde el trabajo terminado, se contesta y vuelve a Opiniones', async ({
  page,
  context,
}) => {
  const id = await trabajoTerminado();
  await context.route('https://wa.me/**', (ruta) =>
    ruta.fulfill({ contentType: 'text/html', body: '<p>WhatsApp</p>' }),
  );

  await page.goto(`/proyectos/${id}`);
  const pedido = page.getByRole('region', { name: 'Pedile la opinión a Marcela' });
  await expect(pedido).toBeVisible(CARGA);

  const [whatsapp] = await Promise.all([
    context.waitForEvent('page'),
    pedido.getByRole('link', { name: 'Pedírsela por WhatsApp' }).click(),
  ]);
  const destino = new URL(whatsapp.url());
  expect(destino.pathname).toBe('/5491155234410');
  const mensaje = destino.searchParams.get('text') ?? '';
  expect(mensaje).toMatch(/^Hola Marcela, ya terminamos tu placard\./);
  const token = /\/o\/([A-Za-z0-9_-]+)$/.exec(mensaje)?.[1] ?? '';
  expect(token).not.toBe('');
  await whatsapp.close();

  await expect(page.getByRole('region', { name: 'Le pediste la opinión' })).toBeVisible(CARGA);
  await expect
    .poll(async () => (await encuestasDe(sesion, id)).map((fila) => fila.token))
    .toEqual([token]);

  expect(await contestarBien(token)).toEqual({ estado: 'guardada' });
  expect(await contestarBien(token)).toEqual({ estado: 'ya_contestada' });

  await sincronizarEIrAInicio(page);
  const linea = page.getByRole('link', { name: /Marcela Duarte opinó de su placard/ });
  await expect(linea).toBeVisible(CARGA);
  await linea.click();

  const ficha = page.getByRole('dialog', { name: 'Marcela Duarte' });
  await expect(ficha).toBeVisible(CARGA);
  await expect(ficha.getByText(COMENTARIO)).toBeVisible();
  await ficha.getByRole('button', { name: 'Cerrar' }).click();

  await expect(titulo(page, 'Resultados')).toBeVisible();
  await expect(page.getByText('Es el promedio de 1 respuesta')).toBeVisible();

  await page.goto('/');
  await expect(titulo(page, 'Inicio')).toBeVisible(CARGA);
  await expect(page.getByRole('link', { name: /opinó de su placard/ })).toHaveCount(0, CARGA);
});

test('Resultados se abre sin señal, con lo último que se sincronizó', async ({ page, context }) => {
  const id = await trabajoTerminado();
  const token = `e2e-${crypto.randomUUID().replaceAll('-', '')}`;
  await encuestaPorRest(sesion, id, token);
  expect(await contestarBien(token)).toEqual({ estado: 'guardada' });

  await page.goto('/opiniones');
  await expect(page.getByText('Es el promedio de 1 respuesta')).toBeVisible(CARGA);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await expect.poll(() => laReplicaGuardadaDice(page, COMENTARIO), CARGA).toBe(true);

  await context.setOffline(true);
  await page.close();
  const reabierta = await context.newPage();
  await reabierta.goto('/opiniones');

  const principal = reabierta.getByRole('main');
  await expect(titulo(reabierta, 'Resultados')).toBeVisible(CARGA);
  await expect(
    principal.getByText('Sin conexión. Estás viendo lo último que se sincronizó.'),
  ).toBeVisible();
  await expect(principal.getByText('Es el promedio de 1 respuesta')).toBeVisible();
  await expect(principal.getByText(COMENTARIO)).toBeVisible();
  await context.setOffline(false);
});

test('la encuesta pública le pregunta a la base como anónima aunque el dueño tenga la sesión abierta', async ({
  page,
}) => {
  const id = await trabajoTerminado();
  const token = `e2e-${crypto.randomUUID().replaceAll('-', '')}`;
  await encuestaPorRest(sesion, id, token);

  const autorizaciones: string[] = [];
  page.on('request', (pedido) => {
    if (/\/rest\/v1\/rpc\/(encuesta_compartida|contestar_encuesta)/.test(pedido.url())) {
      autorizaciones.push(pedido.headers().authorization ?? '');
    }
  });

  await page.goto(`/o/${token}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    '¿Cómo te fue con tu placard?',
    CARGA,
  );

  expect(autorizaciones.length).toBeGreaterThan(0);
  for (const autorizacion of autorizaciones) {
    const jwt = autorizacion.replace(/^Bearer /, '');
    if (jwt.split('.').length === 3) {
      const [, cuerpo = ''] = jwt.split('.');
      const reclamos = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8')) as {
        role?: string;
      };
      expect(reclamos.role).toBe('anon');
    } else {
      expect(jwt).not.toBe(sesion.accessToken);
    }
  }
});

test('el editor de preguntas se usa con el teclado y deja el taller como estaba', async ({
  page,
}, testInfo) => {
  await borrarPreguntasConTexto(sesion, PREGUNTA_DE_PRUEBA);
  await page.goto('/opiniones/preguntas');
  await expect(titulo(page, 'Preguntas')).toBeVisible(CARGA);
  const lista = page.getByRole('list', { name: 'Lo que se pregunta' });
  await expect(lista.getByRole('listitem').first()).toBeVisible(CARGA);
  const antes = await lista.getByRole('listitem').count();

  const agregar = page.getByRole('button', { name: 'Agregar una pregunta' });
  await agregar.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('textbox', { name: 'Qué se pregunta' })).toBeFocused();
  await page.keyboard.type(PREGUNTA_DE_PRUEBA);
  await page.keyboard.press('Tab');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('radio', { name: /Texto libre/ })).toBeChecked();

  console.log(`\n=== árbol de accesibilidad del editor (${testInfo.project.name}) ===`);
  console.log(await page.getByRole('main').ariaSnapshot());

  await page.getByRole('button', { name: 'Guardar la pregunta' }).focus();
  await page.keyboard.press('Enter');
  const nueva = lista.getByRole('listitem').filter({ hasText: PREGUNTA_DE_PRUEBA });
  await expect(nueva).toBeVisible(CARGA);
  await expect(nueva.getByRole('button', { name: PREGUNTA_DE_PRUEBA })).toBeFocused();
  await expect(lista.getByRole('listitem')).toHaveCount(antes + 1);
  await expect
    .poll(async () => (await preguntasConTexto(sesion, PREGUNTA_DE_PRUEBA)).length, CARGA)
    .toBe(1);

  await nueva.getByRole('button', { name: 'Dejar de preguntarla' }).click();
  await expect(lista.getByRole('listitem')).toHaveCount(antes, CARGA);
  await expect(
    page.getByRole('region', { name: 'Las que ya no preguntás' }).getByText(PREGUNTA_DE_PRUEBA),
  ).toHaveCount(0);
  await expect
    .poll(async () => (await preguntasConTexto(sesion, PREGUNTA_DE_PRUEBA)).length, CARGA)
    .toBe(0);
});
