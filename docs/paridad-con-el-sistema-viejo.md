# Paridad con el sistema viejo

Qué sabe hacer `docs/referencia/Finanzas_MAUN_v3.html` y dónde está eso hoy. La referencia es el
HTML con localStorage que el dueño usa en este momento; no confundir con `design-reference/`, que es
el rediseño.

Leyenda de la última columna: **está** (funciona hoy), **falta** (no está, y en qué paso queda), **no
se replica** (decisión tomada, con el motivo).

Actualizado en el paso 12 (migración y cierre). Con Seguimiento quedó construido todo lo que el
dueño pidió en sus audios. El paso 12 agrega el script que trae los datos del sistema viejo
(sección 10) y cierra las decisiones que habían quedado abiertas.

---

## 1. Los catorce tipos de movimiento

El original guarda catorce valores en `m.tipo` y los suma a mano en `calcTesoros()`. La base tiene
seis (`tipo_movimiento`) **con origen y destino explícitos**, y lo derivado de proyectos no se guarda:
sale de la vista `libro_mayor` a partir de la distribución congelada (ADR 0003).

| Tipo viejo        | Qué hacía en el original                          | Hoy                                                                                                                                                                                                                       |
| ----------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ingreso_hogar`   | `hogar += monto`                                  | **Está.** `ingreso` con destino `hogar`. Se carga en Finanzas.                                                                                                                                                            |
| `ingreso_maun`    | `maun += monto`                                   | **Está.** `ingreso` con destino `maun`.                                                                                                                                                                                   |
| `gasto_hogar`     | `hogar -= monto`                                  | **Está.** `gasto` con origen `hogar`.                                                                                                                                                                                     |
| `gasto_maun`      | `maun -= monto`                                   | **Está.** `gasto` con origen `maun`.                                                                                                                                                                                      |
| `pago_diezmo`     | `diezmoPagado += monto`, **sin salir de ninguno** | **Está, corregido.** `pago_diezmo` con origen y destino explícitos: la plata sale de un tesoro. Es el error 3 del ADR 0003.                                                                                               |
| `transfer_cocos`  | `maun -= `, `cocos += `                           | **Está.** `aporte_cocos`, `maun → cocos`.                                                                                                                                                                                 |
| `gasto_cocos`     | `cocos -= monto`                                  | **Está.** `gasto` con origen `cocos`.                                                                                                                                                                                     |
| `cocos_a_maun`    | `cocos -= `, `maun += `                           | **Está.** `transferencia`, `cocos → maun`.                                                                                                                                                                                |
| `sueldo_hogar`    | `hogar += `, **nunca restaba de MAUN**            | **Está, corregido.** Sale de `dist_sueldo_centavos`: asiento `maun → hogar`. Es el error 2 del ADR 0003.                                                                                                                  |
| `diezmo_generado` | `diezmoAcum += `, `maun -= `                      | **Está.** Sale de `dist_diezmo_centavos`: asiento `maun → diezmo`.                                                                                                                                                        |
| `fijos_maun`      | `maun -= monto`, **sin ir a ningún tesoro**       | **No se replica.** Los fijos son un escalón del reparto, no plata que sale del taller. En el HTML esa diferencia se evaporaba de MAUN sin destino. Hoy no genera asiento y el remanente dice la verdad (ADR 0003 y 0011). |
| `ajuste_cocos`    | `cocos += diferencia`, al guardar la config       | **Está.** En Ajustes se escribe el saldo real de Cocos; la app calcula la diferencia, elige el concepto según el signo y encola el `ajuste`. La resta no la hace el usuario.                                              |
| `ajuste_hogar`    | `hogar += monto`                                  | **No se replica.** Código muerto en el original: está en `calcTesoros` y en `tesoroLabel`, y **nada lo genera nunca**.                                                                                                    |
| `ajuste_maun`     | `maun += monto`                                   | **No se replica.** Código muerto, igual que el anterior.                                                                                                                                                                  |

---

## 2. Cada acción de la interfaz

Sale de los `onclick` y `onchange` del archivo.

| Acción del original                        | Dónde estaba               | Hoy                                                                                                                                                                                                                                   |
| ------------------------------------------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `goTab('proy')`                            | Nav                        | **Está.** Proyectos, con tres pestañas (`Seguimiento · Activos · Historial`) que el original no tenía.                                                                                                                                |
| `goTab('fin')`                             | Nav                        | **Está.** Libro mayor agrupado por día, con filtros por tesoro, por sentido y por mes, y buscador. Arranca en el mes en curso.                                                                                                        |
| `goTab('diezmo')`                          | Nav                        | **Está.** El saldo como frase, lo generado contra lo pagado, y el historial de las dos cosas.                                                                                                                                         |
| `goTab('cfg')`                             | Nav                        | **Está.** Ajustes.                                                                                                                                                                                                                    |
| `abrirForm(null)` — nuevo proyecto         | Botón «+ Nuevo proyecto»   | **Está.** `/proyectos/nuevo`.                                                                                                                                                                                                         |
| `abrirForm(id)` — editar proyecto          | Fila y detalle             | **Está.** `/proyectos/:id/editar`.                                                                                                                                                                                                    |
| `guardarProy()`                            | Formulario                 | **Está**, y en una sola transacción con sus pagos y gastos (`guardar_proyecto`, ADR 0015). El original promovía solo `presupuestado → en_curso` si había pagos; hoy el estado lo elige el usuario entre las transiciones válidas.     |
| `alert('Falta el presupuesto.')`           | `guardarProy()`            | **No se replica, a propósito.** Era la causa del pedido de Seguimiento: sin presupuesto no se podía guardar lo que acababa de relevar. Hoy un contacto se carga sin presupuesto; se pide recién al aprobarlo (ADR 0019).              |
| `addPago()` / `addInsumo()`                | Formulario                 | **Está.** Filas dinámicas, con deshacer al quitar una con datos.                                                                                                                                                                      |
| Quitar una fila (`parentElement.remove()`) | Formulario                 | **Está**, y además **marcada como baja** en vez de reemplazar el conjunto: la base nunca borra lo que el cliente no vio (ADR 0015).                                                                                                   |
| `onInicioChange()` — entrega estimada      | Formulario                 | **Está.** 21 días hábiles, recalculada al cambiar el inicio. Sin feriados: la lista cambia por decreto todos los años y la fecha es editable a mano (anotado en el ADR 0015).                                                         |
| `verDetalle(id)`                           | Fila clickeable            | **Está.** `/proyectos/:id`, bastante más completa: pagos, gastos, entrega, comprobante, notas de obra y el despiece.                                                                                                                  |
| `eliminarProy(id)`                         | Detalle                    | **Está**, con confirmación. Un liquidado con pagos o gastos no se borra (`MN001`): se corrige reabriéndolo.                                                                                                                           |
| Marcar «Cobrado» en el `select` de estado  | Formulario                 | **Está, y cambiado a propósito.** Cobrar es una operación con pantalla propia (`/proyectos/:id/cobrar`), no un valor del combo: reparte plata y congela el reparto. El combo la rechaza con `MN007`.                                  |
| —                                          | No existía                 | **Nuevo:** dar por perdido, reabrir un cobro y reactivar un perdido. El original no tenía estados de prospecto ni de perdido.                                                                                                         |
| —                                          | No existía                 | **Nuevo, pedido en los audios:** Seguimiento. Cargar un contacto con su seña, avanzarlo por etapas, llamar o escribirle por WhatsApp, aprobarlo (pasa a Activos con la seña adentro) o perderlo (liquida la seña). Ver la sección 8.  |
| `abrirMovForm()`                           | Botón «+ Movimiento»       | **Está.** Formulario de movimiento en Finanzas.                                                                                                                                                                                       |
| `onTipoChange()` — categorías y ayuda      | Formulario de movimiento   | **Está.** Los lados de cada tipo y el texto de ayuda.                                                                                                                                                                                 |
| `guardarMovimiento()`                      | Formulario de movimiento   | **Está.**                                                                                                                                                                                                                             |
| `abrirMovForm('pago_diezmo')`              | Botón de la pestaña Diezmo | **Está.** «Registrar un pago» abre el formulario con el tipo ya elegido.                                                                                                                                                              |
| `guardarCfg()`                             | Configuración              | **Está.** Sueldo, costos fijos, meta de Cocos, tasa, el nombre del taller, y el ajuste del saldo de COCOS con su asiento automático.                                                                                                  |
| `exportarCSV()`                            | Cabecera de Proyectos      | **Falta, sin agendar.** Ver la pregunta 1 al final: **no estaba en Configuración**, y el original también tiene **importación**. Es lo único de la interfaz vieja que sigue sin lugar en el plan.                                     |
| `importarCSV()`                            | Cabecera de Proyectos      | **No se replica en la app** (ADR 0017): un upsert por id desde un archivo se saltea las guardas de estado y de versión. Lo que sí hace falta, traer una sola vez los datos del sistema viejo, es un script: `db:migrar` (sección 10). |
| `goSub('lista')` / `goSub('fin-panel')`    | Cancelar                   | **Está.** Cancelar y volver, en los dos formularios.                                                                                                                                                                                  |

---

## 3. Las cuatro pestañas y sus paneles

| Panel del original                               | Hoy                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Proyectos** · métricas (4 tarjetas)            | **Está.** Total, en curso, entregados con saldo, cobrados. El original mostraba además la suma de presupuestos de los cobrados.                                                                                                                                                                                                                                                              |
| **Proyectos** · tabla de 7 columnas              | **Está**, y ordenable por las siete, con buscador, filtro por estado y tarjetas en el celular. **Activos muestra solo lo aprobado**: los contactos viven en Seguimiento (ADR 0019).                                                                                                                                                                                                          |
| **Proyectos** · formulario                       | **Está.** Era la peor pantalla del original: en el celular no se podía usar.                                                                                                                                                                                                                                                                                                                 |
| **Proyectos** · detalle                          | **Está.**                                                                                                                                                                                                                                                                                                                                                                                    |
| **Finanzas** · tarjetas de los cuatro tesoros    | **Está**, en Inicio.                                                                                                                                                                                                                                                                                                                                                                         |
| **Finanzas** · panel del mes (3 KPIs)            | **Está**, en Inicio: entró al hogar, gastó el hogar, facturó el taller, cada uno comparado con el mes anterior.                                                                                                                                                                                                                                                                              |
| **Finanzas** · mensaje de motivación             | **Está, sin la arenga.** Inicio distingue las mismas cinco situaciones (hogar en negativo, mes sin movimiento, sueldo cubierto, facturó el taller pero al hogar no entró nada, y cuánto falta) con el contenido informativo de cada una. Lo que no se portó es el tono: no hay felicitaciones ni «¡vamos con todo!».                                                                         |
| **Finanzas** · tres barras                       | **Está**, en Inicio: sueldo del mes, meta de Cocos, diezmo pagado vs generado. **La del sueldo mide distinto, a propósito.** El original sumaba todo lo que entró al hogar, docencia incluida, contra un sueldo, y con dos cobros se llenaba. Hoy mide el sueldo que pagaron los cobros del mes contra el que prometían: uno por cobro, porque el tope de sueldo es por proyecto (ADR 0011). |
| **Finanzas** · proyección de Cocos               | **Está**, en Inicio. El original la calculaba contra el **31/12/2026 hardcodeado**; hoy es a 365 días.                                                                                                                                                                                                                                                                                       |
| **Finanzas** · historial de movimientos          | **Está**, y bastante más: agrupado por día con el neto del día, filtros por tesoro, por sentido y por mes, buscador, y lo que sigue en la cola marcado como «sin confirmar». La tabla de cuatro columnas del original pasó a ser una lista que se puede usar en el celular.                                                                                                                  |
| **Diezmo** · tarjeta de saldo, barra e historial | **Está.** La tarjeta dice una frase en vez de un número con signo (ADR 0018), la barra es pagado sobre generado, y el historial junta lo generado y lo pagado.                                                                                                                                                                                                                               |
| **Configuración** · sueldo, fijos, meta, tasa    | **Está**, en Ajustes.                                                                                                                                                                                                                                                                                                                                                                        |
| **Configuración** · saldos de sólo lectura       | **No se replica así.** Los saldos se ven en Inicio, que es donde se miran. Repetirlos en Ajustes era el lugar donde se los editaba.                                                                                                                                                                                                                                                          |
| **Configuración** · saldo de COCOS editable      | **Está**, con la misma mecánica: se escribe el saldo real, la app calcula la diferencia y genera el asiento, con el concepto según el signo.                                                                                                                                                                                                                                                 |
| —                                                | **Agregado nuestro, no paridad:** la comparación del mes contra el anterior, con el gráfico de barras y la tabla con los mismos números. **El HTML original no tiene ningún gráfico** (se buscó `canvas`, `chart` y `svg` en sus 886 líneas y no hay nada).                                                                                                                                  |

---

## 4. Lo que se calcula y se muestra

| Cálculo del original               | Hoy                                                                                                                                                                                                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Saldo HOGAR                        | **Está.** De la vista `libro_mayor`, no de una suma a mano.                                                                                                                                                                                                         |
| Saldo MAUN                         | **Está.**                                                                                                                                                                                                                                                           |
| Saldo DIEZMO (`pagado − generado`) | **Está, y no se muestra como saldo.** La base acumula `generado − pagado`, que es lo que falta pagar, y la app lo dice con una frase: «Debés $X», «Estás al día», «Pagaste $X de más». Nadie tiene que interpretar un signo para saber si está en falta (ADR 0018). |
| Saldo COCOS                        | **Está.**                                                                                                                                                                                                                                                           |
| `calcProy()` — la cascada          | **Está, corregida.** Reparte sobre **lo cobrado**, no sobre el presupuesto (error 1 del ADR 0003). Ver la sección 5.                                                                                                                                                |
| Saldo pendiente por proyecto       | **Está.**                                                                                                                                                                                                                                                           |
| Días hábiles de entrega            | **Está.**                                                                                                                                                                                                                                                           |
| Porcentajes de las barras          | **Está.**                                                                                                                                                                                                                                                           |
| Proyección de Cocos con tasa anual | **Está.** El original componía diario (`(1+tasa/365)^días`); hoy es `(1+tasa)^(días/365)`, que es la misma tasa anual efectiva.                                                                                                                                     |

---

## 5. La cascada, contra la del original

La función se llama **`calcProy()`**, no `distribuir()`: no hay ninguna función con
ese nombre en el archivo. Las diferencias, todas a propósito:

|               | Original (`calcProy`)                                                                                | Hoy (`calcularDistribucion` + `topesDeLaLiquidacion`)                                 |
| ------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Base          | `presupuesto − gastos`                                                                               | `cobrado − gastos` (**error 1**, ADR 0003)                                            |
| Diezmo        | `round(neta × 0.10)`                                                                                 | `floor((neta × 1000 + 5000) / 10000)`: la misma cuenta, con enteros                   |
| Sueldo        | `min(cfg.sueldo, resto)`                                                                             | igual, pero con el tope que sale del mes cuando `sueldo_tope_mensual` está prendido   |
| Fijos         | `min(cfg.fijos, resto)`, **por proyecto**                                                            | tope **mensual**: `max(0, objetivo − lo que el mes ya lleva)` (ADR 0011)              |
| Remanente     | `max(0, resto)`                                                                                      | `resto`, que puede ser negativo                                                       |
| Neta negativa | el sueldo sale negativo y el `max(0, ...)` del remanente **hace que los escalones no sumen la neta** | todo en cero y la pérdida entera en el remanente: los escalones siempre suman la neta |

**La cuarta diferencia es esa última fila, y es un hallazgo.** No está en la lista de tres errores del
ADR 0003. Con la neta negativa, el original calcula `sueldo = min(cfg.sueldo, despDiezmo)` sin piso,
así que el sueldo queda negativo, y después `rem = max(0, despSueldo - fijos)` recorta a cero. El
resultado es que los cuatro escalones no suman la ganancia neta y parte de la pérdida desaparece de
la cuenta. En la práctica casi no se veía, porque la neta se calculaba sobre el presupuesto y rara
vez daba negativa. Hoy la base lo impide con un `check` (`proyectos_distribucion_cuadra`).

**Verificación hecha a mano** (paso 9, con sueldo $500.000 y fijos $250.000, cobro de $700.000 sin
gastos): `neta 700.000 → diezmo 70.000 → sueldo 500.000 → fijos 130.000 → remanente 0`. El original,
con el mismo presupuesto y los mismos gastos, da exactamente lo mismo: `700.000 − 0 = 700.000`,
`round(70.000)`, `min(500.000, 630.000)`, `min(250.000, 130.000)`, `max(0, 0)`. Coinciden porque en
este caso lo cobrado **es** el presupuesto y los fijos no estaban cubiertos todavía. En cuanto hay un
segundo cobro en el mes, se separan: el original vuelve a descontar los fijos enteros y esta base
solo lo que falta.

---

## 6. Las dos preguntas

**1. ¿Ajustes tiene exportación de datos?** **No: está en Proyectos, no en Configuración.** El botón
«↓ Exportar CSV» vive en la cabecera de la pestaña Proyectos, al lado de «+ Nuevo
proyecto». Y **hay también una importación** que el pedido no mencionaba: un `<input type="file">`
disfrazado de botón, «↑ Importar CSV», que hace upsert por id y avisa cuántos entraron y
cuántos se actualizaron.

Lo demás es como decías: el CSV **solo cubre proyectos**, con diez columnas y los pagos y los insumos
embebidos como JSON en dos de ellas (`pagos_json`, `insumos_json`). Los movimientos (`M`) y la
configuración (`cfg`) quedan afuera, así que un backup del sistema viejo **pierde el libro mayor
entero y los cuatro parámetros**. Es una limitación suya.

**No lo construimos en este paso: hay que agendarlo.** Y conviene decidir dos cosas cuando llegue:
si la exportación es de todo el taller (que es lo que un backup necesita) y si la importación entra,
porque un upsert por id desde un archivo se saltea las guardas de estado y de versión.

**2. ¿Ajustes deja corregir el saldo de COCOS a mano?** **Sí, y es el único saldo editable.**
`guardarCfg()` lee el campo, calcula `diffCocos = nuevoSaldo − saldoCalculado` y, si
no es cero, genera un movimiento `ajuste_cocos` por la diferencia, con el concepto
«Ajuste COCOS (intereses/depósito)» o «(retiro/corrección)» según el signo. Los otros tres saldos son
`readonly`.

**Está, desde el paso 10**, con la misma mecánica: en Ajustes se escribe el saldo real, la app calcula
la diferencia contra el saldo que tenía y encola el `ajuste`. La diferencia y el concepto se muestran
**antes** de apretar el botón.

El ajuste que suma entra como `(null → cocos)`, que es «viene de afuera», y para los intereses eso es
literalmente cierto. El que resta sale como `(cocos → null)`. Un ajuste ya generado no se edita: se
compensa con otro, y la ficha del movimiento lo explica con el control deshabilitado (ADR 0018).

---

## 7. Lo que la app tiene y el original no

Para que la tabla no quede coja: réplica offline con cola de salida ordenada, multi-usuario con
aislamiento por household, clientes como entidad propia con CUIT y condición fiscal, estados de
seguimiento y de perdido, distribución congelada con su historia, topes mensuales, reapertura,
libro mayor con contrapartida en todos los asientos, y la app instalable en el celular.

Del paso 10, agregados por encima del original:

- **La comparación del mes contra el anterior**, con gráfico de barras y tabla. El HTML no tiene
  ningún gráfico.
- **Filtros y búsqueda en el libro** (tesoro, sentido, mes, texto). El original lista todo junto,
  siempre.
- **Lo que sigue en la cola se ve marcado** fila por fila («sin confirmar»).
- **Los movimientos cargados a mano se editan y se borran.** En el original, una vez cargado un
  movimiento no se puede tocar.
- **Lo derivado de un proyecto y los ajustes dicen por qué no se tocan**, con el control deshabilitado
  y el camino, en vez de no existir.

Del paso 11:

- **Seguimiento entero**: el original no tenía nada antes del presupuesto.
- **Llamar y WhatsApp** desde la tarjeta y la ficha del contacto.
- **La espera escrita como frase** («Presupuesto enviado hace 9 días, sin respuesta») y la lista
  ordenada por eso, sin un campo nuevo que llenar.

Del paso 12:

- **La espera cuenta desde el último contacto**, que anotan solos los pasos del seguimiento. Corregir
  una nota ya no la reinicia.
- **La barra del sueldo del mes dice algo con cualquier cantidad de cobros**: el original se llenaba
  con el primero.

---

## 8. Seguimiento, contra lo que obligaba el original

Lo que el HTML hacía con un trabajo que todavía no estaba aprobado, y qué pasa hoy (ADR 0019).

| Comportamiento del original                                          | Hoy                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `guardarProy()` exige presupuesto                                    | **No se replica.** Un contacto se guarda con cliente y qué pide. El presupuesto llega en «Mandé el presupuesto», opcional, o en el pasaje, obligatorio.                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Cargar un pago en `presupuestado` lo pasa solo a `en_curso`          | **No se replica.** Ningún estado cambia solo. Aprobar es una pantalla propia (`/proyectos/:id/aprobar`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Cuatro estados: `presupuestado`, `en_curso`, `entregado`, `cobrado`  | **Ampliado.** Cuatro de seguimiento (contacto, relevamiento, a presupuestar, presupuesto enviado), dos de obra, cobrado y perdido. Existen desde la 2A.                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Los pagos entran a MAUN en cualquier estado                          | **Está, igual.** La seña de la visita entra a la caja el día que se carga, y al aprobar sigue siendo el mismo pago: no se vuelve a cargar ni se duplica.                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Los insumos **no** salen de MAUN mientras está en `presupuestado`    | **No se replica, a propósito: es una diferencia deliberada.** La vista `libro_mayor` descuenta un gasto el día que se carga, en cualquier estado. En el original, `presupuestado` era el estacionamiento de todo lo que todavía no era un trabajo, porque no existía Seguimiento. Hoy el estado tiene sentido propio, y la plata de la nafta salió de verdad. `cerrar_perdido` ya netea esos gastos contra la seña retenida, así que la cuenta cierra. Volver a lo del original sería replicar un rodeo para un problema que ya no existe. Decidido con el dueño en el paso 12 (ADR 0019). |
| Un presupuesto que no prosperó queda para siempre en `presupuestado` | **Corregido.** Se da por perdido, y la seña se liquida: diezmo sí, sueldo no (ADR 0011).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

---

## 9. Pantallas del diseño que no se construyen

| Pantalla de `design-reference/` | Veredicto                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Despiece.dc.html`              | **Obsoleta como pantalla.** Es la especificación de un componente, no una página, y ya está portada como `DistribucionDespiece` en la ficha y en el cobro (pasos 8 y 9). Calcula sobre el presupuesto, que es el error 1 del ADR 0003. Lo único sin portar son las cotas de carpintería y la franja rayada de «no alcanza»: el «faltan $X» ya está en la leyenda. |
| `Seguimiento.dc.html`           | **Portada sin el tablero.** En escritorio dibuja cuatro columnas por etapa; se construyó una lista ordenada por espera (ADR 0019). Se portaron las tarjetas, llamar y WhatsApp, la marca de «frío» a los siete días, el pasaje con la seña y el saldo, y el formulario liviano.                                                                                   |

