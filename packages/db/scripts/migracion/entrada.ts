import { centavos, type Money } from '@maun/domain';

export const ESTADOS_VIEJOS = ['presupuestado', 'en_curso', 'entregado', 'cobrado'] as const;
export type EstadoViejo = (typeof ESTADOS_VIEJOS)[number];

export const TIPOS_QUE_ENTRAN = [
  'ingreso_hogar',
  'ingreso_maun',
  'gasto_hogar',
  'gasto_maun',
  'pago_diezmo',
  'transfer_cocos',
  'gasto_cocos',
  'cocos_a_maun',
  'ajuste_cocos',
] as const;
export type TipoQueEntra = (typeof TIPOS_QUE_ENTRAN)[number];

export const TIPOS_DERIVADOS = ['sueldo_hogar', 'diezmo_generado', 'fijos_maun'] as const;
const TIPOS_MUERTOS = ['ajuste_hogar', 'ajuste_maun'] as const;

export const FORMAS_DE_PAGO = ['efectivo', 'transferencia', 'cuotas', 'mixto'] as const;
export type FormaDePago = (typeof FORMAS_DE_PAGO)[number];

export const CONFIGURACION_POR_DEFECTO = {
  sueldo: 1_800_000,
  fijos: 0,
  metaCocos: 10_000_000,
  tasa: 40,
} as const;

export const TOLERANCIA_EN_CENTAVOS = 0.001;

export interface ClavesDelArchivo {
  proyectos: string;
  movimientos: string;
  configuracion: string;
}

export const CLAVES_DE_LA_CONSOLA: ClavesDelArchivo = {
  proyectos: 'maun3_p',
  movimientos: 'maun3_m',
  configuracion: 'maun3_c',
};

export const CLAVES_DEL_BACKUP: ClavesDelArchivo = {
  proyectos: 'proyectos',
  movimientos: 'movimientos',
  configuracion: 'config',
};

export interface PagoViejo {
  donde: string;
  fecha: string;
  concepto: string;
  monto: Money;
}

export interface GastoViejo {
  donde: string;
  fecha: string;
  descripcion: string;
  monto: Money;
}

export interface ProyectoViejo {
  donde: string;
  indice: number;
  id: string;
  cliente: string;
  titulo: string;
  estado: EstadoViejo;
  presupuesto: Money | null;
  formaDePago: FormaDePago | null;
  inicio: string | null;
  entrega: string | null;
  alta: string | null;
  pagos: PagoViejo[];
  gastos: GastoViejo[];
}

export interface MovimientoViejo {
  donde: string;
  indice: number;
  id: string;
  tipo: string;
  fecha: string;
  concepto: string;
  categoria: string;
  monto: number;
  proyectoId: string | null;
  descarte: string | null;
}

export interface ConfiguracionVieja {
  sueldo: Money;
  fijos: Money;
  metaCocos: Money;
  tasaBp: number;
}

export interface SistemaViejo {
  claves: ClavesDelArchivo;
  proyectos: ProyectoViejo[];
  movimientos: MovimientoViejo[];
  configuracion: ConfiguracionVieja;
  sucios: string[];
  avisos: string[];
}

interface Lector {
  sucios: string[];
  avisos: string[];
}

type Objeto = Record<string, unknown>;

function esObjeto(valor: unknown): valor is Objeto {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function incluye<T extends string>(lista: readonly T[], valor: unknown): valor is T {
  return typeof valor === 'string' && (lista as readonly string[]).includes(valor);
}

function vacio(valor: unknown): boolean {
  return valor === undefined || valor === null || valor === '';
}

export function mostrar(valor: unknown): string {
  return valor === undefined ? 'vacío' : JSON.stringify(valor);
}

function largo(texto: string): number {
  return texto.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '_').length;
}

function comoNumero(valor: unknown): number {
  if (typeof valor === 'number') return valor;
  if (typeof valor === 'string' && /^\s*-?\d+(\.\d+)?\s*$/.test(valor)) return Number(valor);
  return Number.NaN;
}

export function aCentavos(valor: unknown, donde: string, sucios: string[]): number | null {
  const pesos = comoNumero(valor);
  if (!Number.isFinite(pesos)) {
    sucios.push(`${donde}: el importe ${mostrar(valor)} no es un número.`);
    return null;
  }
  const exacto = pesos * 100;
  const redondeado = Math.round(exacto);
  if (Math.abs(exacto - redondeado) > TOLERANCIA_EN_CENTAVOS) {
    sucios.push(
      `${donde}: el importe ${String(pesos)} tiene fracciones de centavo. Es un dato sucio, no un redondeo: corregilo en el JSON.`,
    );
    return null;
  }
  if (!Number.isSafeInteger(redondeado)) {
    sucios.push(`${donde}: el importe ${String(pesos)} es demasiado grande.`);
    return null;
  }
  return redondeado === 0 ? 0 : redondeado;
}

