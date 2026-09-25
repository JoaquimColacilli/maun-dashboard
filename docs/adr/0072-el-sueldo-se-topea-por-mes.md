# 0072. El sueldo se topea por mes

- Estado: aceptada
- Fecha: 2026-09-25
- Corrige al [0011](0011-dominio-cascada-estados-y-cobro.md), que dejaba el tope del sueldo por
  proyecto, y resuelve la objeción de plata del
  [0056](0056-el-sueldo-del-mes-se-mide-contra-un-sueldo.md). Usa lo que construyó el
  [0016](0016-el-cobro-y-el-rechazo-que-encuentra-al-usuario.md): el acumulado del mes que vio la app.

## Qué se reportó

Joaquim, mirando el cobro del 25 de septiembre en el taller de MAUN: «Me parece que sigue haciendo lo
de asignar 1.800.000 por proyecto. Incluso paga al sueldo, más, en vez de enviar al tesoro del
taller.»

- **La distribución de ese cobro:** «Sueldo a HOGAR $1.391.264,58, faltan $408.735,42» y el remanente
  del taller en $0.
- **En Inicio:** «Sueldo del mes $2.485.068,78 de $1.800.000».

## Lo que había

Consulta de solo lectura del 2026-09-25 sobre los ajustes y los cobros de septiembre, en una
transacción `read only` que terminó en rollback.

- **Los ajustes de MAUN:** sueldo $1.800.000, fijos $0 y `sueldo_tope_mensual` en `false`.
- **Los cobros de septiembre y el sueldo que pagó cada uno:**
  - 8/9: $142.200.
  - 9/9: $951.604,20.
  - 23/9: un perdido, sin sueldo.
  - 25/9: $1.391.264,58.
- **En total, $2.485.068,78** para un sueldo de $1.800.000.

La cuenta no estaba mal: era la regla del 0011, «cada trabajo me paga un retiro», con el tope del
sueldo por proyecto. El 0056 lo dejó escrito como objeción: con cuatro cobros en un mes, esa regla
puede llevar hasta $7.200.000 del taller al hogar. El reporte dice que el dueño no piensa su sueldo
así. Lo piensa como el 0056 midió la barra: un sueldo por mes.

## Decisión

**`ajustes.sueldo_tope_mensual` pasa a `true` en todos los talleres menos el seed, y es el default de
los nuevos.**

- Cada cobro paga a lo sumo lo que le falta al sueldo de su mes.
- Lo que sobra sigue la cascada: completa los fijos del mes, si les falta, y el resto es remanente.
  Todo queda en MAUN.
- El mes es el de la fecha del cobro (0063), no el del día en que se carga.

**No cambia ninguna función.** `private.liquidar`, `@maun/domain` y la comparación de `db:ensayo` ya
cubrían los dos modos desde el 0011.

**El costo que frenó el cambio en el 0011 ya no existe.** Con el tope mensual, un cobro depende de los
otros cobros del mes, y el 0011 temía que un cobro sin señal rebotara con `MN006`. El 0016 lo
resolvió para los fijos, y vale igual para el sueldo:

- la app manda el acumulado del mes que vio;
- si la base tiene otro, verifica la cuenta de la app contra lo que la app vio, recalcula con lo suyo
  y congela eso;
- la app avisa «El reparto salió distinto del que viste», con el sueldo que esperaba y el que quedó.

**Lo congelado no se mueve.**

- Cada liquidación guarda su modo en `dist_sueldo_mensual`.
- Un cobro que se reabre se vuelve a cobrar con el modo con el que se cobró
  (`reapertura_sueldo_mensual`, 0011): corregir un gasto no le reescribe el sueldo.

**El seed sigue por proyecto**, escrito en su `insert`. Sus siete liquidaciones están congeladas así,
y `compararSeed` las recalcula con los ajustes del seed. Además, deja un taller que prueba el otro
modo.

**La app no puede cambiar el modo.** No hay grant, como hasta ahora. Una regla sobre la plata del
dueño que cambia a mitad de mes se decide con un ADR y una migración, como esta.

**Lo que muestra la app:**

- **En Ajustes**, la ayuda del sueldo dice cómo se topea: «Lo que tu casa necesita por mes. Los
  cobros del mes lo van pagando y, una vez cubierto, lo que sobra queda en el taller.»
- **En la distribución de la ganancia**, un escalón en cero porque el mes ya lo cubrió lo dice: «ya
  lo cubrieron otros cobros del mes». Vale también para los fijos, que eran mensuales y quedaban en
  $0 sin explicación.
