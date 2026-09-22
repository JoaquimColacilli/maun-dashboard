import {
  anotacionesPorRest,
  archivoPorRest,
  clientesPorRest,
  cobrarPorRpc,
  contestarComoCliente,
  encuestaComoCliente,
  encuestaPorRest,
  enlacePorRest,
  escribirAjustes,
  formasDeCobroPorRest,
  guardarProyectoPorRpc,
  movimientosPorRest,
  vaciarTaller,
  type AjustesDePrueba,
  type SesionDePrueba,
} from '../apoyo/taller';

export interface TallerSembrado {
  obra: string;
  entregado: string;
  contacto: string;
  enviado: string;
  cliente: string;
  enlace: string;
  encuesta: string;
}

const SUELDO = 180_000_000;
const FIJOS = 60_000_000;

export const AJUSTES_COMPLETOS: Partial<AjustesDePrueba> = {
  sueldo_mensual_centavos: SUELDO,
  costos_fijos_centavos: FIJOS,
  meta_cocos_centavos: 2_500_000_000,
  tasa_cocos_anual_bp: 3_500,
  sena_bp: 5_000,
  cobro_alias: 'maun.muebles',
  cobro_cbu: '0000003100012345678907',
  cobro_titular: 'Ana Gutiérrez',
  cobro_cuit: '27-30123456-4',
  cobro_link: 'https://mpago.la/2vXyZ1',
  resena_link: 'https://g.page/r/maun-muebles/review',
};

const NOMBRES = [
  'Marcela Duarte',
  'Rubén Ocampo',
  'Laura Giménez',
  'Estudio Paredes',
  'Carlos Benítez',
  'Sofía Romero',
  'Hernán Quiroga',
  'Valeria Sosa',
  'Martín Aguirre',
  'Lucía Ferreyra',
  'Diego Molina',
  'Paula Castro',
  'Federico Luna',
  'Ana Villalba',
  'Jorge Medina',
  'Gabriela Ríos',
  'Pablo Herrera',
  'Carolina Díaz',
  'Nicolás Ortiz',
  'Florencia Vega',
  'Tomás Acosta',
  'Julieta Navarro',
  'Ignacio Cabrera',
  'Mariana Peralta',
  'Ezequiel Rojas',
  'Camila Suárez',
  'Andrés Domínguez',
  'Romina Toledo',
  'Gustavo Pereyra',
  'Natalia Correa',
];

const NOTAS_LARGAS = Array.from(
  { length: 14 },
  (_, indice) =>
    `${String(indice + 1)}. Medidas tomadas en obra: el vano mide 2,43 m de alto por 1,87 m de ancho, con el zócalo de 9 cm y un caño que baja por la esquina izquierda. Hablar con el cliente por la manija y por el color del canto.`,
).join('\n');

function dia(desplazamiento: number): string {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + desplazamiento);
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const numero = String(fecha.getDate()).padStart(2, '0');
  return `${String(fecha.getFullYear())}-${mes}-${numero}`;
}

function filas<T>(cantidad: number, crear: (indice: number) => T): T[] {
  return Array.from({ length: cantidad }, (_, indice) => crear(indice));
}

export function tokenDePrueba(): string {
  return `e2e-${crypto.randomUUID().replaceAll('-', '')}`;
}