function centavosSinCortar(valor: unknown): number {
  const pesos = comoNumero(valor);
  return Number.isFinite(pesos) ? Math.round(pesos * 100) : 0;
}

export function esFecha(valor: unknown): valor is string {
  if (typeof valor !== 'string') return false;
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (partes === null) return false;
  const anio = Number(partes[1]);
  const mes = Number(partes[2]);
  const dia = Number(partes[3]);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia
  );
}

export function diaLocal(instante: Date): string {
  const mes = String(instante.getMonth() + 1).padStart(2, '0');
  const dia = String(instante.getDate()).padStart(2, '0');
  return `${String(instante.getFullYear())}-${mes}-${dia}`;
}

export function fechaDeAlta(id: string): string | null {
  const marca = /^(\d{13})-/.exec(id);
  return marca === null ? null : diaLocal(new Date(Number(marca[1])));
}

function texto(
  valor: unknown,
  donde: string,
  campo: string,
  maximo: number,
  lector: Lector,
  obligatorio = false,
): string {
  if (vacio(valor)) {
    if (obligatorio) lector.sucios.push(`${donde}: falta ${campo}.`);
    return '';
  }
  if (typeof valor !== 'string' && typeof valor !== 'number') {
    lector.sucios.push(`${donde}: ${campo} no es texto (${mostrar(valor)}).`);
    return '';
  }
  const limpio = String(valor).trim();
  if (obligatorio && limpio === '') lector.sucios.push(`${donde}: ${campo} está vacío.`);
  if (largo(limpio) > maximo) {
    lector.sucios.push(
      `${donde}: ${campo} tiene ${String(largo(limpio))} caracteres y la base acepta hasta ${String(maximo)}.`,
    );
  }
  return limpio;
}

function fechaOpcional(
  valor: unknown,
  donde: string,
  campo: string,
  lector: Lector,
): string | null {
  if (vacio(valor)) return null;
  if (esFecha(valor)) return valor;
  lector.sucios.push(`${donde}: ${campo} ${mostrar(valor)} no es una fecha AAAA-MM-DD.`);
  return null;
}

function fechaObligatoria(valor: unknown, donde: string, lector: Lector): string {
  if (esFecha(valor)) return valor;
  lector.sucios.push(
    `${donde}: la fecha ${mostrar(valor)} no es una fecha AAAA-MM-DD, y toda fila de plata necesita la suya.`,
  );
  return '';
}

function lista(valor: unknown, donde: string, lector: Lector): unknown[] {
  if (vacio(valor)) return [];
  if (Array.isArray(valor)) return valor;
  lector.sucios.push(`${donde} no es una lista (${mostrar(valor)}).`);
  return [];
}

function leerPagos(valor: unknown, donde: string, lector: Lector): PagoViejo[] {
  const pagos: PagoViejo[] = [];
  lista(valor, `${donde}: pagos`, lector).forEach((pago, indice) => {
    const aca = `${donde}, pago ${String(indice + 1)}`;
    if (!esObjeto(pago)) {
      lector.sucios.push(`${aca}: no es un pago (${mostrar(pago)}).`);
      return;
    }
    const fecha = fechaObligatoria(pago.fecha, aca, lector);
    const concepto = texto(pago.concepto, aca, 'el concepto', 500, lector);
    const monto = aCentavos(pago.monto, aca, lector.sucios);
    if (monto !== null && monto <= 0) {
      lector.sucios.push(
        `${aca}: un pago tiene que ser mayor que cero, y este es ${String(monto / 100)}.`,
      );
      return;
    }
    if (monto !== null && fecha !== '')
      pagos.push({ donde: aca, fecha, concepto, monto: centavos(monto) });
  });
  return pagos;
}

