-- Seed: un taller de prueba con datos realistas del rubro.
--
-- Todo vive en un household propio, identificable por su id: 5eed0000-0000-7000-8000-000000000001.
-- Los ids de las filas del seed empiezan con 5eed0000, salvo las preguntas de la encuesta base, que
-- las escribe la misma función que a cualquier taller nuevo. Se borra entero con seed-borrar.sql,
-- que borra ese household y nada más (la foreign key en cascada se lleva sus filas).
--
-- Es idempotente: arranca borrando el household del seed, así que correrlo dos veces deja lo mismo.
-- No suma miembros: para verlo desde la app hay que asignarle un usuario de prueba a mano.
--
-- Importes en centavos. Ajustes: sueldo $1.800.000 por proyecto, fijos $250.000 por mes, diezmo
-- 10%; un perdido con seña paga diezmo y no sueldo (ADR 0011).

delete from public.households where id = '5eed0000-0000-7000-8000-000000000001';

insert into public.households (id, nombre)
values ('5eed0000-0000-7000-8000-000000000001', '[seed] Taller de prueba');

insert into public.ajustes (id, household_id, sueldo_mensual_centavos, costos_fijos_centavos, meta_cocos_centavos, tasa_cocos_anual_bp)
values ('5eed0000-0000-7000-8000-000000000002', '5eed0000-0000-7000-8000-000000000001', 180000000, 25000000, 1000000000, 4000);


-- Clientes ---------------------------------------------------------------------------------------

insert into public.clientes (
  id, household_id, nombre, zona, telefono, email, direccion, origen_contacto, origen_detalle,
  condicion_fiscal, cuit, razon_social, domicilio_fiscal, notas, created_at
) values
  ('5eed0000-0000-7000-8000-000000010001', '5eed0000-0000-7000-8000-000000000001', 'Marcela Duarte', 'Ituzaingó', '+54 9 11 5523-4410', 'marceladuarte@gmail.com', 'Olazábal 1240, Ituzaingó', 'referido', 'Referida por su vecina Graciela', 'consumidor_final', '', '', '', '', '2025-08-02 12:00-03'),
  ('5eed0000-0000-7000-8000-000000010002', '5eed0000-0000-7000-8000-000000000001', 'Familia Villalba', 'Morón', '+54 9 11 6012-8873', '', 'Sarmiento 2310, Morón', 'redes', 'Escribieron por Instagram', 'consumidor_final', '', '', '', '', '2026-08-12 12:00-03'),
  ('5eed0000-0000-7000-8000-000000010003', '5eed0000-0000-7000-8000-000000000001', 'Estudio Bramante', 'Caballito', '+54 11 4901-2277', 'obras@bramante.com.ar', 'Av. Rivadavia 5120 3°B, CABA', 'referido', 'Por el arquitecto Julián Ríos', 'responsable_inscripto', '30-71234567-1', 'Bramante Arquitectura SRL', 'Av. Rivadavia 5120 3°B, CABA', 'Pagan a 15 días de la factura.', '2026-07-21 12:00-03'),
  ('5eed0000-0000-7000-8000-000000010004', '5eed0000-0000-7000-8000-000000000001', 'Hernán Cabrera', 'Merlo', '+54 9 11 3388-0921', 'hcabrera@hotmail.com', 'Colón 455, Merlo', 'cartel', 'Vio el cartel del taller', 'monotributo', '20-28456123-7', '', 'Colón 455, Merlo', '', '2026-06-30 12:00-03'),
  ('5eed0000-0000-7000-8000-000000010005', '5eed0000-0000-7000-8000-000000000001', 'Nadia Roldán', 'Ramos Mejía', '+54 9 11 7745-1160', 'nadia.roldan@gmail.com', 'Alsina 88, Ramos Mejía', 'volvio', 'Cliente que volvió', 'consumidor_final', '', '', '', '', '2024-11-05 12:00-03'),
  ('5eed0000-0000-7000-8000-000000010006', '5eed0000-0000-7000-8000-000000000001', 'Silvina Ostuni', 'Castelar', '+54 9 11 4402-7719', '', 'Arias 2790, Castelar', 'referido', 'Referida por Marcela Duarte', 'consumidor_final', '', '', '', '', '2026-09-03 12:00-03'),
  ('5eed0000-0000-7000-8000-000000010007', '5eed0000-0000-7000-8000-000000000001', 'Diego Ferrari', 'Haedo', '+54 9 11 2299-5034', '', 'Rivadavia 16400, Haedo', 'redes', 'Escribió por Instagram', 'consumidor_final', '', '', '', '', '2026-09-01 12:00-03'),
  ('5eed0000-0000-7000-8000-000000010008', '5eed0000-0000-7000-8000-000000000001', 'Carla Beltrán', 'Villa Luro', '+54 9 11 5190-3382', 'carlabeltran@gmail.com', 'Cortina 1520, Villa Luro', 'cartel', 'Vio el cartel del taller', 'consumidor_final', '', '', '', '', '2026-08-20 12:00-03');