async function obra(
  sesion: SesionDePrueba,
  datos: {
    cliente: string;
    titulo: string;
    estado: string;
    presupuesto: number | null;
    pagos: number;
    gastos: number;
    notas?: string;
    necesidades?: number;
    opciones?: number;
    visita?: string | null;
  },
): Promise<string> {
  const id = crypto.randomUUID();
  const tipos = ['material', 'herraje', 'herramienta'];
  await guardarProyectoPorRpc(sesion, {
    proyecto: {
      id,
      version: null,
      cliente_id: datos.cliente,
      titulo: datos.titulo,
      estado: datos.estado,
      presupuesto_centavos: datos.opciones ? null : datos.presupuesto,
      comprobante: 'sin_comprobante',
      direccion_entrega: 'Olazábal 1240, Ituzaingó',
      notas: datos.notas ?? '',
      fecha_inicio: datos.estado === 'en_curso' || datos.estado === 'entregado' ? dia(-40) : null,
      entrega_estimada: datos.estado === 'en_curso' ? dia(12) : null,
      fecha_visita: datos.visita ?? null,
    },
    pagos: filas(datos.pagos, (indice) => ({
      id: crypto.randomUUID(),
      fecha: dia(-60 + indice),
      concepto: indice === 0 ? 'Seña' : `Pago ${String(indice + 1)}`,
      monto_centavos: 1_500_000 + indice * 10_000,
    })),
    gastos: filas(datos.gastos, (indice) => ({
      id: crypto.randomUUID(),
      fecha: dia(-50 + indice),
      descripcion: `Placas de melamina y herrajes, compra ${String(indice + 1)}`,
      monto_centavos: 800_000 + indice * 5_000,
    })),
    opciones:
      datos.opciones === undefined
        ? undefined
        : filas(datos.opciones, (indice) => ({
            id: crypto.randomUUID(),
            descripcion: `Opción ${String(indice + 1)}: melamina con canto de ${String(indice + 1)} mm`,
            monto_centavos: 90_000_000 + indice * 15_000_000,
            aprobada: false,
          })),
    necesidades:
      datos.necesidades === undefined
        ? undefined
        : filas(datos.necesidades, (indice) => ({
            id: crypto.randomUUID(),
            tipo: tipos[indice % tipos.length] ?? 'material',
            nombre: `Ítem ${String(indice + 1)} para el trabajo`,
            cantidad: indice % 2 === 0 ? indice + 1 : null,
            listo: indice % 3 === 0,
          })),
  });
  return id;
}

async function cobrado(sesion: SesionDePrueba, cliente: string, indice: number): Promise<void> {
  const monto = 120_000_000 + indice * 10_000_000;
  const fecha = dia(-(indice + 1) * 31);
  const id = crypto.randomUUID();
  await guardarProyectoPorRpc(sesion, {
    proyecto: {
      id,
      version: null,
      cliente_id: cliente,
      titulo: `Vestidor terminado ${String(indice + 1)}`,
      estado: 'entregado',
      presupuesto_centavos: monto,
      comprobante: 'sin_comprobante',
    },
    pagos: [{ id: crypto.randomUUID(), fecha, concepto: 'Todo', monto_centavos: monto }],
    gastos: [],
  });
  const diezmo = Math.floor((monto * 1000 + 5000) / 10000);
  const sueldo = Math.min(SUELDO, monto - diezmo);
  const fijos = Math.min(FIJOS, monto - diezmo - sueldo);
  await cobrarPorRpc(sesion, {
    p_proyecto_id: id,
    p_version: 1,
    p_fecha_cobro: fecha,
    p_cobrado_centavos: monto,
    p_gastos_centavos: 0,
    p_tope_sueldo_centavos: SUELDO,
    p_tope_fijos_centavos: FIJOS,
    p_diezmo_centavos: diezmo,
    p_sueldo_centavos: sueldo,
    p_fijos_centavos: fijos,
    p_remanente_centavos: monto - diezmo - sueldo - fijos,
  });
}

async function opinion(sesion: SesionDePrueba, proyecto: string, indice: number): Promise<string> {
  const token = tokenDePrueba();
  await encuestaPorRest(sesion, proyecto, token);
  const encuesta = (await encuestaComoCliente(sesion, token)) as {
    preguntas: { id: string; tipo: string }[];
  };
  await contestarComoCliente(sesion, token, {
    id: crypto.randomUUID(),
    renglones: encuesta.preguntas.map((pregunta) => ({
      pregunta: pregunta.id,
      valor:
        pregunta.tipo === 'texto'
          ? `Quedó impecable, el placard entró justo. Comentario ${String(indice + 1)} con un poco más de texto para que ocupe dos renglones.`
          : pregunta.tipo === 'sitalvezno'
            ? 3
            : 5 - (indice % 3),
    })),
  });
  return token;
}

