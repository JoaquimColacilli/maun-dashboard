import assert from 'node:assert/strict';

import type { PreferenciasDeAvisos } from '@maun/domain';
import webpush from 'web-push';

import { baseDeSupabase, type AvisoPorMandar, type Base, type Suscripcion } from './base.ts';
import { configuracionDelEntorno } from './entorno.ts';
import { laSuscripcionMurio, mandarLaPrueba, mandarLosAvisos, type Enviador } from './envio.ts';
import { crearManejador } from './manejador.ts';
import { cargaDelAviso } from './texto.ts';

const DIA = '2026-09-14';
const VAPID = {
  publica: 'la-publica',
  privada: 'la-privada',
  sujeto: 'https://maun-dashboard.netlify.app',
};

const PREFERENCIAS: PreferenciasDeAvisos = {
  entregas: { activo: true, anticipacion: 2 },
  visitas: { activo: true, anticipacion: 1 },
  presupuestos: { activo: true, anticipacion: 1 },
  anotaciones: { activo: false, anticipacion: 0 },
};

interface Registro {
  anotados: [string, string, boolean][];
  borrados: string[];
}

function baseFalsa(
  avisos: AvisoPorMandar[] = [],
  suscripciones: Suscripcion[] = [],
): Base & { registro: Registro } {
  const registro: Registro = { anotados: [], borrados: [] };
  return {
    registro,
    avisosPorMandar: () => Promise.resolve(avisos),
    anotarAviso: (id, dia, mandado) => {
      registro.anotados.push([id, dia, mandado]);
      return Promise.resolve();
    },
    borrarSuscripcionVencida: (endpoint) => {
      registro.borrados.push(endpoint);
      return Promise.resolve();
    },
    suscripcionesParaProbar: () => Promise.resolve(suscripciones),
    usuarioDelToken: (token) => Promise.resolve(token === 'sesion-valida' ? 'u1' : null),
  };
}

function suscripcion(id: string): Suscripcion {
  return { id, endpoint: `https://push.example/${id}`, p256dh: 'p', auth: 'a' };
}

function aviso(id: string, entrega: string | null): AvisoPorMandar {
  return {
    ...suscripcion(id),
    dia: DIA,
    preferencias: PREFERENCIAS,
    filas: {
      proyectos:
        entrega === null
          ? []
          : [
              {
                id: `p-${id}`,
                cliente_id: 'c1',
                titulo: 'Cocina de Villalba',
                estado: 'en_curso',
                fecha_visita: null,
                entrega_estimada: entrega,
                vencimiento_presupuesto: null,
                direccion_entrega: 'Sarmiento 2310',
              } as never,
            ],
      clientes: [{ id: 'c1', nombre: 'Villalba', zona: 'Morón' } as never],
      anotaciones: [],
    },
  };
}

function enviadorQueContesta(respuestas: Record<string, number>): Enviador & { cargas: string[] } {
  const cargas: string[] = [];
  const enviar: Enviador = (destino, carga) => {
    cargas.push(carga);
    const estado = respuestas[destino.id];
    if (estado === undefined) return Promise.resolve();
    return Promise.reject(
      Object.assign(new Error(`contestó ${String(estado)}`), { statusCode: estado }),
    );
  };
  return Object.assign(enviar, { cargas });
}

function manejador(
  valores: Record<string, string>,
  base: Base = baseFalsa(),
  enviar: Enviador = enviadorQueContesta({}),
) {
  return crearManejador({
    configuracion: configuracionDelEntorno({ get: (nombre) => valores[nombre] }),
    base,
    enviar,
    ahora: () => new Date('2026-09-14T10:40:00Z'),
  });
}

const CON_CLAVES = {
  VAPID_PUBLIC_KEY: 'la-publica',
  VAPID_PRIVATE_KEY: 'la-privada',
  VAPID_SUBJECT: 'https://maun-dashboard.netlify.app',
  AVISOS_SECRETO: 'el-secreto',
};