function leerGastos(valor: unknown, donde: string, lector: Lector): GastoViejo[] {
  const gastos: GastoViejo[] = [];
  lista(valor, `${donde}: insumos`, lector).forEach((insumo, indice) => {
    const aca = `${donde}, insumo ${String(indice + 1)}`;
    if (!esObjeto(insumo)) {
      lector.sucios.push(`${aca}: no es un insumo (${mostrar(insumo)}).`);
      return;
    }
    const descripcion = texto(insumo.nombre, aca, 'la descripción', 500, lector);
    const monto = aCentavos(insumo.monto, aca, lector.sucios);
    if (monto === null) return;
    if (monto < 0) {
      lector.sucios.push(
        `${aca}: un gasto no puede ser negativo, y este es ${String(monto / 100)}.`,
      );
      return;
    }
    if (monto === 0) {
      lector.avisos.push(
        `${aca} «${descripcion}» no tiene monto: no entra. El sistema viejo tampoco lo contaba.`,
      );
      return;
    }
    const fecha = fechaObligatoria(insumo.fecha, aca, lector);
    if (fecha !== '') gastos.push({ donde: aca, fecha, descripcion, monto: centavos(monto) });
  });
  return gastos;
}

function leerProyecto(
  valor: unknown,
  indice: number,
  nombre: string,
  lector: Lector,
): ProyectoViejo | null {
  const base = `${nombre}[${String(indice)}]`;
  if (!esObjeto(valor)) {
    lector.sucios.push(`${base}: no es un proyecto (${mostrar(valor)}).`);
    return null;
  }

  const id = typeof valor.id === 'string' || typeof valor.id === 'number' ? String(valor.id) : '';
  const titulo = texto(valor.trabajo, base, 'el trabajo', 200, lector, true);
  const donde = `${base} «${titulo}» (id ${id === '' ? 'sin id' : id})`;
  if (id === '') lector.sucios.push(`${donde}: no tiene id.`);
  texto(valor.cliente, donde, 'el cliente', 200, lector, true);
  const cliente =
    typeof valor.cliente === 'string' || typeof valor.cliente === 'number'
      ? String(valor.cliente)
      : '';

  let estado: EstadoViejo = 'presupuestado';
  if (vacio(valor.estado)) {
    lector.avisos.push(
      `${donde}: no tiene estado; entra como presupuestado, que es lo que mostraba el sistema viejo.`,
    );
  } else if (incluye(ESTADOS_VIEJOS, valor.estado)) {
    estado = valor.estado;
  } else {
    lector.sucios.push(
      `${donde}: el estado ${mostrar(valor.estado)} no es uno de los cuatro del sistema viejo.`,
    );
  }

  let presupuesto: Money | null = null;
  if (vacio(valor.presupuesto)) {
    lector.avisos.push(`${donde}: no tiene presupuesto; entra sin presupuesto.`);
  } else {
    const monto = aCentavos(valor.presupuesto, `${donde}, presupuesto`, lector.sucios);
    if (monto !== null && monto < 0) {
      lector.sucios.push(`${donde}: el presupuesto es negativo.`);
    } else if (monto !== null) {
      presupuesto = centavos(monto);
    }
  }

  let formaDePago: FormaDePago | null = null;
  if (!vacio(valor.pago)) {
    const forma = String(valor.pago).trim().toLowerCase();
    if (incluye(FORMAS_DE_PAGO, forma)) {
      formaDePago = forma;
    } else {
      lector.avisos.push(
        `${donde}: la forma de pago ${mostrar(valor.pago)} no es una de las cuatro; entra sin forma de pago.`,
      );
    }
  }

  return {
    donde,
    indice,
    id,
    cliente,
    titulo,
    estado,
    presupuesto,
    formaDePago,
    inicio: fechaOpcional(valor.inicio, donde, 'el inicio', lector),
    entrega: fechaOpcional(valor.entrega, donde, 'la entrega', lector),
    alta: fechaDeAlta(id),
    pagos: leerPagos(valor.pagos, donde, lector),
    gastos: leerGastos(valor.insumos, donde, lector),
  };
}

function motivoDeDescarte(tipo: string, proyectoId: string | null): string | null {
  if (proyectoId !== null) {
    return 'Derivado de un proyecto: lo arma la vista libro_mayor con los pagos, los gastos y la distribución.';
  }
  if (incluye(TIPOS_DERIVADOS, tipo)) {
    return 'Derivado del reparto de un cobro, sin proyecto: no es un movimiento cargado a mano.';
  }
  return null;
}