-- Proyectos --------------------------------------------------------------------------------------
-- Los cobrados entran como entregados y los perdidos como leads: primero se cargan sus pagos y
-- gastos, y recién después se congela la distribución, igual que en la vida real (la base no deja
-- tocar los hijos de un proyecto liquidado).

insert into public.proyectos (
  id, household_id, cliente_id, titulo, estado, presupuesto_centavos, forma_pago, comprobante,
  fecha_visita, ultimo_contacto, fecha_inicio, entrega_estimada, fecha_entrega, direccion_entrega, notas
) values
  ('5eed0000-0000-7000-8000-000000020001', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000010001',
   'Placard 3 puertas con interior en melamina', 'entregado', 124000000, 'transferencia', 'remito',
   null, null, '2026-07-20', '2026-08-21', '2026-08-22', 'Olazábal 1240, Ituzaingó',
   E'Interior: 2 estantes + barral a 1,70. Zócalo de 8 cm porque el piso está desnivelado.\nLa clienta quiere tiradores negros, ya comprados.'),
  ('5eed0000-0000-7000-8000-000000020002', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000010004',
   'Vanitory colgante en guayubira', 'entregado', 68000000, 'efectivo', 'factura_c',
   null, null, '2026-08-10', '2026-09-02', '2026-09-04', 'Colón 455, Merlo',
   'Queda pendiente el saldo de $200.000. Pasar a cobrar el sábado.'),
  ('5eed0000-0000-7000-8000-000000020003', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000010002',
   'Mesada y alacena de cocina', 'en_curso', 315000000, 'mixto', 'factura_b',
   null, null, '2026-08-24', '2026-09-16', null, 'Sarmiento 2310, Morón',
   E'Falta confirmar el corte de la mesada con la marmolería (Gómez, mar 15).\nAlacena: 4 módulos de 60, puertas con bisagra a 110°.'),
  ('5eed0000-0000-7000-8000-000000020004', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000010003',
   'Biblioteca a medida 2,40 × 3,10', 'en_curso', 240000000, 'transferencia', 'factura_a',
   null, null, '2026-08-03', '2026-09-08', null, 'Obra: Av. Pedro Goyena 1180, Caballito',
   E'Se atrasó por la entrega de las placas. Avisado al estudio el lunes.\nEl montaje es en obra, coordinar con el encargado (Raúl).'),
  ('5eed0000-0000-7000-8000-000000020005', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000010005',
   'Escritorio en L con pasacables', 'entregado', 54000000, 'efectivo', 'sin_comprobante',
   null, null, '2026-06-16', '2026-07-10', '2026-07-11', 'Alsina 88, Ramos Mejía', ''),
  ('5eed0000-0000-7000-8000-000000020006', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000010001',
   'Mueble bajo mesada con cajones Blum', 'entregado', 89000000, 'efectivo', 'remito',
   null, null, '2025-08-11', '2025-09-01', '2025-09-02', 'Olazábal 1240, Ituzaingó', ''),
  ('5eed0000-0000-7000-8000-000000020007', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000010005',
   'Cocina integral en melamina grafito y MDF laqueado', 'entregado', 480000000, 'cuotas', 'factura_b',
   null, null, '2025-11-03', '2025-12-02', '2025-12-15', 'Alsina 88, Ramos Mejía',
   'Mesada de granito gris mara la puso la marmolería aparte, no entra en este presupuesto.'),
  ('5eed0000-0000-7000-8000-000000020008', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000010006',
   'Reforma de cocina completa', 'relevamiento', null, null, 'factura_b',
   '2026-09-17', '2026-09-08', null, null, null, 'Arias 2790, Castelar',
   'Quiere isla central. Llevar el muestrario de melaminas Faplac.'),
  ('5eed0000-0000-7000-8000-000000020009', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000010007',
   'Mueble para TV', 'a_presupuestar', null, null, 'factura_b',
   '2026-09-05', '2026-09-05', null, null, null, 'Rivadavia 16400, Haedo',
   '2,40 de ancho con nicho para la consola. Medidas en el cuaderno.'),
  ('5eed0000-0000-7000-8000-000000020010', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000010008',
   'Vestidor', 'presupuesto_enviado', 195000000, null, 'factura_b',
   '2026-08-27', '2026-09-01', null, null, null, 'Cortina 1520, Villa Luro',
   'Presupuesto enviado por WhatsApp el 1/9. Sin respuesta.'),
  ('5eed0000-0000-7000-8000-000000020011', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000010002',
   'Cama marinera para los chicos', 'contacto', null, null, 'sin_comprobante',
   null, '2026-09-09', null, null, null, 'Sarmiento 2310, Morón',
   'Preguntaron por WhatsApp. Pasar un precio aproximado.'),
  ('5eed0000-0000-7000-8000-000000020012', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000010004',
   'Deck de madera para el patio', 'presupuesto_enviado', 110000000, null, 'factura_c',
   '2026-06-28', '2026-07-10', null, null, null, 'Colón 455, Merlo',
   'Eligió otro presupuesto más barato.'),
  ('5eed0000-0000-7000-8000-000000020013', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000010005',
   'Vestidor y placares del dormitorio principal', 'entregado', 320000000, 'transferencia', 'factura_b',
   null, null, '2025-11-10', '2025-12-09', '2025-12-18', 'Alsina 88, Ramos Mejía',
   'Lo encargó cuando vio la cocina terminada.'),
  ('5eed0000-0000-7000-8000-000000020014', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000010004',
   'Alacena para el lavadero', 'a_presupuestar', null, null, 'factura_c',
   '2026-08-06', '2026-08-13', null, null, null, 'Colón 455, Merlo',
   'Cobró la visita. Después avisó que lo iba a hacer él.');