Deno.test(
  'un 410 o un 404 borran la suscripción; un 500 no la toca y no marca el día',
  async () => {
    const base = baseFalsa();
    const enviar = enviadorQueContesta({ muerta: 410, desconocida: 404, caida: 500 });

    const resultado = await mandarLosAvisos(
      [aviso('muerta', DIA), aviso('desconocida', DIA), aviso('caida', DIA), aviso('viva', DIA)],
      base,
      enviar,
      VAPID,
    );

    assert.deepEqual(resultado, { mandados: 1, sinNadaQueAvisar: 0, podados: 2, fallidos: 1 });
    assert.deepEqual(base.registro.borrados, [
      'https://push.example/muerta',
      'https://push.example/desconocida',
    ]);
    assert.deepEqual(base.registro.anotados, [['viva', DIA, true]]);
  },
);

Deno.test('sin nada que avisar no manda, pero marca el día para no volver a mirar', async () => {
  const base = baseFalsa();
  const enviar = enviadorQueContesta({});

  const resultado = await mandarLosAvisos(
    [aviso('lejos', '2026-10-20'), aviso('nada', null)],
    base,
    enviar,
    VAPID,
  );

  assert.deepEqual(resultado, { mandados: 0, sinNadaQueAvisar: 2, podados: 0, fallidos: 0 });
  assert.equal(enviar.cargas.length, 0);
  assert.deepEqual(base.registro.anotados, [
    ['lejos', DIA, false],
    ['nada', DIA, false],
  ]);
});

Deno.test(
  'la selección es la de la agenda: una entrega dentro de la anticipación se avisa',
  async () => {
    const enviar = enviadorQueContesta({});
    await mandarLosAvisos([aviso('viva', '2026-09-16')], baseFalsa(), enviar, VAPID);

    assert.deepEqual(JSON.parse(enviar.cargas[0] ?? '{}'), {
      titulo: 'Lo que viene en la agenda',
      cuerpo: 'Entregar: Cocina de Villalba (en 2 días)',
      url: '/agenda',
      etiqueta: `agenda-${DIA}`,
    });
  },
);

Deno.test(
  'lo hecho no se avisa: la visita de hoy que ya se relevó no sale, y la misma sin relevar sí',
  async () => {
    const visita = (id: string, hecha: boolean): AvisoPorMandar => ({
      ...aviso(id, null),
      filas: {
        proyectos: [
          {
            id: `p-${id}`,
            cliente_id: 'c1',
            titulo: 'Relevamiento UTN',
            estado: 'a_presupuestar',
            fecha_visita: DIA,
            visita_hecha: hecha,
            entrega_estimada: null,
            vencimiento_presupuesto: null,
            direccion_entrega: '',
          } as never,
        ],
        clientes: [{ id: 'c1', nombre: 'UTN', zona: 'Haedo' } as never],
        anotaciones: [],
      },
    });
    const base = baseFalsa();
    const enviar = enviadorQueContesta({});

    const resultado = await mandarLosAvisos(
      [visita('relevada', true), visita('pendiente', false)],
      base,
      enviar,
      VAPID,
    );

    assert.deepEqual(resultado, { mandados: 1, sinNadaQueAvisar: 1, podados: 0, fallidos: 0 });
    assert.deepEqual(base.registro.anotados, [
      ['relevada', DIA, false],
      ['pendiente', DIA, true],
    ]);
    assert.equal(
      JSON.parse(enviar.cargas[0] ?? '{}').cuerpo,
      'Relevamiento: Relevamiento UTN (hoy)',
    );
  },
);