function leerMovimiento(
  valor: unknown,
  indice: number,
  nombre: string,
  lector: Lector,
): MovimientoViejo | null {
  const base = `${nombre}[${String(indice)}]`;
  if (!esObjeto(valor)) {
    lector.sucios.push(`${base}: no es un movimiento (${mostrar(valor)}).`);
    return null;
  }

  const tipo = typeof valor.tipo === 'string' ? valor.tipo : '';
  const concepto = typeof valor.concepto === 'string' ? valor.concepto.trim() : '';
  const fechaCruda = typeof valor.fecha === 'string' ? valor.fecha : '';
  const donde = `${base} ${tipo === '' ? 'sin tipo' : tipo} «${concepto}» (${fechaCruda === '' ? 'sin fecha' : fechaCruda})`;
  const id = typeof valor.id === 'string' || typeof valor.id === 'number' ? String(valor.id) : '';
  const proyectoId =
    typeof valor.proyId === 'string' || typeof valor.proyId === 'number'
      ? String(valor.proyId)
      : null;

  if (incluye(TIPOS_MUERTOS, tipo)) {
    lector.sucios.push(
      `${donde}: el sistema viejo no genera nunca este tipo (es código muerto). Revisalo a mano antes de migrar.`,
    );
    return null;
  }
  if (!incluye(TIPOS_QUE_ENTRAN, tipo) && !incluye(TIPOS_DERIVADOS, tipo)) {
    lector.sucios.push(
      `${donde}: el tipo ${mostrar(valor.tipo)} no es uno de los del sistema viejo.`,
    );
    return null;
  }

  const descarte = motivoDeDescarte(tipo, proyectoId);
  if (descarte !== null) {
    if (proyectoId === null) lector.avisos.push(`${donde}: ${descarte}`);
    return {
      donde,
      indice,
      id,
      tipo,
      fecha: fechaCruda,
      concepto,
      categoria: typeof valor.cat === 'string' ? valor.cat : '',
      monto: centavosSinCortar(valor.monto),
      proyectoId,
      descarte,
    };
  }

  const fecha = fechaObligatoria(valor.fecha, donde, lector);
  const monto = aCentavos(valor.monto, donde, lector.sucios);
  const categoria = texto(valor.cat, donde, 'la categoría', 200, lector);
  texto(valor.concepto, donde, 'el concepto', 500, lector);
  if (monto === null || fecha === '') return null;

  if (tipo === 'ajuste_cocos' && monto === 0) {
    lector.avisos.push(`${donde}: es un ajuste de Cocos en cero y no entra.`);
    return {
      donde,
      indice,
      id,
      tipo,
      fecha,
      concepto,
      categoria,
      monto,
      proyectoId,
      descarte: 'Ajuste de Cocos en cero: no mueve plata.',
    };
  }
  if (tipo !== 'ajuste_cocos' && monto <= 0) {
    lector.sucios.push(
      `${donde}: un movimiento de este tipo tiene que ser mayor que cero, y este es ${String(monto / 100)}.`,
    );
    return null;
  }

  return { donde, indice, id, tipo, fecha, concepto, categoria, monto, proyectoId, descarte: null };
}

function leerConfiguracion(valor: unknown, nombre: string, lector: Lector): ConfiguracionVieja {
  const conDefectos: Objeto = { ...CONFIGURACION_POR_DEFECTO };
  if (vacio(valor)) {
    lector.avisos.push(
      `${nombre} está vacío: se usan los valores con los que arrancaba el sistema viejo (sueldo $1.800.000, fijos $0, meta de Cocos $10.000.000, tasa 40%).`,
    );
  } else if (esObjeto(valor)) {
    for (const campo of Object.keys(CONFIGURACION_POR_DEFECTO)) {
      if (vacio(valor[campo])) {
        lector.avisos.push(
          `${nombre} no tiene ${campo}: se usa el valor por defecto del sistema viejo.`,
        );
      } else {
        conDefectos[campo] = valor[campo];
      }
    }
  } else {
    lector.sucios.push(`${nombre} no es la configuración (${mostrar(valor)}).`);
  }

  const importe = (campo: string): Money => {
    const monto = aCentavos(conDefectos[campo], `${nombre}.${campo}`, lector.sucios);
    if (monto !== null && monto < 0) {
      lector.sucios.push(`${nombre}.${campo}: no puede ser negativo.`);
      return centavos(0);
    }
    return centavos(monto ?? 0);
  };

  const tasaBp = aCentavos(conDefectos.tasa, `${nombre}.tasa`, lector.sucios) ?? 0;
  if (tasaBp < 0 || tasaBp > 100_000) {
    lector.sucios.push(
      `${nombre}.tasa: ${String(tasaBp / 100)}% está fuera de lo que acepta la base.`,
    );
  }

  return {
    sueldo: importe('sueldo'),
    fijos: importe('fijos'),
    metaCocos: importe('metaCocos'),
    tasaBp,
  };
}