-- Pagos ------------------------------------------------------------------------------------------

insert into public.pagos (id, household_id, proyecto_id, fecha, concepto, monto_centavos) values
  ('5eed0000-0000-7000-8000-000000030001', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020001', '2026-07-18', 'Seña en el relevamiento', 40000000),
  ('5eed0000-0000-7000-8000-000000030002', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020001', '2026-08-05', 'Adelanto', 40000000),
  ('5eed0000-0000-7000-8000-000000030003', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020001', '2026-08-28', 'Saldo final en la entrega', 44000000),
  ('5eed0000-0000-7000-8000-000000030004', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020002', '2026-08-08', 'Seña', 28000000),
  ('5eed0000-0000-7000-8000-000000030005', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020002', '2026-08-25', 'Adelanto', 20000000),
  ('5eed0000-0000-7000-8000-000000030006', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020003', '2026-08-20', 'Seña', 100000000),
  ('5eed0000-0000-7000-8000-000000030007', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020003', '2026-09-03', 'Adelanto', 50000000),
  ('5eed0000-0000-7000-8000-000000030008', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020004', '2026-07-30', 'Seña', 120000000),
  ('5eed0000-0000-7000-8000-000000030009', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020005', '2026-06-14', 'Seña', 20000000),
  ('5eed0000-0000-7000-8000-000000030010', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020005', '2026-07-15', 'Saldo final', 34000000),
  ('5eed0000-0000-7000-8000-000000030011', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020006', '2025-08-09', 'Seña', 30000000),
  ('5eed0000-0000-7000-8000-000000030012', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020006', '2025-09-05', 'Saldo final', 59000000),
  ('5eed0000-0000-7000-8000-000000030013', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020007', '2025-11-03', 'Seña', 180000000),
  ('5eed0000-0000-7000-8000-000000030014', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020007', '2025-11-24', 'Segunda cuota', 150000000),
  ('5eed0000-0000-7000-8000-000000030015', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020007', '2025-12-19', 'Tercera cuota y saldo', 150000000),
  ('5eed0000-0000-7000-8000-000000030016', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020008', '2026-09-08', 'Seña a cuenta', 8000000),
  ('5eed0000-0000-7000-8000-000000030017', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020013', '2025-11-10', 'Anticipo', 160000000),
  ('5eed0000-0000-7000-8000-000000030018', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020013', '2025-12-22', 'Saldo', 160000000),
  ('5eed0000-0000-7000-8000-000000030019', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020014', '2026-08-06', 'Visita de relevamiento', 4000000);


-- Gastos -----------------------------------------------------------------------------------------

insert into public.gastos (id, household_id, proyecto_id, fecha, descripcion, monto_centavos) values
  ('5eed0000-0000-7000-8000-000000040001', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020001', '2026-07-22', 'Melamina blanca 18mm (3 placas)', 24600000),
  ('5eed0000-0000-7000-8000-000000040002', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020001', '2026-07-29', 'Herrajes Blum para cajones', 5800000),
  ('5eed0000-0000-7000-8000-000000040003', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020001', '2026-07-29', 'Tapacantos', 1450000),
  ('5eed0000-0000-7000-8000-000000040004', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020001', '2026-08-02', 'Cola vinílica y tornillos', 980000),
  ('5eed0000-0000-7000-8000-000000040005', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020001', '2026-08-22', 'Flete', 2500000),
  ('5eed0000-0000-7000-8000-000000040006', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020002', '2026-08-11', 'Guayubira cepillada', 14200000),
  ('5eed0000-0000-7000-8000-000000040007', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020002', '2026-08-14', 'Herrajes Blum para cajones', 3100000),
  ('5eed0000-0000-7000-8000-000000040008', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020002', '2026-08-14', 'Fondo de 3mm', 720000),
  ('5eed0000-0000-7000-8000-000000040009', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020003', '2026-08-25', 'Melamina blanca 18mm (6 placas)', 49200000),
  ('5eed0000-0000-7000-8000-000000040010', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020003', '2026-09-02', 'Herrajes Blum para cajones', 18600000),
  ('5eed0000-0000-7000-8000-000000040011', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020003', '2026-09-02', 'Tapacantos', 2800000),
  ('5eed0000-0000-7000-8000-000000040012', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020003', '2026-09-02', 'Cola vinílica y tornillos', 1240000),
  ('5eed0000-0000-7000-8000-000000040013', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020004', '2026-08-04', 'Melamina blanca 18mm (5 placas)', 41000000),
  ('5eed0000-0000-7000-8000-000000040014', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020004', '2026-08-04', 'Fondo de 3mm', 2100000),
  ('5eed0000-0000-7000-8000-000000040015', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020004', '2026-08-12', 'Tapacantos', 1950000),
  ('5eed0000-0000-7000-8000-000000040016', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020004', '2026-09-01', 'Flete', 3000000),
  ('5eed0000-0000-7000-8000-000000040017', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020005', '2026-06-17', 'Melamina blanca 18mm (2 placas)', 16400000),
  ('5eed0000-0000-7000-8000-000000040018', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020005', '2026-06-20', 'Herrajes', 2200000),
  ('5eed0000-0000-7000-8000-000000040019', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020005', '2026-06-20', 'Tapacantos', 800000),
  ('5eed0000-0000-7000-8000-000000040020', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020006', '2025-08-12', 'Melamina blanca 18mm (3 placas)', 19800000),
  ('5eed0000-0000-7000-8000-000000040021', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020006', '2025-08-18', 'Herrajes Blum para cajones', 9600000),
  ('5eed0000-0000-7000-8000-000000040022', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020006', '2025-08-18', 'Tapacantos', 700000),
  ('5eed0000-0000-7000-8000-000000040023', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020007', '2025-11-05', 'Melamina gris grafito 18mm (10 placas)', 82000000),
  ('5eed0000-0000-7000-8000-000000040024', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020007', '2025-11-05', 'MDF 18mm para laquear (4 placas)', 39000000),
  ('5eed0000-0000-7000-8000-000000040025', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020007', '2025-11-12', 'Herrajes Blum: cajones y bisagras', 31000000),
  ('5eed0000-0000-7000-8000-000000040026', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020007', '2025-11-12', 'Tapacantos', 4200000),
  ('5eed0000-0000-7000-8000-000000040027', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020007', '2025-12-15', 'Flete y ayudante para el montaje', 8800000),
  ('5eed0000-0000-7000-8000-000000040028', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020013', '2025-11-12', 'Melamina roble 18mm (14 placas)', 61000000),
  ('5eed0000-0000-7000-8000-000000040029', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020013', '2025-11-19', 'Herrajes Hettich y correderas', 21000000),
  ('5eed0000-0000-7000-8000-000000040030', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020013', '2025-12-16', 'Flete y colocación', 8000000),
  ('5eed0000-0000-7000-8000-000000040031', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020014', '2026-08-06', 'Nafta de la visita', 800000);


-- Liquidaciones: se congela la distribución ------------------------------------------------------
-- En el orden en que pasaron. neta = cobrado − gastos; diezmo 10%; sueldo topeado en 180.000.000
-- por proyecto; fijos topeados por lo que falta de 25.000.000 en el mes. Un perdido paga diezmo y
-- no sueldo. packages/db/tests/dominio-vs-sql.test.ts verifica cada una contra @maun/domain.

-- Septiembre 2025.
update public.proyectos set
  estado = 'cobrado', fecha_cobro = '2025-09-05', dist_liquidado_at = '2025-09-05 18:00-03',
  dist_cobrado_centavos = 89000000, dist_gastos_centavos = 30100000, dist_diezmo_bp = 1000,
  dist_objetivo_sueldo_centavos = 180000000, dist_objetivo_fijos_centavos = 25000000, dist_sueldo_mensual = false,
  dist_sueldo_previo_centavos = 0, dist_fijos_previo_centavos = 0,
  dist_tope_sueldo_centavos = 180000000, dist_tope_fijos_centavos = 25000000,
  dist_diezmo_centavos = 5890000, dist_sueldo_centavos = 53010000, dist_fijos_centavos = 0, dist_remanente_centavos = 0
where id = '5eed0000-0000-7000-8000-000000020006';

-- Diciembre 2025: la cocina cubre sueldo y fijos y deja remanente.
update public.proyectos set
  estado = 'cobrado', fecha_cobro = '2025-12-19', dist_liquidado_at = '2025-12-19 18:00-03',
  dist_cobrado_centavos = 480000000, dist_gastos_centavos = 165000000, dist_diezmo_bp = 1000,
  dist_objetivo_sueldo_centavos = 180000000, dist_objetivo_fijos_centavos = 25000000, dist_sueldo_mensual = false,
  dist_sueldo_previo_centavos = 0, dist_fijos_previo_centavos = 0,
  dist_tope_sueldo_centavos = 180000000, dist_tope_fijos_centavos = 25000000,
  dist_diezmo_centavos = 31500000, dist_sueldo_centavos = 180000000, dist_fijos_centavos = 25000000, dist_remanente_centavos = 78500000
where id = '5eed0000-0000-7000-8000-000000020007';

-- Tres días después, el vestidor: su propio sueldo, pero los fijos de diciembre ya estaban cubiertos.
update public.proyectos set
  estado = 'cobrado', fecha_cobro = '2025-12-22', dist_liquidado_at = '2025-12-22 18:00-03',
  dist_cobrado_centavos = 320000000, dist_gastos_centavos = 90000000, dist_diezmo_bp = 1000,
  dist_objetivo_sueldo_centavos = 180000000, dist_objetivo_fijos_centavos = 25000000, dist_sueldo_mensual = false,
  dist_sueldo_previo_centavos = 180000000, dist_fijos_previo_centavos = 25000000,
  dist_tope_sueldo_centavos = 180000000, dist_tope_fijos_centavos = 0,
  dist_diezmo_centavos = 23000000, dist_sueldo_centavos = 180000000, dist_fijos_centavos = 0, dist_remanente_centavos = 27000000
where id = '5eed0000-0000-7000-8000-000000020013';

-- Julio 2026: el deck se pierde sin seña (todo en cero) y después se cobra el escritorio.
update public.proyectos set
  estado = 'perdido', fecha_cobro = '2026-07-10', dist_liquidado_at = '2026-07-10 18:00-03',
  dist_cobrado_centavos = 0, dist_gastos_centavos = 0, dist_diezmo_bp = 1000,
  dist_objetivo_sueldo_centavos = 0, dist_objetivo_fijos_centavos = 25000000, dist_sueldo_mensual = false,
  dist_sueldo_previo_centavos = 0, dist_fijos_previo_centavos = 0,
  dist_tope_sueldo_centavos = 0, dist_tope_fijos_centavos = 25000000,
  dist_diezmo_centavos = 0, dist_sueldo_centavos = 0, dist_fijos_centavos = 0, dist_remanente_centavos = 0
where id = '5eed0000-0000-7000-8000-000000020012';

update public.proyectos set
  estado = 'cobrado', fecha_cobro = '2026-07-15', dist_liquidado_at = '2026-07-15 18:00-03',
  dist_cobrado_centavos = 54000000, dist_gastos_centavos = 19400000, dist_diezmo_bp = 1000,
  dist_objetivo_sueldo_centavos = 180000000, dist_objetivo_fijos_centavos = 25000000, dist_sueldo_mensual = false,
  dist_sueldo_previo_centavos = 0, dist_fijos_previo_centavos = 0,
  dist_tope_sueldo_centavos = 180000000, dist_tope_fijos_centavos = 25000000,
  dist_diezmo_centavos = 3460000, dist_sueldo_centavos = 31140000, dist_fijos_centavos = 0, dist_remanente_centavos = 0
where id = '5eed0000-0000-7000-8000-000000020005';

-- Agosto 2026: la alacena se pierde con la visita cobrada (neta 3.200.000: diezmo 320.000 y el
-- resto a fijos), y después el placard encuentra agosto con 2.880.000 de fijos ya cubiertos.
update public.proyectos set
  estado = 'perdido', fecha_cobro = '2026-08-14', dist_liquidado_at = '2026-08-14 18:00-03',
  dist_cobrado_centavos = 4000000, dist_gastos_centavos = 800000, dist_diezmo_bp = 1000,
  dist_objetivo_sueldo_centavos = 0, dist_objetivo_fijos_centavos = 25000000, dist_sueldo_mensual = false,
  dist_sueldo_previo_centavos = 0, dist_fijos_previo_centavos = 0,
  dist_tope_sueldo_centavos = 0, dist_tope_fijos_centavos = 25000000,
  dist_diezmo_centavos = 320000, dist_sueldo_centavos = 0, dist_fijos_centavos = 2880000, dist_remanente_centavos = 0
where id = '5eed0000-0000-7000-8000-000000020014';

update public.proyectos set
  estado = 'cobrado', fecha_cobro = '2026-08-28', dist_liquidado_at = '2026-08-28 18:00-03',
  dist_cobrado_centavos = 124000000, dist_gastos_centavos = 35330000, dist_diezmo_bp = 1000,
  dist_objetivo_sueldo_centavos = 180000000, dist_objetivo_fijos_centavos = 25000000, dist_sueldo_mensual = false,
  dist_sueldo_previo_centavos = 0, dist_fijos_previo_centavos = 2880000,
  dist_tope_sueldo_centavos = 180000000, dist_tope_fijos_centavos = 22120000,
  dist_diezmo_centavos = 8867000, dist_sueldo_centavos = 79803000, dist_fijos_centavos = 0, dist_remanente_centavos = 0
where id = '5eed0000-0000-7000-8000-000000020001';


-- Movimientos manuales ---------------------------------------------------------------------------

insert into public.movimientos (
  id, household_id, fecha, tipo, tesoro_origen, tesoro_destino, monto_centavos, categoria, descripcion
) values
  ('5eed0000-0000-7000-8000-000000050001', '5eed0000-0000-7000-8000-000000000001', '2025-06-01', 'ajuste', null, 'hogar', 30000000, 'Saldo inicial', 'Saldo al empezar a usar la app'),
  ('5eed0000-0000-7000-8000-000000050002', '5eed0000-0000-7000-8000-000000000001', '2025-06-01', 'ajuste', null, 'maun', 50000000, 'Saldo inicial', 'Caja del taller al empezar a usar la app'),
  ('5eed0000-0000-7000-8000-000000050003', '5eed0000-0000-7000-8000-000000000001', '2025-06-01', 'ajuste', null, 'cocos', 610000000, 'Saldo inicial', 'Saldo en Cocos al empezar a usar la app'),
  ('5eed0000-0000-7000-8000-000000050004', '5eed0000-0000-7000-8000-000000000001', '2026-01-10', 'pago_diezmo', 'diezmo', null, 31500000, 'Diezmo', 'Pago de diezmo'),
  ('5eed0000-0000-7000-8000-000000050005', '5eed0000-0000-7000-8000-000000000001', '2026-06-01', 'gasto', 'maun', null, 18000000, 'Costos fijos', 'Alquiler del taller'),
  ('5eed0000-0000-7000-8000-000000050006', '5eed0000-0000-7000-8000-000000000001', '2026-07-01', 'gasto', 'maun', null, 18000000, 'Costos fijos', 'Alquiler del taller'),
  ('5eed0000-0000-7000-8000-000000050007', '5eed0000-0000-7000-8000-000000000001', '2026-07-20', 'pago_diezmo', 'diezmo', null, 9000000, 'Diezmo', 'Pago de diezmo'),
  ('5eed0000-0000-7000-8000-000000050008', '5eed0000-0000-7000-8000-000000000001', '2026-08-01', 'gasto', 'maun', null, 18000000, 'Costos fijos', 'Alquiler del taller'),
  ('5eed0000-0000-7000-8000-000000050009', '5eed0000-0000-7000-8000-000000000001', '2026-08-12', 'gasto', 'hogar', null, 10230000, 'Supermercado', 'Supermercado'),
  ('5eed0000-0000-7000-8000-000000050010', '5eed0000-0000-7000-8000-000000000001', '2026-08-15', 'aporte_cocos', 'maun', 'cocos', 25000000, 'Aporte', 'Aporte a Cocos'),
  ('5eed0000-0000-7000-8000-000000050011', '5eed0000-0000-7000-8000-000000000001', '2026-08-29', 'pago_diezmo', 'diezmo', null, 6000000, 'Diezmo', 'Pago de diezmo'),
  ('5eed0000-0000-7000-8000-000000050012', '5eed0000-0000-7000-8000-000000000001', '2026-08-30', 'gasto', 'hogar', null, 3200000, 'Movilidad', 'Nafta'),
  ('5eed0000-0000-7000-8000-000000050013', '5eed0000-0000-7000-8000-000000000001', '2026-08-31', 'ingreso', null, 'cocos', 18000000, 'Rendimiento', 'Rendimiento del fondo de agosto'),
  ('5eed0000-0000-7000-8000-000000050014', '5eed0000-0000-7000-8000-000000000001', '2026-09-01', 'gasto', 'hogar', null, 2800000, 'Salud', 'Pediatra'),
  ('5eed0000-0000-7000-8000-000000050015', '5eed0000-0000-7000-8000-000000000001', '2026-09-01', 'gasto', 'maun', null, 18000000, 'Costos fijos', 'Alquiler del taller'),
  ('5eed0000-0000-7000-8000-000000050016', '5eed0000-0000-7000-8000-000000000001', '2026-09-05', 'ingreso', null, 'hogar', 42000000, 'Ingreso externo', 'Docencia del mes'),
  ('5eed0000-0000-7000-8000-000000050017', '5eed0000-0000-7000-8000-000000000001', '2026-09-08', 'gasto', 'hogar', null, 7430000, 'Servicios', 'Luz y gas'),
  ('5eed0000-0000-7000-8000-000000050018', '5eed0000-0000-7000-8000-000000000001', '2026-09-09', 'gasto', 'hogar', null, 8640000, 'Supermercado', 'Supermercado');


-- Opiniones --------------------------------------------------------------------------------------
-- La encuesta base, la misma que recibe cualquier taller nuevo, y una encuesta mandada al vanitory
-- que nadie contestó: packages/db/tests/concurrencia.test.ts la usa para mandar dos respuestas a la
-- vez, siempre en rollback.

select private.sembrar_la_encuesta('5eed0000-0000-7000-8000-000000000001');

insert into public.encuestas_enviadas (id, household_id, proyecto_id, token_hash, token) values
  ('5eed0000-0000-7000-8000-000000060001', '5eed0000-0000-7000-8000-000000000001', '5eed0000-0000-7000-8000-000000020002',
   encode(sha256(convert_to('5eed-encuesta-del-vanitory-0001', 'UTF8')), 'hex'), '5eed-encuesta-del-vanitory-0001');
