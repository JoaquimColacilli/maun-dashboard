-- Borra el seed y nada más: el household de prueba 5eed0000-0000-7000-8000-000000000001.
-- Las foreign keys en cascada desde households se llevan sus clientes, proyectos, pagos, gastos,
-- movimientos, ajustes y membresías. Ninguna fila de otro household se toca.

delete from public.households where id = '5eed0000-0000-7000-8000-000000000001';