function clave(json: Objeto, nombre: string, lector: Lector): unknown {
  const valor = json[nombre];
  if (typeof valor !== 'string') return valor;
  try {
    return JSON.parse(valor) as unknown;
  } catch {
    lector.sucios.push(`${nombre} es texto pero no es JSON válido.`);
    return undefined;
  }
}

function nombresDe(claves: ClavesDelArchivo): string[] {
  return [claves.proyectos, claves.movimientos, claves.configuracion];
}

function clavesDelArchivo(json: Objeto, lector: Lector): ClavesDelArchivo | null {
  const usados = [CLAVES_DE_LA_CONSOLA, CLAVES_DEL_BACKUP]
    .map((claves) => ({
      claves,
      presentes: nombresDe(claves).filter((nombre) => nombre in json),
    }))
    .filter(({ presentes }) => presentes.length > 0);

  const [formato, otro] = usados;
  if (formato === undefined) {
    lector.sucios.push(
      'El archivo no tiene ni maun3_p, maun3_m y maun3_c, ni proyectos, movimientos y config: no hay de dónde leer.',
    );
    return null;
  }
  if (otro !== undefined) {
    lector.sucios.push(
      `El archivo mezcla claves de los dos formatos (${usados.flatMap(({ presentes }) => presentes).join(', ')}): no se sabe cuáles leer.`,
    );
    return null;
  }
  const faltan = nombresDe(formato.claves).filter((nombre) => !formato.presentes.includes(nombre));
  if (faltan.length > 0) {
    lector.sucios.push(
      `Al archivo le falta ${faltan.join(', ')}. Una clave que no está no es una clave vacía: sin ella no se sabe si faltan datos.`,
    );
    return null;
  }
  return formato.claves;
}

function sinDatos(lector: Lector): SistemaViejo {
  return {
    claves: CLAVES_DE_LA_CONSOLA,
    proyectos: [],
    movimientos: [],
    configuracion: leerConfiguracion(undefined, CLAVES_DE_LA_CONSOLA.configuracion, {
      sucios: [],
      avisos: [],
    }),
    ...lector,
  };
}

export function leerSistemaViejo(entrada: unknown): SistemaViejo {
  const lector: Lector = { sucios: [], avisos: [] };
  if (!esObjeto(entrada)) {
    lector.sucios.push(
      'El archivo no es un objeto JSON con maun3_p, maun3_m y maun3_c, o con proyectos, movimientos y config.',
    );
    return sinDatos(lector);
  }
  const claves = clavesDelArchivo(entrada, lector);
  if (claves === null) return sinDatos(lector);

  const crudosP = clave(entrada, claves.proyectos, lector);
  const crudosM = clave(entrada, claves.movimientos, lector);
  if (vacio(crudosP))
    lector.avisos.push(`${claves.proyectos} está vacío: no hay proyectos para migrar.`);
  if (vacio(crudosM))
    lector.avisos.push(`${claves.movimientos} está vacío: no hay movimientos para migrar.`);

  const proyectos = lista(crudosP, claves.proyectos, lector)
    .map((valor, indice) => leerProyecto(valor, indice, claves.proyectos, lector))
    .filter((proyecto) => proyecto !== null);
  const movimientos = lista(crudosM, claves.movimientos, lector)
    .map((valor, indice) => leerMovimiento(valor, indice, claves.movimientos, lector))
    .filter((movimiento) => movimiento !== null);

  const vistos = new Map<string, string>();
  for (const proyecto of proyectos) {
    const previo = vistos.get(proyecto.id);
    if (proyecto.id !== '' && previo !== undefined) {
      lector.sucios.push(`${proyecto.donde}: repite el id de ${previo}.`);
    }
    vistos.set(proyecto.id, proyecto.donde);
  }

  return {
    claves,
    proyectos,
    movimientos,
    configuracion: leerConfiguracion(
      clave(entrada, claves.configuracion, lector),
      claves.configuracion,
      lector,
    ),
    ...lector,
  };
}

export function parsearSaldoLeido(escrito: string): number | null {
  const limpio = escrito.replace(/[\s$]/g, '').replace('−', '-');
  const partes = /^(-?)(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/.exec(limpio);
  if (partes === null) return null;
  const enteros = Number((partes[2] ?? '').replaceAll('.', ''));
  const decimales = partes[3] === undefined ? 0 : Number(partes[3].padEnd(2, '0'));
  const valor = enteros * 100 + decimales;
  if (!Number.isSafeInteger(valor)) return null;
  return partes[1] === '-' && valor !== 0 ? -valor : valor;
}
