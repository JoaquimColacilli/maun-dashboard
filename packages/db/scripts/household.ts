import { parseArgs } from 'node:util';

import { conectar } from './conexion.ts';

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    nombre: { type: 'string' },
    listar: { type: 'boolean', default: false },
  },
});

const cliente = await conectar();
let enTransaccion = false;

try {
  if (values.listar) {
    const { rows: usuarios } = await cliente.query<{
      email: string;
      confirmado: boolean;
      household: string | null;
    }>(
      `select u.email,
              u.email_confirmed_at is not null as confirmado,
              h.nombre as household
       from auth.users u
       left join public.household_members m on m.user_id = u.id and m.deleted_at is null
       left join public.households h on h.id = m.household_id and h.deleted_at is null
       order by u.created_at`,
    );
    const { rows: households } = await cliente.query<{ nombre: string; miembros: number }>(
      `select h.nombre, count(m.id)::int as miembros
       from public.households h
       left join public.household_members m on m.household_id = h.id and m.deleted_at is null
       where h.deleted_at is null
       group by h.id, h.nombre
       order by h.nombre`,
    );

    console.log('Usuarios de Auth:');
    if (usuarios.length === 0) console.log('  (ninguno)');
    for (const usuario of usuarios) {
      const estado = usuario.confirmado ? 'confirmado' : 'sin confirmar';
      console.log(`  ${usuario.email} — ${estado} — ${usuario.household ?? 'sin household'}`);
    }

    console.log('Households:');
    if (households.length === 0) console.log('  (ninguno)');
    for (const household of households) {
      console.log(`  ${household.nombre} — ${String(household.miembros)} miembro(s)`);
    }
  } else {
    const email = values.email;
    const nombre = values.nombre;
    if (!email || !nombre) {
      throw new Error(
        'Uso: pnpm --filter @maun/db db:household --listar para ver quién se registró, o --email <mail> --nombre "<taller>" para reparar una cuenta que quedó sin taller.',
      );
    }

    await cliente.query('begin');
    enTransaccion = true;

    const { rows: usuarios } = await cliente.query<{ id: string }>(
      'select id from auth.users where lower(email) = lower($1)',
      [email],
    );
    const usuario = usuarios[0];
    if (!usuario) {
      throw new Error(
        `No hay ningún usuario de Auth con el mail ${email}: que se registre en la app primero.`,
      );
    }

    const { rows: existentes } = await cliente.query<{ nombre: string; revocada: boolean }>(
      `select h.nombre, m.deleted_at is not null as revocada
       from public.household_members m
       join public.households h on h.id = m.household_id
       where m.user_id = $1 and h.deleted_at is null
       order by m.deleted_at nulls first`,
      [usuario.id],
    );
    const existente = existentes[0];
    if (existente?.revocada) {
      console.log(
        `${email} tuvo acceso al household "${existente.nombre}" y se lo revocaron. No creo uno nuevo: reactivá esa membresía a mano o borrá el household viejo si ya no sirve.`,
      );
    } else if (existente) {
      console.log(
        `${email} ya pertenece al household "${existente.nombre}". No se cambió nada: el taller se crea solo al confirmar la cuenta.`,
      );
    } else {
      const { rows } = await cliente.query<{ id: string }>(
        'select private.crear_household($1, $2) as id',
        [nombre, usuario.id],
      );
      console.log(`Household "${nombre}" creado (${rows[0]?.id ?? ''}) con ${email} como titular.`);
    }

    await cliente.query('commit');
    enTransaccion = false;
  }
} catch (error) {
  if (enTransaccion) await cliente.query('rollback');
  throw error;
} finally {
  await cliente.end();
}
