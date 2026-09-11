# 0009. Velocidad: región, cache primero y un solo round trip

Estado: aceptada, 2026-09-11. La región y la base (bootstrap, índices) quedan hechas en la fase 2A; el cache, la sesión y el bundle se implementan en la 2C.

## Contexto

El primer requisito del cliente: abre la app y ve sus datos, sin esperar ni mirar un spinner. La usa desde el celular en un taller con mala señal, en Buenos Aires. Cada consulta a la base paga el viaje de ida y vuelta, y eso se multiplica por cada consulta que se hace en serie.

## Decisión

**Región São Paulo (sa-east-1).** El proyecto se creó primero en Oregon y se recreó con la base vacía. Medido desde la PC del taller el 2026-09-11, con conexión TCP directa al pooler de cada región: **225 ms a Oregon, 45 ms a São Paulo**. Un pedido real a la API de Oregon, con la conexión ya abierta, tardaba 234 ms. Con Oregon, el cache sería lo único que sostuviera el requisito; con São Paulo, además, la red deja de ser el cuello.

**Primero el cache, después la red.** El cache de TanStack Query persiste en IndexedDB y se hidrata antes del primer render. En una visita que no es la primera no hay skeleton: se pintan los datos que había y la red los actualiza en el lugar. Los skeletons quedan para la primera visita y para el estado vacío real.

**La sesión se valida sin red.** Las guardas de ruta usan `getClaims()`, que verifica el JWT localmente contra el JWKS cacheado (el proyecto usa claves asimétricas). `getUser()` hace un round trip al servidor de Auth antes de poder decidir entre la app y el login: queda fuera del camino crítico.

**Un solo round trip para arrancar.** `public.bootstrap()` devuelve en un JSON todo el household: households, membresías, ajustes, clientes, proyectos, pagos, gastos y movimientos. Con PostgREST serían ocho consultas; desde Buenos Aires, ocho round trips. A esta escala, armar el JSON en Postgres cuesta mucho menos que un viaje. Después del arranque, `public.delta(cursor)` trae solo lo cambiado, también en uno (ADR 0010).

**Nada de N+1.** Donde se use PostgREST directo, las relaciones van embebidas en un solo select.

**Índices, y un test que los exige.** Hay índice sobre toda columna de una policy, sobre cada foreign key (las compuestas incluidas) y un índice `(household_id, updated_at)` en cada tabla sincronizable, que es exactamente el acceso del delta: sin él, cada sync es un scan secuencial. `supabase/tests/00_estructura.sql` falla si una tabla, incluso una futura, llega sin estos índices. Que existan no alcanza: las policies filtran con `household_id = any (array(select private.user_household_ids()))`, que Postgres calcula una vez por consulta (initPlan) y usa como condición de índice. La forma `household_id in (select ...)` es equivalente en resultado pero no entra en el índice, y cada sync terminaría leyendo las filas de todos los households. `supabase/tests/06_planes.sql` corre `explain` como usuario autenticado y falla si el delta o el bootstrap no entran por índice.

**Los saldos se suman al vuelo, con un umbral medido.** El saldo de un tesoro es la suma de sus filas en el libro mayor. El cliente lo calcula sobre su réplica local y la base, cuando lo necesita, con una sola consulta a `libro_mayor`. Estimación de volumen: unos 200 asientos por mes entre movimientos, pagos y gastos, es decir 2.400 por año y 24.000 en diez años. Medido el 2026-09-11 con `pnpm --filter @maun/db db:medir` en el proyecto real (plan Free, sa-east-1). Los datos son sintéticos, la consulta corre como usuario autenticado bajo RLS, y es tiempo de la base (`explain analyze`), sin red. Todo en una transacción que termina en rollback:

| Filas del libro      | Saldos por tesoro | `bootstrap()` en la base | `bootstrap()` | Con gzip |
| -------------------- | ----------------- | ------------------------ | ------------- | -------- |
| 2.400 (≈ un año)     | 6 ms              | 66 ms                    | 1,2 MB        | 96 KB    |
| 24.000 (≈ diez años) | 23 ms             | 785 ms                   | 10,2 MB       | 950 KB   |
| 100.000              | 100 ms            | 18,8 s                   | 41,8 MB       | 3,9 MB   |

Sumar saldos escala bien. `bootstrap()` crece peor que lineal a partir de las 24.000 filas. No lo investigué: la hipótesis es la memoria de la instancia del plan Free al armar un JSON de decenas de megabytes, pero no está verificada. Umbrales, decididos antes de que duela:

- **Saldos precalculados** (saldo al cierre de cada mes, mantenido por trigger o por un cierre explícito) cuando el household supere las 100.000 filas entre movimientos, pagos y gastos (100 ms en la base), o cuando calcular los saldos en un celular de gama baja tarde más de 50 ms.
- **Arranque paginado y reconcile por checksums** (ADR 0010) cuando `bootstrap()` pase de 500 ms en la base o de 1 MB comprimido. Al ritmo estimado, eso es a los diez años; antes, si el taller carga más de lo previsto. Se vuelve a medir con `db:medir` cada vez que el volumen real se acerque.

**El bundle.** Code splitting por ruta, fuentes self-hosted (ya están) y un `<link rel="preconnect">` al origen de Supabase en el HTML, para que el handshake TLS no se pague recién en la primera consulta.

## Riesgo conocido: el plan Free pausa el proyecto

Un proyecto del plan Free se pausa después de 7 días sin actividad. Si el dueño se toma una semana de vacaciones, al volver la app no sincroniza hasta que alguien reactive el proyecto a mano desde el dashboard. El cache persistido amortigua el golpe: la app abre y muestra los datos que tenía, pero no puede mandar ni traer nada, y tiene que decirlo con claridad en vez de quedarse esperando. Salidas posibles:

- **Un ping periódico:** un cron externo que haga una consulta liviana cada pocos días. Sin GitHub Actions (el repo no usa CI), puede ser una función programada de Netlify o un servicio de cron. Es barato y frágil: si el cron se cae, nadie se entera.
- **Pasar a plan Pro:** elimina la pausa y trae backups diarios, que es la otra deuda del plan Free (ADR 0008).

Las dos se deciden junto con los backups, cuando haya datos reales.

## Alternativas descartadas

- **Quedarse en Oregon.** Cada consulta pagaba unos 180 ms de más, y recrear con la base vacía costaba cinco minutos.
- **Varias consultas de PostgREST en paralelo al arrancar.** En paralelo no se pagan en serie, pero el celular con mala señal abre varias conexiones y cada una puede quedar colgada por separado. Un solo pedido falla o anda entero.
- **Una tabla de saldos desde el día uno.** Es un segundo lugar que mantener sincronizado para un volumen que no la necesita (ADR 0003).
