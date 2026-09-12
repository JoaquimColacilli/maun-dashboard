import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type pg from 'pg';

import { conectar, DIR_SUPABASE } from './conexion.ts';

export const ARCHIVO_ESQUEMA = path.join(DIR_SUPABASE, 'esquema.sql');

const ROLES_DE_LA_API = ['anon', 'authenticated', 'service_role'];
const ESQUEMAS = ['public', 'private'];

const ENCABEZADO = `-- Esquema vivo de la base, leído del catálogo de Postgres. Es la vista del estado final que
-- se perdió al dejar el esquema declarativo (ADR 0008): no se aplica ni se edita a mano.
-- Se regenera con \`pnpm --filter @maun/db db:esquema\` después de cada \`supabase db push\`.
-- El test esquema.test.ts de @maun/db falla si este archivo no coincide con la base.
-- Quedan afuera las funciones de event triggers de la plataforma (public.rls_auto_enable).
`;

async function filas<T extends pg.QueryResultRow>(
  cliente: pg.Client,
  sql: string,
  parametros: unknown[] = [],
): Promise<T[]> {
  return (await cliente.query<T>(sql, parametros)).rows;
}

function literal(texto: string): string {
  return `'${texto.replaceAll("'", "''")}'`;
}

function comentario(objeto: string, texto: string | null): string[] {
  return texto === null ? [] : [`comment on ${objeto} is ${literal(texto)};`];
}

async function schemas(cliente: pg.Client): Promise<string[]> {
  const lineas: string[] = [];
  for (const fila of await filas<{
    nombre: string;
    comentario: string | null;
    privilegios: string | null;
  }>(
    cliente,
    `select n.nspname as nombre,
            obj_description(n.oid, 'pg_namespace') as comentario,
            (
              select string_agg(
                coalesce(r.rolname, 'public') || ':' || x.privilege_type, ', '
                order by coalesce(r.rolname, 'public'), x.privilege_type
              )
              from aclexplode(n.nspacl) x
              left join pg_roles r on r.oid = x.grantee
              where x.grantee = 0 or r.rolname = any ($1)
            ) as privilegios
     from pg_namespace n
     where n.nspname = any ($2)
     order by n.nspname`,
    [ROLES_DE_LA_API, ESQUEMAS],
  )) {
    lineas.push(
      `-- schema ${fila.nombre}: ${fila.privilegios ?? 'sin grants para los roles de la API'}`,
    );
    lineas.push(...comentario(`schema ${fila.nombre}`, fila.comentario));
  }
  return lineas;
}

async function enums(cliente: pg.Client): Promise<string[]> {
  const lineas: string[] = [];
  for (const fila of await filas<{ nombre: string; valores: string[]; comentario: string | null }>(
    cliente,
    `select t.typname as nombre,
            array_agg(e.enumlabel::text order by e.enumsortorder) as valores,
            obj_description(t.oid, 'pg_type') as comentario
     from pg_type t
     join pg_enum e on e.enumtypid = t.oid
     where t.typnamespace = 'public'::regnamespace
     group by t.oid, t.typname
     order by t.typname`,
  )) {
    lineas.push(
      `create type public.${fila.nombre} as enum (${fila.valores.map(literal).join(', ')});`,
    );
    lineas.push(...comentario(`type public.${fila.nombre}`, fila.comentario), '');
  }
  return lineas;
}

async function grantsDeRelacion(
  cliente: pg.Client,
  oid: number,
  objeto: string,
): Promise<string[]> {
  const deTabla = await filas<{ rol: string; privilegios: string }>(
    cliente,
    `select coalesce(r.rolname, 'public') as rol,
            string_agg(x.privilege_type, ', ' order by x.privilege_type) as privilegios
     from pg_class c
     cross join aclexplode(c.relacl) x
     left join pg_roles r on r.oid = x.grantee
     where c.oid = $1 and (x.grantee = 0 or r.rolname = any ($2))
     group by 1
     order by 1`,
    [oid, ROLES_DE_LA_API],
  );
  const deColumnas = await filas<{ rol: string; privilegio: string; columnas: string }>(
    cliente,
    `select coalesce(r.rolname, 'public') as rol,
            x.privilege_type as privilegio,
            string_agg(a.attname, ', ' order by a.attnum) as columnas
     from pg_attribute a
     cross join aclexplode(a.attacl) x
     left join pg_roles r on r.oid = x.grantee
     where a.attrelid = $1 and a.attacl is not null and (x.grantee = 0 or r.rolname = any ($2))
     group by 1, 2
     order by 1, 2`,
    [oid, ROLES_DE_LA_API],
  );
  return [
    ...deTabla.map(
      (fila) => `grant ${fila.privilegios.toLowerCase()} on ${objeto} to ${fila.rol};`,
    ),
    ...deColumnas.map(
      (fila) =>
        `grant ${fila.privilegio.toLowerCase()} (${fila.columnas}) on ${objeto} to ${fila.rol};`,
    ),
  ];
}

