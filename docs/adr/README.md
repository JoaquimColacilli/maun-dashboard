# Registros de decisión

Formato: contexto, decisión, alternativas descartadas y consecuencias. Una página como máximo. Numerados y en orden: una decisión nueva que reemplaza a otra la marca como reemplazada, no la borra.

| ADR                                                            | Decisión                                                 | Estado               |
| -------------------------------------------------------------- | -------------------------------------------------------- | -------------------- |
| [0001](0001-monorepo-pnpm-turborepo.md)                        | Monorepo con pnpm workspaces, Turborepo y catalogs       | Aceptada             |
| [0002](0002-importes-en-centavos.md)                           | Importes en centavos: `bigint` en Postgres, entero en TS | Aceptada, corregida  |
| [0003](0003-distribucion-congelada.md)                         | Distribución congelada y libro mayor como vista          | Aceptada             |
| [0004](0004-rls-y-aislamiento-por-household.md)                | RLS en todas las tablas, aislamiento por household       | Aceptada             |
| [0005](0005-offline-first.md)                                  | PWA offline-first con cache persistido                   | Aceptada, corregida  |
| [0006](0006-fsd-cuatro-capas.md)                               | Feature-Sliced Design acotado a cuatro capas             | Aceptada             |
| [0007](0007-esquema-declarativo.md)                            | Esquema declarativo y migraciones generadas              | Reemplazada por 0008 |
| [0008](0008-migraciones-a-mano-sin-docker.md)                  | Migraciones a mano, sin Docker, en un solo proyecto      | Aceptada             |
| [0009](0009-velocidad.md)                                      | Velocidad: región, cache primero y un solo round trip    | Aceptada             |
| [0010](0010-sincronizacion-replica-completa.md)                | Sincronización: réplica completa del household           | Aceptada             |
| [0011](0011-dominio-cascada-estados-y-cobro.md)                | Dominio: cascada, estados y cobro, sin divergir de SQL   | Aceptada             |
| [0012](0012-acceso-sesion-y-cola-de-salida.md)                 | Acceso, sesión sin red y cola de salida ordenada         | Aceptada             |
| [0013](0013-shell-navegacion-e-inicio.md)                      | Shell, navegación por ancho e Inicio desde la réplica    | Aceptada             |
| [0014](0014-clientes-el-primer-camino-de-escritura.md)         | Clientes: el primer camino de escritura                  | Aceptada             |
| [0015](0015-proyectos-el-agregado-que-se-guarda-entero.md)     | Proyectos: el agregado que se guarda entero              | Aceptada             |
| [0016](0016-el-cobro-y-el-rechazo-que-encuentra-al-usuario.md) | El cobro, y el rechazo que encuentra al usuario          | Aceptada             |
| [0017](0017-los-datos-del-sistema-viejo.md)                    | Los datos del sistema viejo entran por un script         | Aceptada, pendiente  |
