# 0044. La validación que llega tarde no reabre la sesión

- Estado: aceptada
- Fecha: 2026-09-16
- Corrige al [0031](0031-ninguna-pantalla-de-sesion-encierra.md) en qué pasa cuando la validación de la
  sesión contesta tarde.

## Contexto

Al abrir la app, el store de la sesión (`entities/sesion/model/store.ts`) hace dos cosas a la vez.
Escucha los eventos de `supabase-js`, que lo ponen en «activa» enseguida y sin red, con la sesión
guardada. Y valida esa sesión con `leerClaims`, que sí depende de la red: el token del proyecto se firma
con ES256, así que `getClaims` baja las claves públicas (`/auth/v1/.well-known/jwks.json`), y esa copia
vive en la memoria del cliente y se pierde en cada apertura.

El ADR 0031 dejó escrito que, si la validación contesta después, manda ella. Con mala señal eso
encierra:

1. Se abre la app y la validación queda esperando las claves.
2. Se toca «Entrar con otra cuenta» en el bloqueo, o «Cerrar sesión» en «No pudimos leer tus datos» o en
   «Trayendo los datos del taller». `signOut` borra la sesión, el store pasa a anónimo y la app va al
   acceso.
3. Llegan las claves. `getClaims` había tomado el token **antes** del cierre y verifica la firma sin
   preguntarle al servidor, así que contesta con los datos de la sesión que se acaba de cerrar.
4. El store los aplica y vuelve a «activa». El acceso manda al inicio, la réplica ya borrada se pide de
   cero con un cliente sin sesión, PostgREST contesta `42501` y la pantalla queda en «No pudimos leer tus
   datos: tu cuenta no tiene acceso a esto». Se sale tocando «Cerrar sesión» otra vez.

Es lo que hacía intermitente al e2e de «Entrar con otra cuenta» con la cola vacía (ADR 0043): dependía
de si las claves llegaban antes o después del toque.

## Decisión

**Si mientras la validación está en camino llega un cierre, pedido (`cerrada`) o no (`vencida`), su
resultado se descarta**, confirme la sesión o la rechace. Un evento que trae una sesión no la descarta.

- Un cierre pedido deja el acceso a la vista, y una sesión vencida conserva el motivo (ADR 0023).
- **Cerrar y entrar enseguida con otra cuenta tampoco se pisa**: la validación vieja traería la cuenta
  anterior.
- **Sin un cierre en el medio, todo sigue como en el ADR 0031**: la validación que contesta tarde manda,
  y una sesión que ya no sirve sale al acceso.

Es una marca local de `arrancar()` (`llegoUnCierre`), porque la validación se lanza una sola vez por
apertura.

## Alternativas descartadas

- **Ignorar la validación si el estado ya es anónimo.** Resuelve el cierre, pero no cerrar y entrar con
  otra cuenta: el estado es «activa» con la cuenta nueva, y la validación vieja la reemplazaría.
- **Que `leerClaims` vuelva a mirar la sesión guardada antes de contestar.** Tiene el mismo problema con
  la otra cuenta, y deja la regla en `shared/api`, lejos del store, que es el único dueño del estado.
- **Cancelar la validación al cerrar.** `getClaims` no acepta una señal para cortarla.
- **No dejar tocar nada hasta que la validación conteste.** Es lo que el ADR 0031 sacó: con la señal del
  taller, esperar la red es quedar encerrado.

## Verificación

- `store.test.ts`: la validación que contesta después de un cierre no reabre la sesión, no pisa la
  cuenta con la que se entró enseguida y no borra el motivo de una sesión vencida; sin un cierre en el
  medio, se sigue aplicando. Antes del arreglo, los tres primeros fallaban y el cuarto pasaba.
- `bloqueo.spec.ts`, en `celular`: retiene las claves hasta después del toque, espera a que termine la
  verificación de la firma (cuenta las llamadas a `crypto.subtle.verify`) y recién ahí mira la pantalla.
  Así el orden no depende de los tiempos de la red. Sin el arreglo falló 5 de 5 veces, siempre en `/`
  con «No pudimos leer tus datos»; con el arreglo pasó 20 de 20 seguidas.

## Objeciones

- **El e2e fuerza el orden reteniendo un pedido; no reproduce la señal del taller.** Prueba la carrera,
  no la red.
- **Nada se probó en un teléfono.**