function movimiento(indice: number): Record<string, unknown> {
  const clases = [
    { tipo: 'ingreso', tesoro_origen: null, tesoro_destino: 'hogar', categoria: 'Docencia' },
    { tipo: 'gasto', tesoro_origen: 'hogar', tesoro_destino: null, categoria: 'Supermercado' },
    { tipo: 'gasto', tesoro_origen: 'maun', tesoro_destino: null, categoria: 'Materiales' },
    { tipo: 'pago_diezmo', tesoro_origen: 'diezmo', tesoro_destino: null, categoria: '' },
  ];
  const clase = clases[indice % clases.length] ?? clases[0];
  return {
    id: crypto.randomUUID(),
    fecha: dia(-(indice % 25)),
    monto_centavos: 1_200_000 + indice * 1_000,
    descripcion: `Movimiento ${String(indice + 1)} del mes`,
    ...clase,
  };
}

export async function sembrarPocos(sesion: SesionDePrueba): Promise<TallerSembrado> {
  await vaciarTaller(sesion);
  await escribirAjustes(sesion, AJUSTES_COMPLETOS);
  const [cliente = '', segundo = '', tercero = ''] = await clientesPorRest(
    sesion,
    NOMBRES.slice(0, 3).map((nombre, indice) => ({
      nombre,
      telefono: `11 5523 441${String(indice)}`,
      direccion: 'Av. Maipú 1234, Vicente López',
      email: 'cliente@ejemplo.com',
    })),
  );

  const obraId = await obra(sesion, {
    cliente,
    titulo: 'Placard de tres puertas corredizas',
    estado: 'en_curso',
    presupuesto: 124_000_000,
    pagos: 2,
    gastos: 3,
    notas: 'Medidas tomadas. Falta confirmar el color del canto.',
    necesidades: 3,
  });
  await formasDeCobroPorRest(sesion, obraId, { saldo: ['transferencia'] });
  const entregado = await obra(sesion, {
    cliente: segundo,
    titulo: 'Mesada de cocina',
    estado: 'entregado',
    presupuesto: 70_000_000,
    pagos: 1,
    gastos: 1,
  });
  const contacto = await obra(sesion, {
    cliente: tercero,
    titulo: 'Biblioteca de pared',
    estado: 'contacto',
    presupuesto: null,
    pagos: 1,
    gastos: 0,
    visita: dia(3),
  });
  const enviado = await obra(sesion, {
    cliente: segundo,
    titulo: 'Rack para el living',
    estado: 'presupuesto_enviado',
    presupuesto: 45_000_000,
    pagos: 0,
    gastos: 0,
  });

  await archivoPorRest(sesion, { proyectoId: obraId, nombre: 'Plano general.pdf', visible: true });
  await archivoPorRest(sesion, {
    proyectoId: obraId,
    nombre: 'Render del frente.webp',
    tipo: 'image/webp',
    visible: true,
  });

  const enlace = tokenDePrueba();
  await enlacePorRest(sesion, obraId, enlace);
  const encuesta = await opinion(sesion, entregado, 0);
  await movimientosPorRest(sesion, filas(6, movimiento));
  await anotacionesPorRest(sesion, [
    { id: crypto.randomUUID(), fecha: dia(1), texto: 'Comprar tornillos', categoria: 'materiales' },
    { id: crypto.randomUUID(), fecha: dia(2), texto: 'Afilar la sierra', categoria: 'taller' },
  ]);

  return { obra: obraId, entregado, contacto, enviado, cliente, enlace, encuesta };
}