async function tablas(cliente: pg.Client): Promise<string[]> {
  const lineas: string[] = [];
  const lista = await filas<{
    oid: number;
    nombre: string;
    rls: boolean;
    forzada: boolean;
    comentario: string | null;
  }>(
    cliente,
    `select c.oid::int as oid, c.relname as nombre, c.relrowsecurity as rls, c.relforcerowsecurity as forzada,
            obj_description(c.oid, 'pg_class') as comentario
     from pg_class c
     where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
     order by c.relname`,
  );

  for (const tabla of lista) {
    const objeto = `public.${tabla.nombre}`;
    const columnas = await filas<{
      nombre: string;
      tipo: string;
      no_nula: boolean;
      defecto: string | null;
      comentario: string | null;
    }>(
      cliente,
      `select a.attname as nombre, format_type(a.atttypid, a.atttypmod) as tipo, a.attnotnull as no_nula,
              pg_get_expr(d.adbin, d.adrelid) as defecto, col_description(a.attrelid, a.attnum) as comentario
       from pg_attribute a
       left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
       where a.attrelid = $1 and a.attnum > 0 and not a.attisdropped
       order by a.attnum`,
      [tabla.oid],
    );
    const constraints = await filas<{ nombre: string; definicion: string }>(
      cliente,
      `select conname as nombre, pg_get_constraintdef(oid, true) as definicion
       from pg_constraint where conrelid = $1 order by conname`,
      [tabla.oid],
    );

    const cuerpo = [
      ...columnas.map(
        (col) =>
          `  ${col.nombre} ${col.tipo}${col.no_nula ? ' not null' : ''}${col.defecto === null ? '' : ` default ${col.defecto}`}`,
      ),
      ...constraints.map((con) => `  constraint ${con.nombre} ${con.definicion}`),
    ];
    lineas.push(`create table ${objeto} (`, cuerpo.join(',\n'), ');');
    lineas.push(...comentario(`table ${objeto}`, tabla.comentario));
    for (const col of columnas)
      lineas.push(...comentario(`column ${objeto}.${col.nombre}`, col.comentario));

    for (const fila of await filas<{ definicion: string }>(
      cliente,
      `select pg_get_indexdef(i.indexrelid) as definicion
       from pg_index i
       where i.indrelid = $1
         and not exists (
           select 1 from pg_constraint c
           where c.conrelid = i.indrelid and c.conindid = i.indexrelid and c.contype in ('p', 'u', 'x')
         )
       order by 1`,
      [tabla.oid],
    )) {
      lineas.push(`${fila.definicion};`);
    }

    for (const fila of await filas<{ definicion: string }>(
      cliente,
      `select pg_get_triggerdef(t.oid, true) as definicion
       from pg_trigger t where t.tgrelid = $1 and not t.tgisinternal order by t.tgname`,
      [tabla.oid],
    )) {
      lineas.push(`${fila.definicion};`);
    }

    lineas.push(`alter table ${objeto} ${tabla.rls ? 'enable' : 'disable'} row level security;`);
    if (tabla.forzada) lineas.push(`alter table ${objeto} force row level security;`);

    for (const politica of await filas<{
      nombre: string;
      permisiva: string;
      comando: string;
      roles: string[];
      usando: string | null;
      chequeo: string | null;
    }>(
      cliente,
      `select policyname as nombre, permissive as permisiva, cmd as comando, roles::text[] as roles,
              qual as usando, with_check as chequeo
       from pg_policies where schemaname = 'public' and tablename = $1 order by policyname`,
      [tabla.nombre],
    )) {
      lineas.push(
        [
          `create policy ${politica.nombre} on ${objeto} as ${politica.permisiva.toLowerCase()}`,
          `  for ${politica.comando.toLowerCase()} to ${politica.roles.join(', ')}`,
          ...(politica.usando === null ? [] : [`  using (${politica.usando})`]),
          ...(politica.chequeo === null ? [] : [`  with check (${politica.chequeo})`]),
        ].join('\n') + ';',
      );
    }

    lineas.push(...(await grantsDeRelacion(cliente, tabla.oid, objeto)), '');
  }
  return lineas;
}

