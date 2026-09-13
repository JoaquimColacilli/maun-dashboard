# 0013. El shell, la navegación y la pantalla de Inicio

Estado: aceptada, 2026-09-11. Es el primer paso de la fase 2D: las pantallas de negocio.

## Contexto

La fase 2C dejó la réplica del household en IndexedDB, la cola de salida y el acceso. Lo que faltaba era la app: un marco con navegación y la primera pantalla real. El taller se usa desde un celular con mala señal y con una mano.

## Decisión

**La app renderiza desde la réplica local, no desde la red.** Los datos ya están en IndexedDB cuando el usuario abre la app: las pantallas son funciones puras de ese estado. La red no está en el camino crítico de ningún render; refresca lo que ya se está viendo. Cómo se sostiene:

- **La réplica llega por contexto, no por consulta.** `RutaConAcceso` ya la tiene resuelta antes de dejar pasar, así que la provee con `ProveedorDeReplica` y las pantallas la leen con `useReplicaDelTaller()`. Ninguna pantalla pregunta si hay datos, porque estructuralmente no puede montarse sin ellos. Es lo que evita que cada pantalla reinvente un estado de carga.
- **Sin skeleton en una visita repetida.** El único skeleton vive en la guarda, para la primera carga con la réplica vacía, y el `useIsRestoring()` del provider tapa el parpadeo previo.
- **Sin Suspense con spinner por ruta.** Las pantallas del taller se importan de forma directa, no con `lazy`: son chicas, leen del mismo estado local y el aterrizaje no se parte en un chunk aparte. El code splitting queda solo para las pantallas de acceso, que son las únicas que se ven una vez y dependen de la red (ADR 0009).
- **Nada de loaders del router que peguen a la red.** No se usan loaders: el router elige pantalla y la pantalla lee del contexto.

**El libro mayor es una gemela de la vista de SQL, y vive en `@maun/domain`.** `public.libro_mayor` es una vista y no una tabla, así que no se replica: los saldos por tesoro se calculan en el cliente sobre la réplica (ADR 0009). Eso convierte al libro mayor en la tercera regla duplicada entre TypeScript y SQL, después de la cascada y los estados (ADR 0011).

- `asientosDelLibro` arma las cinco ramas de la vista: los dos lados de un movimiento manual, el pago y el gasto de un proyecto, y la distribución congelada.
- **La distribución incluye los perdidos, no solo los cobrados.** El archivo de la migración original filtraba por `estado = 'cobrado'`; la migración de perdidos reescribió la vista y hoy filtra por `estado in ('cobrado','perdido')`. Portar el archivo viejo habría dejado el diezmo de cada perdido sin mover plata. La fuente autoritativa es `supabase/esquema.sql`, que es el estado vivo, no el archivo de migración.
- `@maun/db` traduce la réplica a las entradas del dominio (`datosDelLibro`), y el dominio no conoce ni los nombres de las columnas ni Supabase.

**Íconos: `lucide-react` en el catálogo, detrás de `Icono` de `@maun/ui`.** El diseño usa lucide. Dibujar los paths a mano era la alternativa sin dependencia, pero no se pueden reproducir de memoria con exactitud y unos íconos "parecidos" se notan. Se importa uno por uno, así que el bundle paga solo los dieciocho que se usan, y la app nunca importa lucide directo: el sistema de diseño sigue siendo la única puerta.

**Una sola navegación en el DOM a la vez.** Los tres anchos (barra inferior, riel, sidebar) se eligen con `matchMedia`, no escondiendo dos con CSS. Tres `<nav aria-label="Principal">` son tres landmarks para un lector de pantalla, y dos de ellos invisibles.

- **Menos de 768: barra inferior flotante**, píldora translúcida con blur, cuatro destinos y el FAB central por encima. Seguimiento no es destino: vive adentro de Proyectos, y `destinoResaltado` lo marca ahí.
- **De 768 a 1279: riel de íconos.** **Desde 1280: sidebar con label**, y ahí Seguimiento, Diezmo y Ajustes son destinos propios.

**Tres cosas del celular que se resuelven en el marco, no en cada pantalla:**

- `viewport-fit=cover` ya estaba en el `index.html` desde la fase 1; se verificó, no se asumió. Sin eso `env(safe-area-inset-*)` devuelve cero.
- **El nodo raíz se ancla con `position: fixed; inset: 0`,** con `100dvh` de respaldo, y los contenedores de adentro heredan ese tamaño. En una PWA instalada `100vh` y `height: 100%` resuelven distinto y dejan una banda negra abajo con el contenido metido bajo la muesca.
- **El padding inferior del contenido es `calc(var(--bottom-nav-clearance) + env(safe-area-inset-bottom))`.** En escritorio el inset da cero y no cambia nada.
  - **Corregido por el ADR 0025.** La constante se quedaba corta cuando el contenido se sale de la ventana, que es lo que pasa en un Samsung con la app instalada. La holgura ahora se mide del rectángulo de todo lo que flota abajo.
