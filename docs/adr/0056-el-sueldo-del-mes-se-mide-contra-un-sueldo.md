# 0056. El sueldo del mes se mide contra un sueldo

Estado: aceptada, 2026-09-21. Corrige la sección «La barra "Sueldo del mes"» del
[0011](0011-dominio-cascada-estados-y-cobro.md) y la alineación del mensaje de Inicio del
[0020](0020-pulido-visual.md). **No toca la regla de reparto**: el tope de sueldo sigue siendo por
proyecto, como decidió el 0011.

## Qué se reportó

El dueño de MAUN Muebles cargó un sueldo de $1.800.000 y en Inicio vio «Sueldo del mes — $X de
**$3.600.000**». Lo leyó como un número duplicado, y lo asoció a la importación de los datos de su
sistema viejo.

## Lo que había de verdad

Diagnóstico de solo lectura sobre su household, el 2026-09-21:

- **El sueldo guardado estaba bien.** `ajustes.sueldo_mensual_centavos` = 180.000.000, o sea
  $1.800.000, exactamente lo que cargó. La importación no duplicó ningún valor.
- **Septiembre tiene dos cobros**: «Estantería Secretaría» (8/9) y «Escritorio - Estantería Sara»
  (9/9), los dos liquidados por la importación con `dist_objetivo_sueldo_centavos` = $1.800.000 y
  `dist_sueldo_mensual` = false. Son cobros reales del sistema viejo.
- **La barra sumaba un sueldo por cobro.** Es lo que decidió el 0011 el 2026-09-12: con el tope
  por proyecto, «cada cobro del mes espera su propio sueldo». Dos cobros → $3.600.000. Hasta la
  importación no había ningún cobro, así que el dueño nunca lo había visto.

No era un error de la importación ni de la base. Era una decisión de pantalla que no coincide con
cómo el dueño piensa su plata.

## Por qué el 0011 estaba mal en esto

El 0011 arregló un problema real —«$3.600.000 de $1.800.000» se veía como un error— y lo resolvió
cambiando **lo esperado** en vez de **cómo se dice lo que se pasó**. El resultado fue una barra que
mide contra un número que el dueño nunca eligió: nadie cargó $3.600.000 en ningún lado.

Y el mismo 0011 ya había dejado escrito por qué eso no cierra: en su objeción, «el mensaje de arriba
de la barra sigue leyendo el mes contra **un** sueldo, que es la necesidad del hogar». Esa frase es
la que tenía razón. El sueldo que se asigna el dueño es lo que su casa necesita por mes. La regla
«cada trabajo me paga un retiro» es **cómo se junta** esa plata, no cuánta plata hace falta.

El sistema viejo también lo leía así: su aviso era «¡Sueldo del mes cubierto!», contra un sueldo.

## Decisión

**`sueldoDelMes` espera un sueldo por mes**, el de `resumenDelMes`: para el mes en curso, el de
los ajustes; para un mes cerrado, el objetivo con el que se liquidó su último cobro. Lo pagado sigue
siendo la suma de lo que liquidaron los cobros del mes.

Con los datos de septiembre de MAUN Muebles:

|            | Antes                                        | Ahora                                      |
| ---------- | -------------------------------------------- | ------------------------------------------ |
| La barra   | $1.093.804,20 de **$3.600.000** (30 %)       | $1.093.804,20 de **$1.800.000** (61 %)     |
| El mensaje | «Faltan $2.506.195,80 para cubrir el sueldo» | «Faltan $706.195,80 para cubrir el sueldo» |

**Cuando los cobros pagan más que el sueldo**, la barra se llena y lo dice debajo: «Ya está
cubierto: los 2 cobros del mes pagaron $3.600.000». Es la otra mitad de lo que el 0011 quería
resolver: que un número mayor que el objetivo no parezca un error. Se resuelve diciéndolo, no
inflando el objetivo.

`SueldoDelMes` pierde `porCobro`: ya no hay dos maneras de esperar, así que no hay nada que
distinguir. Queda `cobros`, que usa la frase del excedente.

La barra ahora recorta también `aria-valuenow` a 0–100. El ancho ya se recortaba; el valor que lee
un lector de pantalla no, y con este cambio lo pagado puede pasar lo esperado.

## Lo que NO cambia

- **El reparto.** Cada cobro sigue topeando el sueldo por proyecto: cada trabajo cobrado transfiere
  hasta $1.800.000 al hogar. `sueldo_tope_mensual` sigue apagado. Ninguna distribución congelada se
  toca; esto es solo lo que Inicio muestra.
- **Los datos.** No hay migración ni corrección de filas: no había nada mal guardado.

## Consecuencias

- La barra y el mensaje leen lo mismo y lo leen como el dueño: contra el sueldo que cargó.
- Con varios cobros enteros en un mes, la barra queda llena y el excedente se nombra. Antes, la
  barra seguía pidiendo sueldos que el hogar ya tenía cubiertos.

## Objeción, y es de plata

**El reparto por proyecto puede no ser lo que el dueño cree que hace.** Si piensa $1.800.000 como su
sueldo mensual —y este reporte dice que sí—, conviene que sepa que la regla actual, con cuatro
trabajos cobrados en un mes, puede llevar hasta $7.200.000 del taller al hogar. El 0011 describe
cómo pasarse al tope mensual (`sueldo_tope_mensual = true`) y lo que cuesta: el cobro sin conexión
deja de ser determinista. Es una decisión sobre su plata, no de pantalla, y no se tomó acá.

## Fuentes

- Consulta de solo lectura sobre `public.ajustes` y `public.proyectos` del household de MAUN
  Muebles, 2026-09-21, en una transacción `read only` que terminó en rollback.
- ADR 0011, «El tope de sueldo se queda por proyecto» y «La barra "Sueldo del mes"».
- ADR 0020, la alineación del mensaje con la barra.
