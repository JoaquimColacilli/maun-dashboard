import {
  ajustarTaller,
  anotacionesPorRest,
  clientesPorRest,
  contactoPorRpc,
  contestarComoCliente,
  encuestaComoCliente,
  encuestaPorRest,
  guardarProyectoPorRpc,
  hoyEnElTaller,
  seguimientoPorRpc,
  vaciarTaller,
  type SesionDePrueba,
} from '../apoyo/taller';

export interface TrabajoSembrado {
  id: string;
  titulo: string;
}

export interface TallerDeLasTransiciones {
  obras: TrabajoSembrado[];
  entregado: TrabajoSembrado;
  contactos: TrabajoSembrado[];
  enSeguimiento: TrabajoSembrado;
  clientes: TrabajoSembrado[];
}

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
];

const OBRAS = [
  'Placard de tres puertas corredizas',
  'Mesada de cocina con alacena',
  'Vestidor en L',
  'Biblioteca de pared',
  'Rack para el living',
  'Escritorio con cajonera',
  'Bajo mesada del lavadero',
  'Cama con cajones',
  'Aparador del comedor',
  'Estantes del garaje',
];

function dia(desplazamiento: number): string {
  const fecha = new Date(`${hoyEnElTaller()}T12:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + desplazamiento);
  return fecha.toISOString().slice(0, 10);
}

async function obra(
  sesion: SesionDePrueba,
  datos: { cliente: string; titulo: string; estado: string; entrega: number },
): Promise<TrabajoSembrado> {
  const id = crypto.randomUUID();
  await guardarProyectoPorRpc(sesion, {
    proyecto: {
      id,
      version: null,
      cliente_id: datos.cliente,
      titulo: datos.titulo,
      estado: datos.estado,
      presupuesto_centavos: 90_000_000,
      comprobante: 'sin_comprobante',
      direccion_entrega: 'Olazábal 1240, Ituzaingó',
      fecha_inicio: dia(-20),
      entrega_estimada: dia(datos.entrega),
    },
    pagos: [
      { id: crypto.randomUUID(), fecha: dia(-20), concepto: 'Seña', monto_centavos: 45_000_000 },
    ],
    gastos: [],
  });
  return { id, titulo: datos.titulo };
}

async function opinion(sesion: SesionDePrueba, proyecto: string): Promise<void> {
  const token = `e2e-${crypto.randomUUID().replaceAll('-', '')}`;
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
          ? 'Quedó impecable, el placard entró justo y lo instalaron en una mañana.'
          : pregunta.tipo === 'sitalvezno'
            ? 3
            : 5,
    })),
  });
}

export async function sembrarElTaller(sesion: SesionDePrueba): Promise<TallerDeLasTransiciones> {
  await vaciarTaller(sesion);
  await ajustarTaller(sesion, {
    sueldo_mensual_centavos: 180_000_000,
    costos_fijos_centavos: 60_000_000,
  });
  const ids = await clientesPorRest(
    sesion,
    NOMBRES.map((nombre, indice) => ({
      nombre,
      telefono: `11 5523 44${String(indice).padStart(2, '0')}`,
      direccion: `Av. Maipú ${String(1200 + indice)}, Vicente López`,
    })),
  );
  const clientes = ids.map((id, indice) => ({ id, titulo: NOMBRES[indice] ?? '' }));

  const obras: TrabajoSembrado[] = [];
  for (const [indice, titulo] of OBRAS.entries()) {
    obras.push(
      await obra(sesion, {
        cliente: ids[indice % ids.length] ?? '',
        titulo,
        estado: 'en_curso',
        entrega: 3 + indice * 4,
      }),
    );
  }
  const entregado = await obra(sesion, {
    cliente: ids[0] ?? '',
    titulo: 'Mueble de TV entregado',
    estado: 'entregado',
    entrega: -5,
  });
  await opinion(sesion, entregado.id);

  const contactos: TrabajoSembrado[] = [];
  for (const titulo of ['Rack de living', 'Placard del pasillo', 'Mesa ratona']) {
    const contacto = await contactoPorRpc(sesion, {
      titulo,
      estado: 'presupuesto_enviado',
      telefono: '11 4444 5555',
    });
    contactos.push({ id: contacto.id, titulo });
  }
  const seguido = await seguimientoPorRpc(sesion, {
    titulo: 'Vestidor del dormitorio',
    fecha: hoyEnElTaller(),
    nota: 'Cuando cobre el aguinaldo',
    telefono: '11 4444 6666',
  });

  await anotacionesPorRest(sesion, [
    {
      id: crypto.randomUUID(),
      fecha: hoyEnElTaller(),
      texto: 'Comprar las guías',
      categoria: 'materiales',
      proyecto_id: obras[0]?.id ?? null,
    },
  ]);

  return {
    obras,
    entregado,
    contactos,
    enSeguimiento: { id: seguido.id, titulo: 'Vestidor del dormitorio' },
    clientes,
  };
}