Deno.test('el texto dice lo de hoy primero y resume lo que no entra', () => {
  const eventos = [
    {
      clase: 'derivada',
      id: 'e',
      categoria: 'entrega',
      fecha: DIA,
      proyectoId: 'p',
      clienteId: 'c',
      titulo: 'Placard',
      cliente: '',
      lugar: '',
      hecha: false,
      importante: false,
    },
    {
      clase: 'propia',
      id: 'n1',
      categoria: 'taller',
      fecha: DIA,
      hora: null,
      texto: 'Retirar el pulpo',
      proyectoId: null,
      proyecto: null,
      hecha: false,
      importante: false,
    },
    {
      clase: 'derivada',
      id: 'v',
      categoria: 'visita',
      fecha: '2026-09-15',
      proyectoId: 'p',
      clienteId: 'c',
      titulo: 'UTN',
      cliente: '',
      lugar: '',
      hecha: false,
      importante: false,
    },
    {
      clase: 'derivada',
      id: 'pr',
      categoria: 'presupuesto',
      fecha: '2026-09-15',
      proyectoId: 'p',
      clienteId: 'c',
      titulo: 'Vestidor',
      cliente: '',
      lugar: '',
      hecha: false,
      importante: false,
    },
    {
      clase: 'propia',
      id: 'n2',
      categoria: 'materiales',
      fecha: '2026-09-16',
      hora: null,
      texto: 'Comprar melamina',
      proyectoId: null,
      proyecto: null,
      hecha: false,
      importante: false,
    },
  ] as const;

  const carga = cargaDelAviso(eventos, DIA);

  assert.equal(carga.titulo, 'Hoy tenés 2 cosas en la agenda');
  assert.equal(
    carga.cuerpo,
    [
      'Entregar: Placard (hoy)',
      'Retirar el pulpo (hoy)',
      'Relevamiento: UTN (mañana)',
      'Entregar presupuesto: Vestidor (mañana)',
      'y 1 más en la agenda',
    ].join('\n'),
  );
});

Deno.test('probar manda a los dispositivos del usuario y poda los que murieron', async () => {
  const base = baseFalsa();
  const resultado = await mandarLaPrueba(
    [suscripcion('telefono'), suscripcion('vieja')],
    base,
    enviadorQueContesta({ vieja: 410 }),
    VAPID,
  );

  assert.deepEqual(resultado, { mandados: 1, sinNadaQueAvisar: 0, podados: 1, fallidos: 0 });
  assert.deepEqual(base.registro.borrados, ['https://push.example/vieja']);
});

Deno.test(
  'sin claves VAPID el servidor dice que no puede mandar, y el trabajo no hace nada',
  async () => {
    const sinClaves = manejador({ AVISOS_SECRETO: 'el-secreto' });

    const estado = await sinClaves(new Request('https://f.example/avisos'));
    assert.equal(estado.status, 200);
    assert.deepEqual(await estado.json(), { configurado: false, clavePublica: null });

    const trabajo = await sinClaves(
      new Request('https://f.example/avisos', {
        method: 'POST',
        headers: { Authorization: 'Bearer el-secreto' },
      }),
    );
    assert.deepEqual(await trabajo.json(), { configurado: false, mandados: 0 });
  },
);

Deno.test('con claves dice que puede, y comparte solo la pública', async () => {
  const respuesta = await manejador(CON_CLAVES)(new Request('https://f.example/avisos'));
  const cuerpo = await respuesta.text();

  assert.deepEqual(JSON.parse(cuerpo), { configurado: true, clavePublica: 'la-publica' });
  assert.equal(cuerpo.includes('la-privada'), false);
  assert.equal(respuesta.headers.get('Access-Control-Allow-Origin'), '*');
});

Deno.test('el trabajo programado sin el secreto no pasa, y con el secreto manda', async () => {
  const base = baseFalsa([aviso('viva', DIA)]);
  const atender = manejador(CON_CLAVES, base);

  for (const autorizacion of [undefined, 'Bearer otro-secreto', 'Bearer el-secret']) {
    const respuesta = await atender(
      new Request('https://f.example/avisos', {
        method: 'POST',
        headers: autorizacion === undefined ? {} : { Authorization: autorizacion },
      }),
    );
    assert.equal(respuesta.status, 401);
  }
  assert.deepEqual(base.registro.anotados, []);

  const conSecreto = await atender(
    new Request('https://f.example/avisos', {
      method: 'POST',
      headers: { Authorization: 'Bearer el-secreto' },
    }),
  );
  assert.deepEqual(await conSecreto.json(), {
    configurado: true,
    mandados: 1,
    sinNadaQueAvisar: 0,
    podados: 0,
    fallidos: 0,
  });
});

