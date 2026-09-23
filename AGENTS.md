# MAUN dashboard

App de finanzas y proyectos de un taller de muebles a medida en Argentina. Reemplaza un HTML con localStorage. La usa una sola persona, desde la PC del taller y desde el celular con mala señal: es offline-first. Un usuario hoy, pero el aislamiento multi-tenant por `household_id` existe desde el día uno.

## Antes de dar un PR por terminado: las novedades

La app le muestra al dueño qué cambió cada vez que se actualiza. Una versión nueva es un PR mergeado a `main`: ahí sale el deploy a Netlify y le llega la actualización, así que la unidad es el PR, no el commit. El contenido es un archivo, `apps/web/src/features/ver-novedades/model/novedades.ts` (ADR 0041).

- Todo PR que cambie algo que el usuario pueda notar agrega una entrada nueva, arriba de todo en ese archivo, con su número de versión: la fecha (`AAAA-MM-DD`, o `AAAA-MM-DD.2` si ya hay otra ese día).
- La entrada se escribe en el idioma de él: qué puede hacer ahora que antes no podía. Sin nombres de tablas, sin nombres de paquetes, sin emojis, sin mencionar a ninguna IA.
- Tres o cuatro líneas como máximo. Lo que no cambia lo que él puede hacer, no va.
- Un PR que no cambia nada visible, como un arreglo interno o una reorganización, no agrega entrada. Forzar una novedad donde no la hay entrena a ignorarlas.
- El número de versión se sube en el mismo PR, no después. La versión de la app es la de la entrada más nueva: agregar la entrada es subirla.

## Estructura

| Carpeta           | Qué es                                                                 |
| ----------------- | ---------------------------------------------------------------------- |
| `apps/web`        | React + Vite + Tailwind 4, PWA. Feature-Sliced Design en cuatro capas. |
| `packages/domain` | Lógica de negocio pura: Money, cascada, estados. Cero dependencias.    |
| `packages/db`     | Tipos generados de Postgres y factory del cliente de Supabase.         |
| `packages/ui`     | Sistema de diseño: tokens y componentes. No importa nada del monorepo. |
| `packages/config` | tsconfig y ESLint compartidos.                                         |
| `supabase/`       | Migraciones a mano, tests pgTAP, seed y el snapshot `esquema.sql`.     |
| `docs/adr/`       | Decisiones de arquitectura. Leé el ADR antes de reabrir una decisión.  |

Las dependencias van en una sola dirección: `apps/web` usa `ui`, `domain` y `db`; `db` puede usar `domain`; `ui` y `domain` no usan nada del monorepo. Cada paquete tiene su `CLAUDE.md` con las reglas locales: el más cercano al archivo que editás es el que manda.

## Glosario

Las palabras de la app son las del dueño. En el código del front se usan las mismas; en la base quedan los nombres de antes, que no se renombran por un cambio de texto (ADR 0064).

| Palabra          | Qué es                                                                                                                                                                                                | En la base                                                                                                |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Consultas        | Los trabajos que todavía no se aprobaron: contacto, estimativo enviado, relevamiento, a presupuestar y presupuesto enviado. Hasta el ADR 0064 esta pestaña se llamaba Seguimiento. Ruta `/consultas`. | Los cinco estados del embudo; tests y funciones viejas dicen «seguimiento» (`20_embudo_del_seguimiento`). |
| Seguimiento      | Los que dijeron «por ahora no»: el trabajo sigue vivo y tiene el día en que hay que volver a escribirle. Pestaña entre Consultas y Activos, `/proyectos?etapa=seguimiento`.                           | Estado `en_seguimiento` y la tabla `proximos_contactos`.                                                  |
| Próximo contacto | El día en que se le vuelve a escribir a alguien en seguimiento. Registrarlo lo deja como historia, con el día, el resultado y lo que contestó.                                                        | Una fila de `proximos_contactos`; a lo sumo una pendiente por trabajo.                                    |
| Activos          | Los trabajos aprobados, en curso o entregados sin cobrar.                                                                                                                                             | `en_curso` y `entregado`.                                                                                 |
| Historial        | Lo cobrado y lo perdido.                                                                                                                                                                              | `cobrado` y `perdido`.                                                                                    |
| Perdido          | El cliente dijo que no. Se cierra con lo que corresponde a la seña retenida.                                                                                                                          | `perdido`, por `liquidar_proyecto`.                                                                       |
| Apertura         | La foto de la plata del día en que empezó con la app (2026-09-14). Lo anterior a esa fecha puede estar «ya en los saldos» y no mover los tesoros (ADR 0063).                                          | Movimientos de ajuste con categoría `Apertura`; `ya_en_la_apertura` y `reparto_ya_en_la_apertura`.        |
| Aviso de cambios | El timbre que le avisa a la app abierta que algo cambió, para que pida el delta. No lleva datos (ADR 0065).                                                                                           | Trigger `avisar_los_cambios`, canal `cambios:<household_id>`.                                             |