export async function sembrarMuchos(sesion: SesionDePrueba): Promise<TallerSembrado> {
  await vaciarTaller(sesion);
  await escribirAjustes(sesion, AJUSTES_COMPLETOS);
  const clientes = await clientesPorRest(
    sesion,
    NOMBRES.map((nombre, indice) => ({
      nombre,
      telefono: `11 5523 44${String(indice).padStart(2, '0')}`,
      direccion: `Av. Maipú ${String(1200 + indice)}, Vicente López`,
      email: 'cliente@ejemplo.com',
      notas: indice === 0 ? 'Prefiere que lo llamen a la tarde. Tiene un perro grande.' : '',
    })),
  );
  const cliente = clientes[0] ?? '';

  const obraId = await obra(sesion, {
    cliente,
    titulo: 'Placard de tres puertas corredizas con interior de melamina y cajonera',
    estado: 'en_curso',
    presupuesto: 924_000_000,
    pagos: 40,
    gastos: 40,
    notas: NOTAS_LARGAS,
    necesidades: 24,
  });
  await formasDeCobroPorRest(sesion, obraId, {
    sena: ['transferencia', 'efectivo'],
    saldo: ['transferencia', 'efectivo'],
  });
  const entregado = await obra(sesion, {
    cliente,
    titulo: 'Mesada de cocina con bacha y alacena',
    estado: 'entregado',
    presupuesto: 870_000_000,
    pagos: 20,
    gastos: 25,
    notas: NOTAS_LARGAS,
  });
  const contacto = await obra(sesion, {
    cliente,
    titulo: 'Biblioteca de pared con escritorio',
    estado: 'contacto',
    presupuesto: null,
    pagos: 6,
    gastos: 8,
    notas: NOTAS_LARGAS,
    necesidades: 20,
    opciones: 4,
    visita: dia(3),
  });
  const enviado = await obra(sesion, {
    cliente: clientes[1] ?? cliente,
    titulo: 'Rack para el living',
    estado: 'presupuesto_enviado',
    presupuesto: 45_000_000,
    pagos: 0,
    gastos: 0,
  });

  const estados = ['en_curso', 'a_presupuestar', 'contacto', 'entregado', 'presupuesto_enviado'];
  for (let indice = 0; indice < 20; indice += 1) {
    await obra(sesion, {
      cliente: clientes[(indice % (clientes.length - 1)) + 1] ?? cliente,
      titulo: `Trabajo ${String(indice + 1)}: ${indice % 2 === 0 ? 'vestidor a medida' : 'cocina integral con isla'}`,
      estado: estados[indice % estados.length] ?? 'en_curso',
      presupuesto: 50_000_000 + indice * 7_000_000,
      pagos: indice % 4,
      gastos: indice % 3,
      visita: indice % 5 === 2 ? dia(indice - 8) : null,
    });
  }
  for (let indice = 0; indice < 6; indice += 1) {
    await cobrado(sesion, clientes[indice + 2] ?? cliente, indice);
  }

  for (let indice = 0; indice < 8; indice += 1) {
    await archivoPorRest(sesion, {
      proyectoId: obraId,
      nombre: `Plano ${String(indice + 1)} del placard.pdf`,
      visible: true,
    });
    await archivoPorRest(sesion, {
      proyectoId: obraId,
      nombre: `Foto ${String(indice + 1)} de la obra.webp`,
      tipo: 'image/webp',
      visible: true,
    });
    await archivoPorRest(sesion, {
      proyectoId: contacto,
      nombre: `Croquis ${String(indice + 1)}.pdf`,
    });
  }

  const enlace = tokenDePrueba();
  await enlacePorRest(sesion, obraId, enlace);
  let encuesta = '';
  for (let indice = 0; indice < 10; indice += 1) {
    const terminado = await obra(sesion, {
      cliente: clientes[indice + 10] ?? cliente,
      titulo: `Trabajo entregado ${String(indice + 1)}`,
      estado: 'entregado',
      presupuesto: 60_000_000,
      pagos: 1,
      gastos: 0,
    });
    encuesta = await opinion(sesion, terminado, indice);
  }
  await movimientosPorRest(sesion, filas(150, movimiento));
  await anotacionesPorRest(
    sesion,
    filas(40, (indice) => ({
      id: crypto.randomUUID(),
      fecha: dia((indice % 20) - 5),
      texto: `Anotación ${String(indice + 1)}: pasar a buscar las placas`,
      categoria: indice % 2 === 0 ? 'materiales' : 'taller',
    })),
  );

  return { obra: obraId, entregado, contacto, enviado, cliente, enlace, encuesta };
}
