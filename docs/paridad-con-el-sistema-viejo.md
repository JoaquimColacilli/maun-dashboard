# Paridad con el sistema viejo

Qué sabe hacer `docs/referencia/Finanzas_MAUN_v3.html` y dónde está eso hoy. La referencia es el
HTML con localStorage que el dueño usa en este momento; no confundir con `design-reference/`, que es
el rediseño.

Leyenda de la última columna: **está** (funciona hoy), **falta** (no está, y en qué paso queda), **no
se replica** (decisión tomada, con el motivo).

Actualizado en el paso 9 (cobro y liquidación).

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
| `ajuste_cocos`    | `cocos += diferencia`, al guardar la config       | **Falta el generador.** El tipo `ajuste` existe y se carga a mano en Finanzas; lo que no está es corregir el saldo de COCOS escribiendo el número nuevo. Ver la pregunta 2 al final.                                      |
| `ajuste_hogar`    | `hogar += monto`                                  | **No se replica.** Código muerto en el original: está en `calcTesoros` y en `tesoroLabel`, y **nada lo genera nunca**.                                                                                                    |
| `ajuste_maun`     | `maun += monto`                                   | **No se replica.** Código muerto, igual que el anterior.                                                                                                                                                                  |

---

## 2. Cada acción de la interfaz

Sale de los `onclick` y `onchange` del archivo.

| Acción del original                        | Dónde estaba               | Hoy                                                                                                                                                                                                                               |
| ------------------------------------------ | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `goTab('proy')`                            | Nav                        | **Está.** Proyectos, con tres pestañas (`Seguimiento · Activos · Historial`) que el original no tenía.                                                                                                                            |
| `goTab('fin')`                             | Nav                        | **Parcial.** La sección existe y carga movimientos; el libro mayor llega en el paso que viene.                                                                                                                                    |
| `goTab('diezmo')`                          | Nav                        | **Falta.** Pantalla del paso que viene. El saldo de diezmo ya se ve en Inicio.                                                                                                                                                    |
| `goTab('cfg')`                             | Nav                        | **Está.** Ajustes.                                                                                                                                                                                                                |
| `abrirForm(null)` — nuevo proyecto         | Botón «+ Nuevo proyecto»   | **Está.** `/proyectos/nuevo`.                                                                                                                                                                                                     |
| `abrirForm(id)` — editar proyecto          | Fila y detalle             | **Está.** `/proyectos/:id/editar`.                                                                                                                                                                                                |
| `guardarProy()`                            | Formulario                 | **Está**, y en una sola transacción con sus pagos y gastos (`guardar_proyecto`, ADR 0015). El original promovía solo `presupuestado → en_curso` si había pagos; hoy el estado lo elige el usuario entre las transiciones válidas. |
| `addPago()` / `addInsumo()`                | Formulario                 | **Está.** Filas dinámicas, con deshacer al quitar una con datos.                                                                                                                                                                  |
| Quitar una fila (`parentElement.remove()`) | Formulario                 | **Está**, y además **marcada como baja** en vez de reemplazar el conjunto: la base nunca borra lo que el cliente no vio (ADR 0015).                                                                                               |
| `onInicioChange()` — entrega estimada      | Formulario                 | **Está.** 21 días hábiles, recalculada al cambiar el inicio. Sin feriados: la lista cambia por decreto todos los años y la fecha es editable a mano (anotado en el ADR 0015).                                                     |
| `verDetalle(id)`                           | Fila clickeable            | **Está.** `/proyectos/:id`, bastante más completa: pagos, gastos, entrega, comprobante, notas de obra y el despiece.                                                                                                              |
| `eliminarProy(id)`                         | Detalle                    | **Está**, con confirmación. Un liquidado con pagos o gastos no se borra (`MN001`): se corrige reabriéndolo.                                                                                                                       |
| Marcar «Cobrado» en el `select` de estado  | Formulario                 | **Está, y cambiado a propósito.** Cobrar es una operación con pantalla propia (`/proyectos/:id/cobrar`), no un valor del combo: reparte plata y congela el reparto. El combo la rechaza con `MN007`.                              |
| —                                          | No existía                 | **Nuevo:** dar por perdido, reabrir un cobro y reactivar un perdido. El original no tenía estados de prospecto ni de perdido.                                                                                                     |
| `abrirMovForm()`                           | Botón «+ Movimiento»       | **Está.** Formulario de movimiento en Finanzas.                                                                                                                                                                                   |
| `onTipoChange()` — categorías y ayuda      | Formulario de movimiento   | **Está.** Los lados de cada tipo y el texto de ayuda.                                                                                                                                                                             |
| `guardarMovimiento()`                      | Formulario de movimiento   | **Está.**                                                                                                                                                                                                                         |
| `abrirMovForm('pago_diezmo')`              | Botón de la pestaña Diezmo | **Falta.** El tipo existe; el atajo desde la pantalla de Diezmo llega con esa pantalla.                                                                                                                                           |
| `guardarCfg()`                             | Configuración              | **Parcial.** Se guardan sueldo, costos fijos, meta de Cocos y tasa, más el nombre del taller. **No** está el ajuste del saldo de COCOS.                                                                                           |
| `exportarCSV()`                            | Cabecera de Proyectos      | **Falta.** Ver la pregunta 1 al final: **no estaba en Configuración**, y el original también tiene **importación**.                                                                                                               |
| `importarCSV()`                            | Cabecera de Proyectos      | **Falta.** No estaba en el pedido; queda anotado acá para que no se pierda.                                                                                                                                                       |
| `goSub('lista')` / `goSub('fin-panel')`    | Cancelar                   | **Está.** Cancelar y volver, en los dos formularios.                                                                                                                                                                              |

