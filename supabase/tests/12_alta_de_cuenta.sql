-- El registro es auto-servicio: quien confirma su mail sale con su propio taller (ADR 0012). Acá se
-- fijan las dos propiedades que sostienen esa promesa: que el taller aparece entero, y que si algo
-- falla al crearlo no queda una cuenta de Auth sin taller.

select plan(16);

-- Sin confirmar el mail no hay taller -------------------------------------------------------------

select tests.guardar('sin_confirmar', tests.crear_usuario('sin-confirmar@maun.test'));

select is(
  (select count(*)::int from public.household_members where user_id = tests.id('sin_confirmar')),
  0,
  'una cuenta que todavía no confirmó el mail no tiene taller: si no, cada dirección inventada dejaría uno vacío'
);

-- Y mientras tanto la base responde vacío en vez de fallar: la app distingue "no pudimos traer los
-- datos" de "no hay datos", y esa diferencia sale de acá.
select tests.entrar_como(tests.id('sin_confirmar'));

select lives_ok('select public.bootstrap()', 'bootstrap() de una cuenta sin taller responde, vacío');

select is(
  jsonb_array_length(public.bootstrap() -> 'households'),
  0,
  'y no trae ningún household'
);

select throws_ok(
  'select private.household_actual()',
  '42501',
  null,
  'sin taller no hay household de la sesión, así que tampoco puede cargar datos'
);

select tests.salir();


-- Al confirmar, el taller aparece entero ----------------------------------------------------------

select tests.confirmar_mail(tests.id('sin_confirmar'));

select tests.guardar(
  'taller',
  (select household_id from public.household_members where user_id = tests.id('sin_confirmar'))
);

select is(
  (select count(*)::int from public.households where id = tests.id('taller')),
  1,
  'confirmar el mail crea el household'
);

select is(
  (select rol::text from public.household_members where user_id = tests.id('sin_confirmar')),
  'titular',
  'con el usuario como titular'
);

select is(
  (select count(*)::int from public.ajustes where household_id = tests.id('taller')),
  1,
  'y con la fila de ajustes, sin la que ninguna liquidación puede correr'
);

select is(
  (
    select array[
      sueldo_mensual_centavos, costos_fijos_centavos, meta_cocos_centavos,
      tasa_cocos_anual_bp::bigint
    ]
    from public.ajustes where household_id = tests.id('taller')
  ),
  array[0, 0, 0, 0]::bigint[],
  'los ajustes nacen en cero: los valores de referencia son de un taller y no de cualquiera, la app los pide'
);

-- La encuesta que se le manda al cliente nace escrita: el dueño no arranca de un editor vacío.
select is(
  (
    select array_agg(p.tipo::text || ':' || p.obligatoria::text order by p.orden)
    from public.preguntas p
    where p.household_id = tests.id('taller')
  ),
  array['escala5:true', 'escala5:true', 'escala5:false', 'sitalvezno:true', 'texto:false'],
  'y con la encuesta base escrita: cinco preguntas, en su orden'
);

select is(
  (
    select array_agg(p.texto)
    from public.preguntas p
    where p.household_id = tests.id('taller') and p.titular
  ),
  array['¿Qué tan conforme quedaste con el mueble?'],
  'una sola es la del número de arriba de Resultados: la de qué tan conforme quedó'
);

select tests.guardar('confirmada', tests.crear_usuario('confirmada@maun.test', true));

select is(
  (select count(*)::int from public.household_members where user_id = tests.id('confirmada')),
  1,
  'una cuenta que nace confirmada también sale con taller: es el otro trigger, el del insert'
);


-- Idempotencia ------------------------------------------------------------------------------------

update auth.users set email_confirmed_at = null where id = tests.id('sin_confirmar');
update auth.users set email_confirmed_at = now() where id = tests.id('sin_confirmar');

select is(
  (select count(*)::int from public.household_members where user_id = tests.id('sin_confirmar')),
  1,
  'volver a confirmar no crea un segundo taller'
);

update public.household_members set deleted_at = now() where user_id = tests.id('sin_confirmar');
update auth.users set email_confirmed_at = null where id = tests.id('sin_confirmar');
update auth.users set email_confirmed_at = now() where id = tests.id('sin_confirmar');

select is(
  (select count(*)::int from public.household_members where user_id = tests.id('sin_confirmar')),
  1,
  'con la membresía revocada tampoco: otro taller dejaría el anterior con datos y sin miembros vivos'
);


-- Atomicidad: un fallo adentro del trigger no deja un usuario huérfano ----------------------------

-- Se fuerza el fallo en el último paso del alta (la encuesta base) para que el rollback tenga que
-- llevarse también el household, la membresía y los ajustes. El not valid evita revisar las filas
-- que ya están, y la constraint desaparece unas líneas más abajo.
select set_config('tests.talleres', (select count(*)::text from public.households), true);

alter table public.preguntas add constraint prueba_el_alta_falla check (false) not valid;

select throws_ok(
  $$ select tests.crear_usuario('rompe@maun.test', true) $$,
  '23514',
  null,
  'un fallo adentro del trigger sale como error del alta, no como un alta a medias'
);

select is(
  (select count(*)::int from auth.users where email = 'rompe@maun.test'),
  0,
  'y la cuenta no queda creada: o existe con taller, o no existe'
);

select is(
  (select count(*)::int from public.households),
  current_setting('tests.talleres')::int,
  'ni queda un household huérfano: el household, la membresía y los ajustes se van con el alta'
);

alter table public.preguntas drop constraint prueba_el_alta_falla;

select * from finish();
