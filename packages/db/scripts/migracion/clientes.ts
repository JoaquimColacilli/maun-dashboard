export interface VarianteDeCliente {
  original: string;
  proyectos: number;
}

export interface GrupoDeClientes {
  clave: string;
  nombre: string;
  variantes: VarianteDeCliente[];
}

const MARCAS_QUE_NO_SON_LA_ENIE = /(?<![nN])̃|[̀-̂̄-ͯ]/g;

export function normalizarNombre(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(MARCAS_QUE_NO_SON_LA_ENIE, '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\p{P}\s]+$/u, '');
}

function prolijo(nombre: string): string {
  return nombre.replace(/\s+/g, ' ').trim();
}

export function agruparClientes(
  nombres: readonly string[],
  separar: readonly string[] = [],
): GrupoDeClientes[] {
  const grupos = new Map<string, Map<string, number>>();
  for (const original of nombres) {
    const clave = separar.includes(original) ? `=${original}` : normalizarNombre(original);
    const variantes = grupos.get(clave) ?? new Map<string, number>();
    variantes.set(original, (variantes.get(original) ?? 0) + 1);
    grupos.set(clave, variantes);
  }

  return [...grupos]
    .map(([clave, variantes]) => {
      const enOrden = [...variantes].map(([original, proyectos]) => ({ original, proyectos }));
      const elegida = enOrden.reduce((mejor, variante) =>
        variante.proyectos > mejor.proyectos ? variante : mejor,
      );
      return { clave, nombre: prolijo(elegida.original), variantes: enOrden };
    })
    .sort((uno, otro) => uno.nombre.localeCompare(otro.nombre, 'es'));
}

export function claveDelCliente(original: string, separar: readonly string[]): string {
  return separar.includes(original) ? `=${original}` : normalizarNombre(original);
}

export function describirGrupos(grupos: readonly GrupoDeClientes[]): string {
  const juntados = grupos.filter((grupo) => grupo.variantes.length > 1);
  const lineas = [
    `${String(grupos.length)} clientes, de ${String(grupos.reduce((suma, grupo) => suma + grupo.variantes.length, 0))} nombres distintos en los proyectos del archivo.`,
    '',
    juntados.length === 0
      ? 'Ningún nombre se juntó con otro.'
      : `Se juntaron ${String(juntados.length)} grupos (entre comillas, el nombre exacto de cada proyecto):`,
  ];
  for (const grupo of juntados) {
    lineas.push(`  ${grupo.nombre}`);
    for (const variante of grupo.variantes) {
      lineas.push(
        `    ${JSON.stringify(variante.original)}: ${String(variante.proyectos)} ${variante.proyectos === 1 ? 'proyecto' : 'proyectos'}`,
      );
    }
  }
  const solos = grupos.filter((grupo) => grupo.variantes.length === 1);
  if (solos.length > 0) {
    lineas.push('', 'Sin variantes:');
    for (const grupo of solos) {
      const [variante] = grupo.variantes;
      const cantidad = variante?.proyectos ?? 0;
      lineas.push(
        `  ${JSON.stringify(variante?.original ?? grupo.nombre)}: ${String(cantidad)} ${cantidad === 1 ? 'proyecto' : 'proyectos'}`,
      );
    }
  }
  return lineas.join('\n');
}
