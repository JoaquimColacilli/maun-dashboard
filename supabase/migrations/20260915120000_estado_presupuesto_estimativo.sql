-- El presupuesto estimativo como etapa propia del seguimiento (ADR 0038).
--
-- Esta migración solo agrega el valor al enum, entre contacto y relevamiento, y va sola: Postgres no
-- deja usar un valor de enum en la misma transacción en la que se agregó, y el ensayo corre todas las
-- migraciones pendientes en una. Las transiciones, la liquidación y la reactivación que lo conocen
-- llegan en la migración siguiente.
--
-- Es aditiva: ninguna fila cambia de estado, y todo contacto que existe sigue en un estado válido.
-- Mientras la migración siguiente no esté aplicada, ninguna transición lleva a este valor, así que
-- nadie puede quedar ahí.

alter type public.estado_proyecto add value if not exists 'presupuesto_estimativo' before 'relevamiento';

comment on type public.estado_proyecto is
  'Lead y proyecto son el mismo registro: los primeros seis estados son de seguimiento (contacto, presupuesto estimativo, relevamiento, a presupuestar, presupuesto enviado y perdido), los últimos tres de obra. Las transiciones válidas viven en @maun/domain.';
