# 0024. Ajustes en el celular: el avatar de Inicio

- Estado: aceptada
- Fecha: 2026-09-13
- Completa al [0013](0013-shell-navegacion-e-inicio.md), que eligió qué destinos entran en cada barra.

## Contexto

El dueño lo encontró probando: en escritorio el sidebar tiene siete destinos; en el celular la barra
tiene cuatro más el botón de cargar, y Ajustes quedó sin entrada. No es solo configuración: **la
lista de lo que la base rechazó vive en Ajustes** (ADR 0016), así que a quien le rebota un cobro en el
celular no tenía cómo ver el registro. También quedaban afuera el perfil, el tema, la huella y el
ajuste del saldo de Cocos.

## La auditoría

Los siete destinos del sidebar, y cómo se llega a cada uno en el celular antes de este cambio. Se
buscó en el código cada navegación hacia esas rutas y se recorrió cada camino en la app
(`e2e/con-sesion/destinos-en-celular.spec.ts`):

| Destino     | Camino en el celular                                                                                                                    |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Inicio      | Barra inferior.                                                                                                                         |
| Proyectos   | Barra inferior.                                                                                                                         |
| Clientes    | Barra inferior.                                                                                                                         |
| Finanzas    | Barra inferior.                                                                                                                         |
| Seguimiento | La pestaña del control segmentado de Proyectos, y el «volver» de la ficha de un contacto.                                               |
| Diezmo      | La tarjeta de Diezmo en Inicio, siempre; y la fila «Diezmo» de los accesos, con el taller configurado.                                  |
| Ajustes     | **Ninguno.** Solo el botón «Configurar sueldo y metas» del estado vacío de Inicio, que desaparece en cuanto el taller está configurado. |

En tablet el riel tiene Ajustes abajo, y en escritorio está en el sidebar. **Ajustes era el único
huérfano, y solo en el celular.**

## Decisión

**El avatar en el encabezado de Inicio, arriba a la derecha, lleva directo a Ajustes.**

- **Los enlaces de cuenta y de ajustes son justamente lo que puede vivir en una superficie
  secundaria.** Lo que no se puede esconder es una función principal, y Ajustes no lo es.
- **Estar fuera de la zona del pulgar es aceptable para algo de baja frecuencia.** El taller
  configura el sueldo y los fijos una vez.
- **El avatar ya existía y en el celular no tenía casa.** Vive en el pie del sidebar, que en el
  celular no está. Darle un lugar resuelve el acceso de una.
- **No hay un encabezado global en todas las pantallas**: cobra alto vertical en cada una. En Inicio
  cuesta un toque más desde otra pantalla y no cuesta espacio.
- **La barra inferior no se tocó.** Cuatro destinos y el botón es la forma que se pidió.
- **Va directo, sin hoja**, porque la auditoría encontró un solo destino huérfano. Si mañana aparece
  otro, el avatar abre una hoja corta desde abajo con los que falten.
- **Solo en el ancho de celular.** En tablet y en escritorio Ajustes ya tiene su entrada, y un segundo
  camino en Inicio sería ruido.
- **El nombre accesible es «Ajustes y tu cuenta».** El avatar es `aria-hidden` (dibuja iniciales o una
  foto) y el enlace sin etiqueta no le diría nada a un lector de pantalla. Es un enlace, no un botón:
  cambia de pantalla. El área táctil es de 44 px con el avatar de 36 adentro.

## Alternativas descartadas

- **Un quinto destino en la barra inferior.** Es la forma que el dueño pidió no cambiar, y Ajustes no
  es de uso diario.
- **Un menú desplegable arriba.** Más lejos del pulgar que una hoja y más difícil de cerrar con una
  mano; para un solo destino, además, sobra.
- **Sumar Ajustes al botón de cargar.** Ese menú es para cargar algo nuevo, no para navegar.

## Consecuencias

- El registro de rechazos está a dos toques desde cualquier pantalla del celular: Inicio y el avatar.
  El e2e del cobro rechazado lo recorre así en el celular.
- Un destino nuevo en el sidebar tiene que tener camino en el celular. Si no entra en la barra, va a
  la hoja del avatar, que entonces deja de llevar directo.
