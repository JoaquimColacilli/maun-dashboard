-- Un «por ahora no» como etapa propia: el cliente no dijo que no, dijo que ahora no, y hay que volver a
-- escribirle en una fecha (ADR 0064).
--
-- Esta migración solo agrega el valor al enum, entre presupuesto enviado y perdido, y va sola: Postgres
-- no deja usar un valor de enum en la misma transacción en la que se agregó, y el ensayo corre todas las
-- migraciones pendientes en una. Las transiciones, el próximo contacto y la liquidación que lo conocen
-- llegan en la migración siguiente.
--
-- Es aditiva: ninguna fila cambia de estado, y todo trabajo que existe sigue en un estado válido.
-- Mientras la migración siguiente no esté aplicada, ninguna transición lleva a este valor, así que nadie
-- puede quedar ahí.

alter type public.estado_proyecto add value if not exists 'en_seguimiento' after 'presupuesto_enviado';

comment on type public.estado_proyecto is
  'Lead y proyecto son el mismo registro. Los primeros cinco estados son las consultas (contacto, presupuesto estimativo, relevamiento, a presupuestar y presupuesto enviado); en seguimiento es el «por ahora no», con un próximo contacto pendiente; perdido cierra la consulta, y los últimos tres son de obra. Las transiciones válidas viven en @maun/domain.';
