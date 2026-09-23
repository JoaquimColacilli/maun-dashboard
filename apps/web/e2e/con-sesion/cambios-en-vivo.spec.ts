import { expect, test, type Page } from '@playwright/test';

import { ESTADO_DE_SESION, type EntornoDePrueba } from '../apoyo/entorno';
import { entrarConLaSesion } from '../apoyo/sesion';
import {
  contestarComoCliente,
  crearCliente,
  encuestaComoCliente,
  encuestaPorRest,
  guardarProyectoPorRpc,
  householdDePrueba,
  iniciarSesionDePrueba,
  vaciarTaller,
  type SesionDePrueba,
} from '../apoyo/taller';

const CARGA = { timeout: 30_000 };
const SOLA = { timeout: 10_000 };
const CANAL = /\/realtime\/v1\/websocket/;
const UNIDO = /realtime:cambios:[^"]*","phx_reply",\{"status":"ok"/;

let sesion: SesionDePrueba;

test.beforeEach(async () => {
  sesion = await iniciarSesionDePrueba();
  await vaciarTaller(sesion);
});

interface Frame {
  sentido: 'sale' | 'entra';
  texto: string;
}

function anotarLosFrames(page: Page): Frame[] {
  const frames: Frame[] = [];
  page.on('websocket', (socket) => {
    if (!CANAL.test(socket.url())) return;
    const anotar = (sentido: Frame['sentido']) => (frame: { payload: string | Buffer }) => {
      frames.push({
        sentido,
        texto: typeof frame.payload === 'string' ? frame.payload : frame.payload.toString('latin1'),
      });
    };
    socket.on('framesent', anotar('sale'));
    socket.on('framereceived', anotar('entra'));
  });
  return frames;
}

function contar(frames: Frame[], sentido: Frame['sentido'], patron: RegExp): number {
  return frames.filter((frame) => frame.sentido === sentido && patron.test(frame.texto)).length;
}

function anotarLosDeltas(page: Page): { cuantos: () => number } {
  let cuantos = 0;
  page.on('request', (pedido) => {
    if (/\/rest\/v1\/rpc\/(delta|bootstrap)/.test(pedido.url())) cuantos += 1;
  });
  return { cuantos: () => cuantos };
}

async function ponerLaVisibilidad(page: Page, estado: 'visible' | 'hidden'): Promise<void> {
  await page.evaluate((valor) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => valor });
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => valor === 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
  }, estado);
}

async function abrirInicio(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Inicio' })).toBeVisible(CARGA);
  await expect(page.getByRole('status').filter({ hasText: /Trayendo los datos/ })).toHaveCount(
    0,
    CARGA,
  );
}

async function encuestaLista(): Promise<string> {
  const clienteId = await crearCliente(sesion, 'Marcela Duarte', { telefono: '11 5523 4410' });
  const id = crypto.randomUUID();
  await guardarProyectoPorRpc(sesion, {
    proyecto: {
      id,
      version: null,
      cliente_id: clienteId,
      titulo: 'Placard 3 puertas',
      estado: 'entregado',
      presupuesto_centavos: 100_000_000,
      comprobante: 'sin_comprobante',
    },
    pagos: [],
    gastos: [],
  });
  const token = `e2e-${crypto.randomUUID().replaceAll('-', '')}`;
  await encuestaPorRest(sesion, id, token);
  return token;
}

async function contestar(token: string): Promise<void> {
  const encuesta = (await encuestaComoCliente(sesion, token)) as {
    preguntas: { id: string; tipo: string }[];
  };
  expect(
    await contestarComoCliente(sesion, token, {
      id: crypto.randomUUID(),
      renglones: encuesta.preguntas.map((pregunta) => ({
        pregunta: pregunta.id,
        valor: pregunta.tipo === 'texto' ? 'Impecable' : pregunta.tipo === 'sitalvezno' ? 3 : 5,
      })),
    }),
  ).toEqual({ estado: 'guardada' });
}

function laOpinion(page: Page) {
  return page.getByRole('link', { name: /Marcela Duarte opinó de su placard/ });
}

interface Respuesta {
  status: string;
  response: unknown;
}

function unirseAlCanal(
  entorno: EntornoDePrueba,
  tema: string,
  accessToken: string | null,
): Promise<Respuesta> {
  const url = `${entorno.url.replace(/^http/, 'ws')}/realtime/v1/websocket?apikey=${entorno.publishableKey}&vsn=1.0.0`;
  return new Promise((resolver, fallar) => {
    const socket = new WebSocket(url);
    const reloj = setTimeout(() => {
      socket.close();
      fallar(new Error(`El canal ${tema} no contestó.`));
    }, 15_000);
    socket.addEventListener('open', () => {
      socket.send(
        JSON.stringify({
          topic: `realtime:${tema}`,
          event: 'phx_join',
          payload: {
            config: {
              broadcast: { ack: false, self: false },
              presence: { key: '' },
              postgres_changes: [],
              private: true,
            },
            ...(accessToken === null ? {} : { access_token: accessToken }),
          },
          ref: '1',
          join_ref: '1',
        }),
      );
    });
    socket.addEventListener('message', (evento) => {
      const mensaje = JSON.parse(String(evento.data)) as {
        event: string;
        ref: string | null;
        payload: Respuesta;
      };
      if (mensaje.event !== 'phx_reply' || mensaje.ref !== '1') return;
      clearTimeout(reloj);
      socket.close();
      resolver(mensaje.payload);
    });
    socket.addEventListener('error', () => {
      clearTimeout(reloj);
      fallar(new Error(`No se pudo abrir el socket de ${tema}.`));
    });
  });
}

