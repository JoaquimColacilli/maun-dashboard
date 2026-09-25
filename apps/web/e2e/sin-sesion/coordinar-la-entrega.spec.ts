import { expect, test, type Page } from '@playwright/test';

import {
  cambiosDeFechaDe,
  diaHabilDesdeHoy,
  entregaDe,
  iniciarSesionDePrueba,
  proponerPorRpc,
  propuestasDe,
  respuestasDeEntregaDe,
  trabajoListoConEnlace,
  vaciarTaller,
  type SesionDePrueba,
  type TrabajoListo,
} from '../apoyo/taller';

const CARGA = { timeout: 30_000 };

const TEMAS = ['light', 'dark'] as const;

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

let sesion: SesionDePrueba;

async function sinMovimiento(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((animacion) => animacion.finished)),
  );
}

test.beforeEach(async () => {
  sesion = await iniciarSesionDePrueba();
  await vaciarTaller(sesion);
});

function paraLeer(fecha: string): string {
  const dia = new Date(`${fecha}T12:00:00Z`);
  return `${DIAS[dia.getUTCDay()] ?? ''} ${String(dia.getUTCDate())} de ${MESES[dia.getUTCMonth()] ?? ''}`;
}

function seccion(page: Page) {
  return page.getByRole('region', { name: 'Coordinemos la entrega' });
}