Deno.test('probar necesita una sesión válida', async () => {
  const atender = manejador(CON_CLAVES, baseFalsa([], [suscripcion('telefono')]));

  const sinSesion = await atender(
    new Request('https://f.example/avisos/probar', { method: 'POST' }),
  );
  assert.equal(sinSesion.status, 401);

  const conSesion = await atender(
    new Request('https://f.example/avisos/probar', {
      method: 'POST',
      headers: { Authorization: 'Bearer sesion-valida' },
      body: JSON.stringify({ endpoint: 'https://push.example/telefono' }),
    }),
  );
  assert.equal(conSesion.status, 200);
  assert.equal(((await conSesion.json()) as { mandados: number }).mandados, 1);
});

Deno.test(
  'la base llama a las funciones con la clave del servidor, sin exponerla en otro lado',
  async () => {
    const pedidos: { url: string; init: RequestInit }[] = [];
    const base = baseDeSupabase('https://ref.supabase.co', 'sb_secret_abc', (url, init) => {
      pedidos.push({ url, init });
      return Promise.resolve(new Response('true', { status: 200 }));
    });

    await base.borrarSuscripcionVencida('https://push.example/muerta');

    assert.equal(pedidos[0]?.url, 'https://ref.supabase.co/rest/v1/rpc/borrar_suscripcion_vencida');
    assert.deepEqual(pedidos[0]?.init.headers, {
      apikey: 'sb_secret_abc',
      'Content-Type': 'application/json',
    });
    assert.equal(
      pedidos[0]?.init.body,
      JSON.stringify({ p_endpoint: 'https://push.example/muerta' }),
    );
  },
);

Deno.test(
  'la clave del servidor sale de la heredada o de las nuevas, y sin claves queda vacía',
  () => {
    assert.equal(
      configuracionDelEntorno({ get: (n) => ({ SUPABASE_SERVICE_ROLE_KEY: 'eyJ.x' })[n] })
        .claveDelServidor,
      'eyJ.x',
    );
    assert.equal(
      configuracionDelEntorno({
        get: (n) => ({ SUPABASE_SECRET_KEYS: '{"default":"sb_secret_1"}' })[n],
      }).claveDelServidor,
      'sb_secret_1',
    );
    assert.equal(configuracionDelEntorno({ get: () => undefined }).claveDelServidor, '');
  },
);

Deno.test(
  'web-push importa en Deno, cifra un aviso para una suscripción real y su error trae el estado',
  async () => {
    const b64url = (bytes: Uint8Array) =>
      btoa(String.fromCharCode(...bytes))
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replaceAll('=', '');
    const par = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
      'deriveBits',
    ]);
    const publica = new Uint8Array(await crypto.subtle.exportKey('raw', par.publicKey));
    const vapid = webpush.generateVAPIDKeys();

    const detalles = webpush.generateRequestDetails(
      {
        endpoint: 'https://fcm.googleapis.com/fcm/send/prueba',
        keys: { p256dh: b64url(publica), auth: b64url(crypto.getRandomValues(new Uint8Array(16))) },
      },
      JSON.stringify({ titulo: 'Hola' }),
      {
        vapidDetails: {
          subject: 'https://maun-dashboard.netlify.app',
          publicKey: vapid.publicKey,
          privateKey: vapid.privateKey,
        },
        TTL: 60,
      },
    );

    assert.equal(detalles.method, 'POST');
    assert.equal(detalles.headers['Content-Encoding'], 'aes128gcm');
    assert.match(String(detalles.headers.Authorization), /^vapid t=.+, k=.+$/);
    assert.ok((detalles.body?.length ?? 0) > 0);
    assert.equal(laSuscripcionMurio(new webpush.WebPushError('Gone', 410, {}, '', 'x')), true);
    assert.equal(laSuscripcionMurio(new webpush.WebPushError('Error', 500, {}, '', 'x')), false);
  },
);