test('el dueño se suscribe al canal de su taller; anon y el canal de otro taller no', async ({
  isMobile,
}) => {
  test.skip(isMobile, 'habla con Realtime directo, sin pantalla: corre una vez');
  const tema = `cambios:${await householdDePrueba(sesion)}`;

  const delDuenio = await unirseAlCanal(sesion.entorno, tema, sesion.accessToken);
  const deAnon = await unirseAlCanal(sesion.entorno, tema, null);
  const deOtroTaller = await unirseAlCanal(
    sesion.entorno,
    `cambios:${crypto.randomUUID()}`,
    sesion.accessToken,
  );

  console.log(JSON.stringify({ delDuenio, deAnon, deOtroTaller }));
  expect(delDuenio.status).toBe('ok');
  expect(deAnon.status).toBe('error');
  expect(deOtroTaller.status).toBe('error');
});

test('escucha solo mientras está a la vista: oculta deja el canal y al volver se une y trae el delta', async ({
  page,
}) => {
  const frames = anotarLosFrames(page);
  const deltas = anotarLosDeltas(page);
  await abrirInicio(page);
  await expect.poll(() => contar(frames, 'entra', UNIDO), CARGA).toBe(1);

  await ponerLaVisibilidad(page, 'hidden');
  await expect.poll(() => contar(frames, 'sale', /realtime:cambios:.*phx_leave/), SOLA).toBe(1);

  const antes = deltas.cuantos();
  await ponerLaVisibilidad(page, 'visible');
  await expect.poll(() => contar(frames, 'sale', /realtime:cambios:.*phx_join/), SOLA).toBe(2);
  await expect.poll(() => deltas.cuantos(), SOLA).toBeGreaterThan(antes);
});

test('sin el canal de avisos la app anda igual, y volver a ella trae lo nuevo', async ({
  page,
}) => {
  let intentos = 0;
  await page.routeWebSocket(CANAL, (socket) => {
    intentos += 1;
    void socket.close();
  });
  const token = await encuestaLista();
  await abrirInicio(page);
  expect(intentos).toBeGreaterThan(0);

  await ponerLaVisibilidad(page, 'hidden');
  await contestar(token);
  await ponerLaVisibilidad(page, 'visible');

  await expect(laOpinion(page)).toBeVisible(SOLA);
});

test.describe('con una sesión propia, que renovar no le cambie la suya a los demás tests', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('el canal sigue autorizado después de renovar el token', async ({ page, context }) => {
    test.setTimeout(120_000);
    await entrarConLaSesion(context, sesion);
    const frames = anotarLosFrames(page);
    const token = await encuestaLista();
    await abrirInicio(page);
    await expect.poll(() => contar(frames, 'entra', UNIDO), CARGA).toBe(1);

    const anterior = await page.evaluate(() => {
      const guardada = localStorage.getItem('maun.sesion') ?? '{}';
      const sesionGuardada = JSON.parse(guardada) as { access_token: string; expires_at: number };
      localStorage.setItem(
        'maun.sesion',
        JSON.stringify({ ...sesionGuardada, expires_at: Math.floor(Date.now() / 1000) + 60 }),
      );
      return sesionGuardada.access_token;
    });

    await expect
      .poll(
        () =>
          frames.filter(
            (frame) =>
              frame.sentido === 'sale' &&
              /realtime:cambios:.*"access_token"/.test(frame.texto) &&
              !frame.texto.includes(anterior),
          ).length,
        { timeout: 45_000 },
      )
      .toBeGreaterThan(0);
    await page.waitForTimeout(1_000);
    expect(contar(frames, 'entra', /"status":"error"|phx_error|phx_close/)).toBe(0);

    await contestar(token);
    await expect(laOpinion(page)).toBeVisible(SOLA);
    expect(contar(frames, 'entra', /realtime:cambios:[^"]*cambios\{/)).toBeGreaterThan(0);
  });
});

test('dos sesiones abiertas: lo que se anota en una aparece solo en la otra', async ({
  page,
  browser,
}, info) => {
  test.skip(info.project.name !== 'escritorio', 'las dos sesiones van en la compu');
  const otra = await browser.newContext({
    baseURL: info.project.use.baseURL,
    storageState: ESTADO_DE_SESION,
  });
  const otraPagina = await otra.newPage();
  try {
    await otraPagina.goto('/agenda');
    await expect(otraPagina.getByRole('heading', { level: 1, name: 'Agenda' })).toBeVisible(CARGA);
    await page.goto('/agenda');
    await expect(page.getByRole('heading', { level: 1, name: 'Agenda' })).toBeVisible(CARGA);

    await page.getByRole('button', { name: 'Anotar algo', exact: true }).click();
    const hoja = page.getByRole('dialog', { name: 'Anotar algo' });
    await hoja.getByLabel('Qué hay que hacer').fill('E2E Llegó sola a la otra sesión');
    await hoja.getByRole('radio', { name: /Taller/ }).click();
    await hoja.getByRole('button', { name: 'Anotarlo' }).click();
    await expect(hoja).toBeHidden();

    await expect(otraPagina.getByText('E2E Llegó sola a la otra sesión').first()).toBeVisible(SOLA);
  } finally {
    await otra.close();
  }
});