- **En la barra «Sueldo del mes»**, «Ya está cubierto: los N cobros del mes pagaron…» cuenta solo los
  cobros que pagaron sueldo. Un cobro que llegó con el mes cubierto no suma.

## Con los números de septiembre

| El cobro del 25/9 | Por proyecto (lo que pasó) | Por mes               |
| ----------------- | -------------------------- | --------------------- |
| Tope del sueldo   | $1.800.000                 | $706.195,80           |
| Sueldo, al hogar  | $1.391.264,58              | $706.195,80           |
| Remanente, MAUN   | $0                         | $685.068,78           |
| Debajo del sueldo | «faltan $408.735,42»       | nada: completó el mes |

Desde que se aplica, lo que se cobre en lo que queda de septiembre no le paga sueldo al hogar: el mes
ya pasó los $1.800.000.

## Lo que no se corrige solo

**El cobro del 25/9 queda como se congeló**: $1.391.264,58 al hogar, $685.068,78 más de lo que le
tocaba al mes con esta regla.

- **Reabrirlo no lo arregla:** se vuelve a cobrar con el modo con el que se cobró.
- **La app no tiene un movimiento de HOGAR a MAUN.** Las clases de movimiento que ofrece son
  ingresos, gastos, diezmo y Cocos.
- **Reescribir su distribución congelada es un `update` de plata**, y además depende de algo que la
  base no sabe: si esa plata ya salió de la cuenta del taller. Es decisión del dueño, fuera de esta
  migración.

## Objeciones

- **Cambiar a mitad de mes.** El 0011 recomendaba hacerlo al empezar un mes. Con septiembre ya pasado
  del sueldo, lo que se cobre hasta el 30 queda entero en el taller. Es lo que se pidió, pero es un
  corte en el medio del mes, y se ve en sus números.
- **Una app que todavía no recibió los ajustes nuevos** reparte por proyecto. El `update` hace sonar
  el aviso de cambios (0065) y una app abierta los tiene en segundos. Si igual cobra con la cuenta
  vieja:
  - con el mismo acumulado que la base, rebota con `MN006`, «Los números cambiaron desde que viste el
    reparto», y se rehace;
  - con otro acumulado, rebota con `MN008`, «Esta app quedó vieja», que en este caso es cierto: son
    sus ajustes los viejos.
- **Quedan dos modos que mantener.** El seed y lo congelado usan el de por proyecto. Borrarlo pide
  reescribir historia, y no se hizo.

## Alternativas descartadas

- **Dejar el modo mensual escrito en `private.liquidar` y en el dominio, y borrar la columna.** Cambia
  las dos gemelas, y el seed y lo congelado quedarían sin forma de explicarse.
- **Un interruptor en Ajustes.** Nadie lo pidió, y cambiar la regla de la plata a mitad de mes con un
  toque tiene los costos de la sección de objeciones sin que nadie los lea.
- **Corregir el cobro del 25/9 en la misma migración.** Reescribe una distribución congelada (0003) y
  supone que la plata no se movió. Ver «Lo que no se corrige solo».

## Consecuencias

- Todo taller nuevo reparte el sueldo por mes.
- Los pgTAP que prueban el modo por proyecto lo fijan en sus ajustes (07, 10, 11, 14 y 29).
  `35_el_sueldo_por_mes.sql` prueba el default, los tres cobros de septiembre con los números de MAUN,
  el rebote de una cuenta por proyecto y el ajuste de un cobro que no vio el mes cubierto.
- En el e2e del cobro sin señal que se ajusta, la cuenta de prueba reparte por mes: el sueldo del
  segundo cobro queda en $0 y el remanente pasa de $280.000 a $780.000.

## Cómo se verificó

- `db:ensayo -- --recargar-seed` en verde: la migración, los 35 archivos de pgTAP, el dominio contra
  SQL y el seed recargado, todo en rollback.
- El dominio suma el caso de septiembre: con el mes pasado del sueldo, tope 0, sueldo 0, lo que queda
  después del diezmo en el remanente y nada que falte.
- `db push` sin 403. Una consulta de solo lectura después del push confirma lo que cambió:
  - los tres talleres que no son el seed quedaron con `sueldo_tope_mensual` en `true`: el de MAUN, la
    cuenta de prueba y uno vacío;
  - el seed sigue en `false`;
  - los cobros congelados de MAUN no se movieron: septiembre sigue sumando $2.485.068,78 de sueldo.
- `db advisors --linked` da los mismos avisos que antes del cambio.