---

## 10. Los datos del sistema viejo

Lo que el dueño tiene en el `localStorage` del HTML entra una sola vez, con
`pnpm --filter @maun/db db:migrar`, primero en ensayo (ADR 0017).

| Del sistema viejo                        | Entra como                                                                                                                                                              |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `p.cliente`, texto libre                 | Un cliente por nombre normalizado: sin acentos ni mayúsculas, espacios colapsados, sin puntuación al final, y la ñ se respeta. El script muestra los grupos y pregunta. |
| `presupuestado`                          | `presupuesto_enviado`, en Seguimiento, con el último contacto en el día que se cargó.                                                                                   |
| `en_curso` y `entregado`                 | Los mismos estados, con sus pagos y sus gastos.                                                                                                                         |
| `cobrado`                                | Cobrado por `cobrar_proyecto`, con el reparto **recalculado con las reglas de hoy** y la fecha del último pago. No el reparto que mostraba el sistema viejo.            |
| Pagos e insumos                          | Pagos y gastos del proyecto. Un insumo sin monto no entra, como tampoco contaba antes.                                                                                  |
| Los nueve tipos de movimiento a mano     | Movimientos, con el mapeo de la sección 1.                                                                                                                              |
| Movimientos con `proyId` y los derivados | No entran: los arma la vista `libro_mayor`.                                                                                                                             |
| `maun3_c`                                | Los ajustes: sueldo, costos fijos, meta y tasa de Cocos.                                                                                                                |
| Los cuatro saldos del día del corte      | Un asiento de apertura por tesoro, por la diferencia. Los saldos quedan exactamente como el dueño los leyó.                                                             |

**Lo que el dueño va a notar:** el reparto de cada cobro viejo cambia, porque el sistema viejo repartía
sobre el presupuesto y con los errores de la sección 5. Los cuatro saldos no cambian: la apertura
absorbe la diferencia. El informe del script pone cada cobro recalculado al lado de lo que el sistema
viejo había registrado para ese proyecto.
