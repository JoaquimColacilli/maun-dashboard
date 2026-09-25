-- El sueldo se topea por mes (ADR 0072): cada cobro paga a lo sumo lo que le falta al sueldo de su
-- mes, y lo que sobra queda en el taller, como los costos fijos. Corrige la decisión del ADR 0011, que
-- lo dejaba por proyecto: con tres cobros en septiembre, el hogar se llevaba $2.485.068,78 contra un
-- sueldo de $1.800.000.
--
-- No toca ninguna función. private.liquidar y @maun/domain ya cubren los dos modos, y la app manda el
-- acumulado del mes que vio (ADR 0016), así que un cobro sin señal se ajusta en vez de rebotar.
--
-- Lo congelado no se mueve. Cada liquidación guarda su modo en dist_sueldo_mensual, y un cobro que
-- se reabre se vuelve a cobrar con el modo con el que se cobró (reapertura_sueldo_mensual).
--
-- El seed queda por proyecto: su historia está congelada con ese modo, y compararSeed la recalcula
-- con los ajustes del seed.

alter table public.ajustes alter column sueldo_tope_mensual set default true;

update public.ajustes
set sueldo_tope_mensual = true
where household_id <> '5eed0000-0000-7000-8000-000000000001'
  and not sueldo_tope_mensual;

comment on column public.ajustes.sueldo_mensual_centavos is
  'Sueldo que el taller le paga al hogar por mes: objetivo del escalón de sueldo. Con sueldo_tope_mensual, los cobros del mes lo van cubriendo y lo que sobra queda en el taller.';

comment on column public.ajustes.sueldo_tope_mensual is
  'true (desde el ADR 0072, y el default): el sueldo se topea por lo que falta del mes, como los fijos. false: cada cobro paga hasta un sueldo entero, la regla del ADR 0011; la conservan el seed y lo ya congelado. El cliente no tiene grant para cambiarlo.';
