# Registros de decisión

Formato: contexto, decisión, alternativas descartadas y consecuencias. Una página como máximo. Numerados y en orden: una decisión nueva que reemplaza a otra la marca como reemplazada, no la borra.

| ADR                                                                         | Decisión                                                            | Estado               |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------- |
| [0001](0001-monorepo-pnpm-turborepo.md)                                     | Monorepo con pnpm workspaces, Turborepo y catalogs                  | Aceptada             |
| [0002](0002-importes-en-centavos.md)                                        | Importes en centavos: `bigint` en Postgres, entero en TS            | Aceptada, corregida  |
| [0003](0003-distribucion-congelada.md)                                      | Distribución congelada y libro mayor como vista                     | Aceptada             |
| [0004](0004-rls-y-aislamiento-por-household.md)                             | RLS en todas las tablas, aislamiento por household                  | Aceptada             |
| [0005](0005-offline-first.md)                                               | PWA offline-first con cache persistido                              | Aceptada, corregida  |
| [0006](0006-fsd-cuatro-capas.md)                                            | Feature-Sliced Design acotado a cuatro capas                        | Aceptada             |
| [0007](0007-esquema-declarativo.md)                                         | Esquema declarativo y migraciones generadas                         | Reemplazada por 0008 |
| [0008](0008-migraciones-a-mano-sin-docker.md)                               | Migraciones a mano, sin Docker, en un solo proyecto                 | Aceptada             |
| [0009](0009-velocidad.md)                                                   | Velocidad: región, cache primero y un solo round trip               | Aceptada             |
| [0010](0010-sincronizacion-replica-completa.md)                             | Sincronización: réplica completa del household                      | Aceptada             |
| [0011](0011-dominio-cascada-estados-y-cobro.md)                             | Dominio: cascada, estados y cobro, sin divergir de SQL              | Aceptada, corregida  |
| [0012](0012-acceso-sesion-y-cola-de-salida.md)                              | Acceso, sesión sin red y cola de salida ordenada                    | Aceptada             |
| [0013](0013-shell-navegacion-e-inicio.md)                                   | Shell, navegación por ancho e Inicio desde la réplica               | Aceptada, corregida  |
| [0014](0014-clientes-el-primer-camino-de-escritura.md)                      | Clientes: el primer camino de escritura                             | Aceptada             |
| [0015](0015-proyectos-el-agregado-que-se-guarda-entero.md)                  | Proyectos: el agregado que se guarda entero                         | Aceptada             |
| [0016](0016-el-cobro-y-el-rechazo-que-encuentra-al-usuario.md)              | El cobro, y el rechazo que encuentra al usuario                     | Aceptada             |
| [0017](0017-los-datos-del-sistema-viejo.md)                                 | Los datos del sistema viejo entran por un script                    | Aceptada, pendiente  |
| [0018](0018-finanzas-el-diezmo-y-los-movimientos-a-mano.md)                 | Finanzas, el diezmo y los movimientos a mano                        | Aceptada             |
| [0019](0019-seguimiento-el-contacto-es-la-misma-fila.md)                    | Seguimiento: el contacto es la misma fila, sin tablero              | Aceptada             |
| [0020](0020-pulido-visual.md)                                               | Pulido visual: tema oscuro, hojas, plata, avisos y molde            | Aceptada, corregida  |
| [0021](0021-perfil-sin-foto.md)                                             | Perfil: el nombre en la cuenta, iniciales en vez de foto            | Reemplazada por 0022 |
| [0022](0022-foto-de-perfil.md)                                              | Foto de perfil: recorte en el navegador y bucket público            | Aceptada             |
| [0023](0023-sesion-bloqueo-con-huella-y-passkeys.md)                        | Pantallas de sesión, bloqueo con huella y passkeys                  | Aceptada, corregida  |
| [0024](0024-ajustes-en-el-celular-desde-el-avatar-de-inicio.md)             | Ajustes en el celular desde el avatar de Inicio                     | Aceptada             |
| [0025](0025-lo-que-flota-abajo-una-holgura-medida.md)                       | Lo que flota abajo: una holgura medida                              | Aceptada             |
| [0026](0026-el-bloqueo-cuenta-el-tiempo-afuera.md)                          | El bloqueo cuenta el tiempo afuera, no las aperturas                | Aceptada, corregida  |
| [0027](0027-tirar-para-actualizar-sincroniza.md)                            | Tirar para actualizar: sincroniza, no recarga                       | Aceptada             |
| [0028](0028-la-huella-se-pide-cada-vez-que-se-sale.md)                      | La huella se pide cada vez que se sale                              | Aceptada, corregida  |
| [0029](0029-el-estado-se-cambia-desde-la-ficha.md)                          | El estado se cambia desde la ficha, con acciones                    | Aceptada             |
| [0030](0030-un-guardado-un-aviso.md)                                        | Un guardado, un aviso: esperar el turno no es sin señal             | Aceptada             |
| [0031](0031-ninguna-pantalla-de-sesion-encierra.md)                         | Ninguna pantalla de sesión encierra                                 | Aceptada, corregida  |
| [0032](0032-una-sola-ceremonia-de-webauthn-por-vez.md)                      | Una sola ceremonia de WebAuthn por vez                              | Aceptada             |
| [0033](0033-filas-de-botones.md)                                            | Filas de botones: entran todos o bajan todos                        | Aceptada             |
| [0034](0034-la-agenda-calcula-lo-que-sale-de-los-trabajos.md)               | La agenda calcula lo que sale de los trabajos                       | Aceptada             |
| [0035](0035-un-service-worker-propio.md)                                    | Un service worker propio, con el mismo precache                     | Aceptada, corregida  |
| [0036](0036-avisos-por-dispositivo-fuera-de-la-replica.md)                  | Avisos: una suscripción por dispositivo, fuera de la réplica        | Aceptada             |
| [0037](0037-tocar-un-aviso-vuelve-sin-pedir-la-huella.md)                   | Tocar un aviso vuelve a la app sin pedir la huella                  | Aceptada             |
| [0038](0038-el-embudo-del-seguimiento.md)                                   | El embudo: estimativo, tareas de presupuestar y el pago             | Aceptada             |
| [0039](0039-archivos-de-los-trabajos.md)                                    | Archivos de los trabajos: achicados, por el CDN y con tope          | Aceptada             |
| [0040](0040-preguntar-antes-de-descartar.md)                                | Un formulario en hoja pregunta antes de descartar                   | Aceptada             |
| [0041](0041-la-version-y-las-novedades.md)                                  | La versión es una fecha y las novedades salen de un archivo         | Aceptada             |
| [0042](0042-lo-hecho-de-los-trabajos-y-las-marcas.md)                       | Lo hecho de los trabajos se queda; sus marcas son columnas          | Aceptada             |
| [0043](0043-las-opciones-de-presupuesto-y-la-sena.md)                       | Las opciones de presupuesto y la seña como porcentaje               | Aceptada             |
| [0044](0044-la-validacion-tardia-no-reabre-la-sesion.md)                    | La validación que llega tarde no reabre la sesión                   | Aceptada             |
| [0045](0045-los-costos-estimados-lo-que-hace-falta-y-mover-en-la-agenda.md) | Costos estimados, lo que hace falta y mover en la agenda            | Aceptada, corregida  |
| [0046](0046-la-vista-del-cliente-una-lista-blanca-en-la-base.md)            | La vista del cliente: una lista blanca en la base                   | Aceptada, corregida  |
| [0047](0047-la-sena-se-carga-al-aprobar.md)                                 | La seña se carga al aprobar, en el mismo guardado                   | Aceptada             |
| [0048](0048-los-datos-para-transferir.md)                                   | Los datos para transferir, en los ajustes del taller                | Aceptada             |
| [0049](0049-la-vista-previa-del-enlace.md)                                  | La vista previa del enlace la arma una función de borde             | Aceptada             |
| [0050](0050-la-vista-publica-no-depende-del-armazon-de-la-app.md)           | La vista pública no depende del armazón de la app                   | Aceptada             |
| [0051](0051-cobrar-con-mercado-pago.md)                                     | Cobrar con Mercado Pago: por ahora, el alias                        | Superada en parte    |
| [0052](0052-el-enlace-se-guarda-entero.md)                                  | El enlace se guarda entero, no solo su huella                       | Aceptada             |
| [0053](0053-como-te-paga-cada-trabajo-y-el-qr-del-enlace.md)                | Cómo te paga cada trabajo, y el QR que lleva a su página            | Aceptada, corregida  |
| [0054](0054-el-link-de-cobro-de-mercado-pago.md)                            | El link de cobro de Mercado Pago, pegado a mano en Ajustes          | Aceptada, corregida  |
| [0055](0055-lo-que-se-guarda-en-el-aparato-y-lo-que-no.md)                  | Lo que se guarda en el aparato, y lo que no                         | Aceptada             |
| [0056](0056-el-sueldo-del-mes-se-mide-contra-un-sueldo.md)                  | El sueldo del mes se mide contra un sueldo                          | Aceptada             |
| [0057](0057-las-opiniones-de-los-clientes.md)                               | Las opiniones: la primera vez que alguien de afuera escribe         | Aceptada             |
| [0058](0058-el-estimativo-y-el-relevamiento-en-el-camino-del-cliente.md)    | El estimativo y el relevamiento en el camino del cliente            | Aceptada, corregida  |
| [0059](0059-la-nota-del-relevamiento-reemplaza-al-casillero.md)             | La nota del relevamiento reemplaza al casillero                     | Aceptada             |
| [0060](0060-materiales-la-edicion-en-la-fila-y-el-monto-que-entra.md)       | Materiales, editar en la fila y el monto que entra                  | Aceptada             |
| [0061](0061-el-aviso-de-version-sale-del-registro.md)                       | El aviso de versión nueva sale del registro, y refrescar pregunta   | Aceptada             |
| [0062](0062-el-reparto-en-la-compu.md)                                      | En la compu, tres repartos: filas, principal y apoyo, y tablero     | Aceptada, corregida  |
| [0063](0063-la-fecha-de-la-plata-es-la-del-dia-en-que-paso.md)              | La fecha de la plata es la del día en que pasó                      | Aceptada             |
| [0064](0064-el-seguimiento-de-verdad-y-las-consultas.md)                    | El seguimiento de verdad, y el embudo se llama Consultas            | Aceptada             |
| [0065](0065-la-app-abierta-se-entera-sola.md)                               | La app abierta se entera sola: un aviso vacío y el delta            | Aceptada             |
| [0066](0066-las-transiciones-del-celular.md)                                | Las transiciones del celular: una puerta, una pila y un coordinador | Aceptada             |
| [0067](0067-la-vista-antes-de-aprobar.md)                                   | La vista del cliente antes de aprobar: lo que se ve es lo que pasó  | Aceptada             |
| [0068](0068-la-mesa-y-el-plano.md)                                          | La mesa y el plano: tarjetas sobre una mesa y dibujos en su lámina  | Aceptada, corregida  |
| [0069](0069-el-dibujo-del-trabajo-del-cliente.md)                           | El dibujo del trabajo del cliente: el proceso, no el mueble         | Aceptada             |