- **La barra se esconde mientras se escribe.** `env(keyboard-inset-height)` no tiene soporte parejo, así que se detecta el foco en un campo (`focusin`/`focusout`) y la barra se desmonta: no puede quedar flotando sobre el teclado.

**Transiciones con `document.startViewTransition`, no con el componente de React.** `<ViewTransition>` depende de features de nivel 2 que Firefox todavía no tiene. La llamada directa es Baseline. Tres detalles:

- El callback hace `flushSync` alrededor de la navegación: la API captura el DOM cuando el callback termina, y sin el flush React todavía no lo actualizó.
- Si el navegador no tiene la API, el DOM se actualiza igual y no hay animación. El chequeo de existencia es todo lo que hace falta.
- `prefers-reduced-motion` se respeta dos veces: en JS, salteando la transición, y en CSS, anulando las animaciones de `::view-transition-*`. La animación es la de por defecto, un cross-fade: nada pesado en el hilo principal, que es lo que arruinaría el INP.

**El foco y el anuncio al cambiar de ruta los maneja el marco, no cada pantalla.** El `<main>` lleva `tabIndex={-1}` y recibe el foco en cada navegación, y una región `aria-live` dice a qué sección se entró. Es agnóstico de la pantalla: no depende de que cada una recuerde poner un `ref` en su `<h1>`. Hay además un enlace para saltar al contenido.

**Ajustes entra en este paso, aunque era del siguiente.** La pantalla técnica de verificación se borra acá, y lo que mostraba y sigue sirviendo (los contadores de la réplica, la fecha del último delta y de la última copia completa) tiene que aterrizar donde el usuario lo encuentre. Ajustes es además un destino de la sidebar. Monta el formulario de `features/configurar-taller` tal cual: no se duplica. Suma la lista de cambios que la base rechazó, que la fase 2C dejó pendiente.

**Corregido por el ADR 0020.** Los contadores de la réplica («households 1», «household_members»…) eran nombres de tabla en inglés que el dueño no tiene por qué leer. Ajustes muestra el estado de la sincronización y la fecha de la última, en una línea.

**Las secciones que todavía no existen son pantallas, no rutas muertas.** Proyectos, Clientes, Seguimiento y Diezmo dicen qué llega y cuándo. Finanzas además hospeda el formulario de movimientos que vivía en la pantalla técnica: la funcionalidad de la 2C no se pierde en el camino.

## Criterio de mutaciones (para el paso que viene)

- **`useOptimistic` de React 19 sirve para el eco inmediato adentro de un formulario**, mientras dura el envío.
- **No sirve para la cola offline.** Es local al componente y revierte cuando termina la transición; una mutación encolada puede quedar pendiente horas, sobrevivir a un desmontaje y a que se cierre la app. Ese caso es el patrón de cache del ADR 0012, con su vuelta atrás contra la respuesta del servidor y los valores previos viajando en las variables de la mutación.
- Y lo que ya sabemos: la cola aplica cada liquidación al cache con su distribución y las drena en orden, o dos cobros del mismo mes hechos sin señal rebotan entre ellos (ADR 0011).

## Objeciones

- **La tasa de Cocos no es un porcentaje sobre plata.** `puntosBasicos()` corta en 10000 (100%) porque protege la aritmética de importes, pero `ajustes.tasa_cocos_anual_bp` acepta hasta 100000 (1000%), que en Argentina no es una tasa rara. `proyeccionCocos` recibe puntos básicos crudos y valida por su cuenta. Si algún día la tasa se usa para repartir plata, ahí sí tiene que pasar por el tipo con brand.
- **La comparación del libro mayor contra SQL todavía no corre.** La cascada y los estados tienen su gemela verificada en `scripts/comparacion.ts` contra la base real; el libro mayor, por ahora, solo tiene tests de TypeScript. Es la deuda más cara de este paso: es exactamente el tipo de regla que diverge en silencio, y ya encontramos una divergencia de este tipo entre el archivo de migración y la vista viva.

## Alternativas descartadas

- **Esconder dos navegaciones con CSS.** Más simple de escribir, peor para un lector de pantalla y para los tests.
- **`lazy` con un spinner por ruta.** Es el patrón correcto cuando los datos vienen de la red. Acá no vienen de la red.
- **Mover el foco al `<h1>` de cada pantalla.** Obliga a que cada pantalla se acuerde. El `<main>` lo resuelve una vez.
- **Migrar de router.** El valor de este paso no está ahí y la migración es riesgo puro.