---

## 3. Las cuatro pestañas y sus paneles

| Panel del original                               | Hoy                                                                                                                                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Proyectos** · métricas (4 tarjetas)            | **Está.** Total, en curso, entregados con saldo, cobrados. El original mostraba además la suma de presupuestos de los cobrados.                                                 |
| **Proyectos** · tabla de 7 columnas              | **Está**, y ordenable por las siete, con buscador, filtro por estado y tarjetas en el celular.                                                                                  |
| **Proyectos** · formulario                       | **Está.** Era la peor pantalla del original: en el celular no se podía usar.                                                                                                    |
| **Proyectos** · detalle                          | **Está.**                                                                                                                                                                       |
| **Finanzas** · tarjetas de los cuatro tesoros    | **Está**, en Inicio.                                                                                                                                                            |
| **Finanzas** · panel del mes (3 KPIs)            | **Está**, en Inicio: entró al hogar, gastó el hogar, facturó el taller, cada uno comparado con el mes anterior.                                                                 |
| **Finanzas** · mensaje de motivación             | **Parcial.** Inicio dice si el sueldo del mes está cubierto y cuánto falta. Las cinco variantes de texto del original no se portaron: es una sola línea, sin el tono de arenga. |
| **Finanzas** · tres barras                       | **Está**, en Inicio: sueldo del mes, meta de Cocos, diezmo pagado vs generado.                                                                                                  |
| **Finanzas** · proyección de Cocos               | **Está**, en Inicio. El original la calculaba contra el **31/12/2026 hardcodeado**; hoy es a 365 días.                                                                          |
| **Finanzas** · historial de movimientos          | **Falta.** Es la pantalla del paso que viene.                                                                                                                                   |
| **Diezmo** · tarjeta de saldo, barra e historial | **Falta.** Paso que viene. El saldo ya se ve en Inicio.                                                                                                                         |
| **Configuración** · sueldo, fijos, meta, tasa    | **Está**, en Ajustes.                                                                                                                                                           |
| **Configuración** · saldos de sólo lectura       | **No se replica así.** Los saldos se ven en Inicio, que es donde se miran. Repetirlos en Ajustes era el lugar donde se los editaba.                                             |
| **Configuración** · saldo de COCOS editable      | **Falta.** Ver la pregunta 2.                                                                                                                                                   |

---

## 4. Lo que se calcula y se muestra

| Cálculo del original               | Hoy                                                                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Saldo HOGAR                        | **Está.** De la vista `libro_mayor`, no de una suma a mano.                                                                     |
| Saldo MAUN                         | **Está.**                                                                                                                       |
| Saldo DIEZMO (`pagado − generado`) | **Está**, con el mismo signo: positivo a favor, negativo en deuda.                                                              |
| Saldo COCOS                        | **Está.**                                                                                                                       |
| `calcProy()` — la cascada          | **Está, corregida.** Reparte sobre **lo cobrado**, no sobre el presupuesto (error 1 del ADR 0003). Ver la sección 5.            |
| Saldo pendiente por proyecto       | **Está.**                                                                                                                       |
| Días hábiles de entrega            | **Está.**                                                                                                                       |
| Porcentajes de las barras          | **Está.**                                                                                                                       |
| Proyección de Cocos con tasa anual | **Está.** El original componía diario (`(1+tasa/365)^días`); hoy es `(1+tasa)^(días/365)`, que es la misma tasa anual efectiva. |

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

**Falta en la app.** El tipo `ajuste` existe en la base y se puede cargar a mano desde Finanzas, pero
hay que hacer la resta uno mismo. El camino corto es el mismo que el viejo: un campo en Ajustes que
compare contra el saldo calculado y encole el movimiento por la diferencia. Queda para el paso de
Finanzas, que es donde va a estar el libro mayor.

Un detalle para ese día: el original **no pide contrapartida** para ese ajuste — la plata aparece en
COCOS y no sale de ningún lado. En esta base todo movimiento tiene los dos lados, así que un ajuste
de intereses entra como `(null → cocos)`, que es «de afuera», y eso está bien: los intereses vienen
de afuera del taller. Un ajuste por corrección, en cambio, habría que pensarlo.

---

## 7. Lo que la app tiene y el original no

Para que la tabla no quede coja: réplica offline con cola de salida ordenada, multi-usuario con
aislamiento por household, clientes como entidad propia con CUIT y condición fiscal, estados de
seguimiento y de perdido, distribución congelada con su historia, topes mensuales, reapertura,
libro mayor con contrapartida en todos los asientos, y la app instalable en el celular.
