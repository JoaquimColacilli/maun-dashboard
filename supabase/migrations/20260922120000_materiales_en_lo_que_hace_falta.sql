-- Los materiales como tercer tipo de lo que hace falta para un trabajo (ADR 0060).
--
-- Esta migración solo agrega el valor al enum, y va sola: Postgres no deja usar un valor de enum en
-- la misma transacción en la que se agregó, y el ensayo corre todas las migraciones pendientes en
-- una. guardar_proyecto, que valida el tipo contra una lista, lo acepta desde la migración
-- siguiente; hasta entonces nadie puede escribir un material.
--
-- Es aditiva: ninguna fila cambia de tipo, y todo herraje y toda herramienta que existe sigue siendo
-- lo que era. El orden en que se muestran los tres tipos no vive acá sino en @maun/domain, por eso el
-- valor va al final del enum.

alter type public.tipo_de_necesidad add value if not exists 'material';