async function abrir(page: Page, trabajo: TrabajoListo, tema: 'light' | 'dark' = 'light') {
  await page.emulateMedia({ colorScheme: tema });
  await page.goto(`/v/${trabajo.token}`);
  await expect(page.getByRole('region', { name: 'Tu mueble' })).toBeVisible(CARGA);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

async function unDiaPropuesto(trabajo: TrabajoListo, fecha: string) {
  await proponerPorRpc(sesion, trabajo.id, {
    id: crypto.randomUUID(),
    forma: 'un_dia',
    fecha,
    franja: 'manana',
  });
}

async function susDiasPedidos(trabajo: TrabajoListo) {
  await proponerPorRpc(sesion, trabajo.id, {
    id: crypto.randomUUID(),
    forma: 'sus_dias',
    fecha: null,
    franja: null,
  });
}

async function nadaGuardadoEnElNavegador(page: Page, textos: readonly string[]): Promise<void> {
  const guardado = await page.evaluate(async () => {
    const bases = 'databases' in indexedDB ? await indexedDB.databases() : [];
    const todo = (almacen: Storage) =>
      JSON.stringify(
        Array.from({ length: almacen.length }, (_, indice) => {
          const clave = almacen.key(indice) ?? '';
          return [clave, almacen.getItem(clave)];
        }),
      );
    return {
      local: todo(localStorage),
      sesion: todo(sessionStorage),
      bases: bases.map((base) => base.name ?? ''),
    };
  });
  for (const texto of textos) {
    expect(guardado.local, `«${texto}» no queda en localStorage`).not.toContain(texto);
    expect(guardado.sesion, `«${texto}» no queda en sessionStorage`).not.toContain(texto);
  }
  console.log(`lo que hay en el navegador: ${JSON.stringify(guardado)}`);
}

test('el día propuesto: lo acepta con un botón y la entrega queda comprometida', async ({
  page,
}, testInfo) => {
  const trabajo = await trabajoListoConEnlace(sesion, {
    titulo: 'Placard de pasillo',
    cliente: 'Cintia Paz',
  });
  const dia = diaHabilDesdeHoy(8);
  await unDiaPropuesto(trabajo, dia);

  for (const tema of TEMAS) {
    await abrir(page, trabajo, tema);
    await expect(page.getByRole('region', { name: 'Tu mueble' })).toContainText(
      'Tu mueble está listo',
    );
    await expect(seccion(page)).toContainText('Te proponemos este día:');
    await sinMovimiento(page);
    await page.screenshot({
      path: testInfo.outputPath(`listo-un-dia-${tema}-${testInfo.project.name}.png`),
      fullPage: true,
    });
  }

  const pedidos: string[] = [];
  page.on('request', (pedido) => {
    if (pedido.url().includes('responder_la_entrega')) pedidos.push(pedido.method());
  });
  await seccion(page).getByRole('button', { name: 'Me queda bien' }).click();
  await expect(page.getByRole('region', { name: 'Tu mueble' })).toContainText(
    /¡Buenas noticias! Lo estamos entregando el \S+ \d{1,2} \S+, a la mañana\./,
    CARGA,
  );
  await expect(seccion(page)).toHaveCount(0);
  await expect(page.getByText(/^Listo: te esperamos el/)).toBeVisible();
  expect(pedidos).toEqual(['POST']);

  const entrega = await entregaDe(sesion, trabajo.id);
  expect(entrega?.entrega_comprometida).toBe(dia);
  expect(entrega?.entrega_comprometida_franja).toBe('manana');
  const historia = await cambiosDeFechaDe(sesion, trabajo.id);
  expect(historia.at(-1)).toMatchObject({ tipo: 'comprometida', fecha: dia, origen: 'cliente' });
  expect((await propuestasDe(sesion, trabajo.id)).every((una) => una.cerrada_at !== null)).toBe(
    true,
  );

  for (const tema of TEMAS) {
    await abrir(page, trabajo, tema);
    await sinMovimiento(page);
    await page.screenshot({
      path: testInfo.outputPath(`comprometida-${tema}-${testInfo.project.name}.png`),
      fullPage: true,
    });
  }
  await nadaGuardadoEnElNavegador(page, [dia, trabajo.token]);
});

test('sus días: marca días y horarios en el calendario, deja una nota y el taller los recibe', async ({
  page,
}, testInfo) => {
  const trabajo = await trabajoListoConEnlace(sesion, {
    titulo: 'Vestidor en L',
    cliente: 'Hernán Cabrera',
  });
  await susDiasPedidos(trabajo);
  const primero = diaHabilDesdeHoy(3);
  const segundo = diaHabilDesdeHoy(9);
  const nota = 'Tercer piso, sin ascensor. Portero hasta las 18.';

  await abrir(page, trabajo);
  await expect(seccion(page)).toContainText('marcá los días que te quedan bien');
  for (const tema of TEMAS) {
    await page.emulateMedia({ colorScheme: tema });
    await sinMovimiento(page);
    await page.screenshot({
      path: testInfo.outputPath(`listo-sus-dias-abierto-${tema}-${testInfo.project.name}.png`),
      fullPage: true,
    });
  }

  await seccion(page)
    .getByRole('button', { name: paraLeer(segundo), exact: true })
    .click();
  await seccion(page)
    .getByRole('button', { name: paraLeer(primero), exact: true })
    .click();
  await expect(
    seccion(page).getByRole('button', { name: paraLeer(primero), exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  const horario = seccion(page).getByRole('group', { name: `Horario del ${paraLeer(segundo)}` });
  await horario.getByRole('button', { name: 'A la mañana' }).click();
  await expect(horario.getByRole('button', { name: 'A la mañana' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await seccion(page).getByLabel('¿Algo que tengamos que saber?').fill(nota);
  await seccion(page).getByRole('button', { name: 'Mandar mis días' }).click();

  await expect(
    page.getByText('Listo: le pasamos tus días al taller. Te va a confirmar uno.'),
  ).toBeVisible(CARGA);
  await expect(seccion(page)).toContainText(
    'Nos pasaste estos días. Vamos a elegir uno y te lo confirmamos en esta página.',
  );
  await expect(seccion(page)).toContainText(nota);
  await expect(seccion(page).getByRole('button', { name: 'Mandar mis días' })).toHaveCount(0);

  const [respuesta] = await respuestasDeEntregaDe(sesion, trabajo.id);
  expect(respuesta).toMatchObject({
    respuesta: 'mis_dias',
    dias: [
      { fecha: primero, franjas: ['manana', 'tarde'] },
      { fecha: segundo, franjas: ['tarde'] },
    ],
    nota,
  });

  for (const tema of TEMAS) {
    await page.emulateMedia({ colorScheme: tema });
    await sinMovimiento(page);
    await page.screenshot({
      path: testInfo.outputPath(`listo-sus-dias-mandados-${tema}-${testInfo.project.name}.png`),
      fullPage: true,
    });
  }
  await nadaGuardadoEnElNavegador(page, [primero, segundo, nota]);
});

test('sin señal no se pierde lo marcado, y al volver se manda una sola vez', async ({
  page,
  context,
}) => {
  const trabajo = await trabajoListoConEnlace(sesion, {
    titulo: 'Rack de living',
    cliente: 'Graciela Ruiz',
  });
  await susDiasPedidos(trabajo);
  const dia = diaHabilDesdeHoy(4);

  await abrir(page, trabajo);
  await seccion(page)
    .getByRole('button', { name: paraLeer(dia), exact: true })
    .click();
  await context.setOffline(true);
  await seccion(page).getByRole('button', { name: 'Mandar mis días' }).click();
  await expect(seccion(page).getByRole('alert')).toHaveText(
    'No se pudo mandar: se cortó la conexión. Lo que marcaste sigue acá; probá de nuevo cuando vuelva la señal.',
    CARGA,
  );
  await expect(
    seccion(page).getByRole('button', { name: paraLeer(dia), exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');

  await context.setOffline(false);
  await seccion(page).getByRole('button', { name: 'Mandar mis días' }).click();
  await expect(seccion(page)).toContainText('Nos pasaste estos días', CARGA);
  expect(await respuestasDeEntregaDe(sesion, trabajo.id)).toHaveLength(1);
});

test('cambiar sus días y volver a mandar los mismos cierra el calendario otra vez', async ({
  page,
}) => {
  const trabajo = await trabajoListoConEnlace(sesion, {
    titulo: 'Mesa de luz',
    cliente: 'Ramiro Sosa',
  });
  await susDiasPedidos(trabajo);
  const dia = diaHabilDesdeHoy(6);

  await abrir(page, trabajo);
  await seccion(page)
    .getByRole('button', { name: paraLeer(dia), exact: true })
    .click();
  await seccion(page).getByRole('button', { name: 'Mandar mis días' }).click();
  await expect(seccion(page)).toContainText('Nos pasaste estos días', CARGA);

  await seccion(page).getByRole('button', { name: 'Cambiar mis días' }).click();
  await seccion(page).getByRole('button', { name: 'Mandar mis días' }).click();
  await expect(seccion(page).getByRole('button', { name: 'Cambiar mis días' })).toBeVisible(CARGA);
  await expect(seccion(page).getByRole('button', { name: 'Mandar mis días' })).toHaveCount(0);
  await expect(
    seccion(page).getByRole('heading', { name: 'Coordinemos la entrega' }),
  ).toBeFocused();

  await seccion(page).getByRole('button', { name: 'Cambiar mis días' }).click();
  await seccion(page).getByRole('button', { name: 'Dejarlos como estaban' }).click();
  await expect(seccion(page)).toContainText('Nos pasaste estos días');

  const respuestas = await respuestasDeEntregaDe(sesion, trabajo.id);
  expect(respuestas).toHaveLength(2);
  expect(new Set(respuestas.map((una) => una.id)).size).toBe(2);
});

test('si el taller cambió el pedido mientras elegía, se lo dice y le muestra lo nuevo', async ({
  page,
}) => {
  const trabajo = await trabajoListoConEnlace(sesion, {
    titulo: 'Biblioteca',
    cliente: 'Marcela Duarte',
  });
  await susDiasPedidos(trabajo);
  const nuevo = diaHabilDesdeHoy(12);

  await abrir(page, trabajo);
  await seccion(page)
    .getByRole('button', { name: paraLeer(diaHabilDesdeHoy(5)) })
    .click();
  await unDiaPropuesto(trabajo, nuevo);
  await seccion(page).getByRole('button', { name: 'Mandar mis días' }).click();

  await expect(
    page.getByText(
      'Mientras elegías, el taller cambió lo que te pidió. Ya está al día: fijate lo nuevo.',
    ),
  ).toBeVisible(CARGA);
  await expect(seccion(page)).toContainText('Te proponemos este día:');
  expect(await respuestasDeEntregaDe(sesion, trabajo.id)).toHaveLength(0);
});

test('con el teclado solo: recorre los días, los marca con la barra y manda', async ({
  page,
}, testInfo) => {
  const trabajo = await trabajoListoConEnlace(sesion, {
    titulo: 'Escritorio',
    cliente: 'Lucía Ferreyra',
  });
  await susDiasPedidos(trabajo);
  await abrir(page, trabajo);

  const primerDia = seccion(page).getByRole('button', { pressed: false }).first();
  const nombre = (await primerDia.getAttribute('aria-label')) ?? '';
  await primerDia.focus();
  await page.keyboard.press('Space');
  await expect(seccion(page).getByRole('button', { name: nombre, exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.keyboard.press('Tab');
  await page.keyboard.press('Space');

  const recorrido: string[] = [];
  for (let paso = 0; paso < 40; paso += 1) {
    await page.keyboard.press('Tab');
    const foco = await page.evaluate(() => {
      const activo = document.activeElement;
      if (!activo || activo === document.body) return '';
      const nombreDelFoco =
        activo.getAttribute('aria-label') ??
        (activo.tagName === 'TEXTAREA' ? 'nota' : activo.textContent.trim());
      const pulsado = activo.getAttribute('aria-pressed');
      return `${activo.tagName.toLowerCase()}: ${nombreDelFoco}${pulsado === null ? '' : ` (${pulsado === 'true' ? 'marcado' : 'sin marcar'})`}`;
    });
    recorrido.push(foco);
    if (foco.startsWith('textarea')) break;
  }
  console.log(`\n=== ${testInfo.project.name}: recorrido con Tab ===\n${recorrido.join('\n')}`);
  expect(recorrido).toContain('button: A la mañana (marcado)');
  expect(recorrido.at(-1)).toBe('textarea: nota');

  await page.keyboard.type('Cualquier tarde');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(seccion(page)).toContainText('Nos pasaste estos días', CARGA);

  console.log(
    `\n=== ${testInfo.project.name}: árbol de la sección ===\n${await seccion(page).ariaSnapshot()}`,
  );
  const [respuesta] = await respuestasDeEntregaDe(sesion, trabajo.id);
  expect(respuesta?.dias).toHaveLength(2);
  expect(respuesta?.nota).toBe('Cualquier tarde');
});