## Comandos (desde la raíz)

```sh
pnpm install
pnpm dev                          # levanta apps/web
pnpm verify                       # turbo: lint, typecheck, test, build, el arnés del aviso de versión y el test del reparto (obligatorio antes de pushear)
pnpm e2e                          # Playwright (una vez: pnpm --filter @maun/web exec playwright install chromium)
pnpm format                       # prettier --write
pnpm --filter @maun/<paquete> <script>
```

## Reglas que valen en todo el repo

- Plata: centavos enteros. `bigint` en la columna de Postgres; en TypeScript, `Money`, un `number` entero con brand. Nunca decimales, float ni `BigInt` de JavaScript (ADR 0002).
- TypeScript estricto. `any`, `@ts-ignore` y `eslint-disable` para esquivar una frontera no se aceptan: si una regla estorba, se discute con un ADR.
- No hay CI: el repo es privado y no usa GitHub Actions. `pnpm verify` es la verificación obligatoria antes de pushear.
- Las fronteras entre paquetes y entre capas las aplica ESLint y hacen fallar `pnpm verify`. No son una sugerencia.
- Versiones de dependencias solo en el catalog de `pnpm-workspace.yaml`; los `package.json` usan `catalog:`.
- Sin comentarios explicativos en el código TypeScript. El porqué va a un ADR o al PR. Los `comment on` de SQL sí van: son metadata de la base.
- El esquema de la base se cambia con una migración nueva escrita a mano en `supabase/migrations/`, ensayada en transacción con `pnpm --filter @maun/db db:ensayo` y aplicada con `supabase db push`. Nunca se edita una migración ya aplicada ni se toca el esquema desde el dashboard (ADR 0008).
- Hay un solo proyecto de Supabase y es producción. Los tests corren siempre en rollback, el seed vive en su propio household, y una migración destructiva sobre una tabla con datos se frena y se consulta antes de aplicarla.
- En el cliente solo existen `VITE_SUPABASE_URL` y la publishable key. La secret key y la service_role no entran al repo ni al bundle.

## Git

- Los agentes no commitean ni pushean salvo que el usuario lo pida; si no lo pide, dejan los comandos listos para que los corra él. Cuando lo pide: nunca sobre `main` (se trabaja en una rama `feature/NN-descripcion` y el PR se abre a mano), con la identidad ya configurada en git (sin `--author`) y con `pnpm verify` en verde antes del push.
- `git add` por ruta explícita, archivo por archivo. Nunca `git add .`, `-A` ni `-p`.
- Commits atómicos. Mensaje de una línea, en minúscula, en español simple, sin prefijos tipo `feat:`, sin trailers (`Co-Authored-By`, "generated with", "assisted by") y sin mencionar a una IA.
- El pre-commit corre lint-staged solo sobre lo staged y no modifica ni agrega archivos: si falla, corré `pnpm format` o arreglá el lint y volvé a agregar esos archivos.
