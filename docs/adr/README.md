# Registros de decisión

Formato: contexto, decisión, alternativas descartadas y consecuencias. Una página como máximo. Numerados y en orden: una decisión nueva que reemplaza a otra la marca como reemplazada, no la borra.

| ADR                                                             | Decisión                                                 | Estado               |
| --------------------------------------------------------------- | -------------------------------------------------------- | -------------------- |
| [0001](0001-monorepo-pnpm-turborepo.md)                         | Monorepo con pnpm workspaces, Turborepo y catalogs       | Aceptada             |
| [0002](0002-importes-en-centavos.md)                            | Importes en centavos: `bigint` en Postgres, entero en TS | Aceptada, corregida  |
| [0003](0003-distribucion-congelada.md)                          | Distribución congelada y libro mayor como vista          | Aceptada             |
| [0004](0004-rls-y-aislamiento-por-household.md)                 | RLS en todas las tablas, aislamiento por household       | Aceptada             |
| [0005](0005-offline-first.md)                                   | PWA offline-first con cache persistido                   | Aceptada, corregida  |
| [0006](0006-fsd-cuatro-capas.md)                                | Feature-Sliced Design acotado a cuatro capas             | Aceptada             |
| [0007](0007-esquema-declarativo.md)                             | Esquema declarativo y migraciones generadas              | Reemplazada por 0008 |
| [0008](0008-migraciones-a-mano-sin-docker.md)                   | Migraciones a mano, sin Docker, en un solo proyecto      | Aceptada             |
| [0009](0009-velocidad.md)                                       | Velocidad: región, cache primero y un solo round trip    | Aceptada             |
| [0010](0010-sincronizacion-replica-completa.md)                 | Sincronización: réplica completa del household           | Aceptada             |
| [0011](0011-dominio-cascada-estados-y-cobro.md)                 | Dominio: cascada, estados y cobro, sin divergir de SQL   | Aceptada             |
| [0012](0012-acceso-sesion-y-cola-de-salida.md)                  | Acceso, sesión sin red y cola de salida ordenada         | Aceptada             |
| [0013](0013-shell-navegacion-e-inicio.md)                       | Shell, navegación por ancho e Inicio desde la réplica    | Aceptada, corregida  |
| [0014](0014-clientes-el-primer-camino-de-escritura.md)          | Clientes: el primer camino de escritura                  | Aceptada             |
| [0015](0015-proyectos-el-agregado-que-se-guarda-entero.md)      | Proyectos: el agregado que se guarda entero              | Aceptada             |
| [0016](0016-el-cobro-y-el-rechazo-que-encuentra-al-usuario.md)  | El cobro, y el rechazo que encuentra al usuario          | Aceptada             |
| [0017](0017-los-datos-del-sistema-viejo.md)                     | Los datos del sistema viejo entran por un script         | Aceptada, pendiente  |
| [0018](0018-finanzas-el-diezmo-y-los-movimientos-a-mano.md)     | Finanzas, el diezmo y los movimientos a mano             | Aceptada             |
| [0019](0019-seguimiento-el-contacto-es-la-misma-fila.md)        | Seguimiento: el contacto es la misma fila, sin tablero   | Aceptada             |
| [0020](0020-pulido-visual.md)                                   | Pulido visual: tema oscuro, hojas, plata, avisos y molde | Aceptada             |
| [0021](0021-perfil-sin-foto.md)                                 | Perfil: el nombre en la cuenta, iniciales en vez de foto | Reemplazada por 0022 |
| [0022](0022-foto-de-perfil.md)                                  | Foto de perfil: recorte en el navegador y bucket público | Aceptada             |
| [0023](0023-sesion-bloqueo-con-huella-y-passkeys.md)            | Pantallas de sesión, bloqueo con huella y passkeys       | Aceptada, corregida  |
| [0024](0024-ajustes-en-el-celular-desde-el-avatar-de-inicio.md) | Ajustes en el celular desde el avatar de Inicio          | Aceptada             |
| [0025](0025-lo-que-flota-abajo-una-holgura-medida.md)           | Lo que flota abajo: una holgura medida                   | Aceptada             |
| [0026](0026-el-bloqueo-cuenta-el-tiempo-afuera.md)              | El bloqueo cuenta el tiempo afuera, no las aperturas     | Aceptada, corregida  |
| [0027](0027-tirar-para-actualizar-sincroniza.md)                | Tirar para actualizar: sincroniza, no recarga            | Aceptada             |
| [0028](0028-la-huella-se-pide-cada-vez-que-se-sale.md)          | La huella se pide cada vez que se sale                   | Aceptada             |
| [0029](0029-el-estado-se-cambia-desde-la-ficha.md)              | El estado se cambia desde la ficha, con acciones         | Aceptada             |
| [0030](0030-un-guardado-un-aviso.md)                            | Un guardado, un aviso: esperar el turno no es sin señal  | Aceptada             |
| [0031](0031-ninguna-pantalla-de-sesion-encierra.md)             | Ninguna pantalla de sesión encierra                      | Aceptada             |