async function vistas(cliente: pg.Client): Promise<string[]> {
  const lineas: string[] = [];
  for (const vista of await filas<{
    oid: number;
    nombre: string;
    opciones: string[] | null;
    definicion: string;
    comentario: string | null;
  }>(
    cliente,
    `select c.oid::int as oid, c.relname as nombre, c.reloptions as opciones,
            pg_get_viewdef(c.oid, true) as definicion, obj_description(c.oid, 'pg_class') as comentario
     from pg_class c
     where c.relnamespace = 'public'::regnamespace and c.relkind = 'v'
     order by c.relname`,
  )) {
    const objeto = `public.${vista.nombre}`;
    const opciones = vista.opciones === null ? '' : ` with (${vista.opciones.join(', ')})`;
    lineas.push(`create view ${objeto}${opciones} as`, vista.definicion.trimEnd());
    lineas.push(...comentario(`view ${objeto}`, vista.comentario));
    lineas.push(...(await grantsDeRelacion(cliente, vista.oid, objeto)), '');
  }
  return lineas;
}

async function triggersDeAuth(cliente: pg.Client): Promise<string[]> {
  return (
    await filas<{ definicion: string }>(
      cliente,
      `select pg_get_triggerdef(t.oid, true) as definicion
       from pg_trigger t
       where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal
       order by t.tgname`,
    )
  ).map((fila) => `${fila.definicion};`);
}

async function funciones(cliente: pg.Client): Promise<string[]> {
  const lineas: string[] = [];
  for (const funcion of await filas<{
    firma: string;
    definicion: string;
    privilegios: string | null;
    comentario: string | null;
  }>(
    cliente,
    `select p.oid::regprocedure::text as firma,
            pg_get_functiondef(p.oid) as definicion,
            case when p.proacl is null then 'public:EXECUTE (acl por defecto)' else (
              select string_agg(
                coalesce(r.rolname, 'public') || ':' || x.privilege_type, ', '
                order by coalesce(r.rolname, 'public'), x.privilege_type
              )
              from aclexplode(p.proacl) x
              left join pg_roles r on r.oid = x.grantee
              where x.grantee = 0 or r.rolname = any ($1)
            ) end as privilegios,
            obj_description(p.oid, 'pg_proc') as comentario
     from pg_proc p
     where p.pronamespace = any ($2::regnamespace[])
       and p.prorettype <> 'event_trigger'::regtype
       and not exists (
         select 1 from pg_depend d
         where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e'
       )
     order by 1`,
    [ROLES_DE_LA_API, ESQUEMAS],
  )) {
    lineas.push(`${funcion.definicion.trimEnd()};`);
    lineas.push(`-- execute: ${funcion.privilegios ?? 'solo el dueño'}`);
    lineas.push(...comentario(`function ${funcion.firma}`, funcion.comentario), '');
  }
  return lineas;
}

export async function generarEsquema(cliente: pg.Client): Promise<string> {
  const secciones: [string, string[]][] = [
    ['Schemas', await schemas(cliente)],
    ['Enums', await enums(cliente)],
    ['Tablas', await tablas(cliente)],
    ['Vistas', await vistas(cliente)],
    ['Triggers sobre auth.users', await triggersDeAuth(cliente)],
    ['Funciones', await funciones(cliente)],
  ];
  const cuerpo = secciones.map(([titulo, lineas]) =>
    [`-- ${titulo} ${'-'.repeat(95 - titulo.length)}`, '', ...lineas].join('\n'),
  );
  return `${ENCABEZADO}\n${cuerpo.join('\n\n').trimEnd()}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const cliente = await conectar();
  try {
    writeFileSync(ARCHIVO_ESQUEMA, await generarEsquema(cliente));
    console.log(`Escrito ${path.relative(process.cwd(), ARCHIVO_ESQUEMA)}`);
  } finally {
    await cliente.end();
  }
}
