import { HITO_DEL_ESTIMATIVO, NOTA_DEL_RELEVAMIENTO } from '@maun/domain';
import { useState } from 'react';

import { useAnchoDePantalla } from '@/shared/lib';
import { Button, ConSalida, Hoja, Icono, type NombreDeIcono } from '@/shared/ui';

interface Fila {
  clave: string;
  paso?: number;
  icono?: NombreDeIcono;
  titulo: string;
  texto: string;
}

interface Lamina {
  id: string;
  titulo: string;
  entrada?: string;
  filas: readonly Fila[];
  pie?: string;
}

const LAMINAS: readonly Lamina[] = [
  {
    id: 'enlace',
    titulo: 'El enlace y la pantalla',
    entrada:
      'Cada trabajo tiene su enlace. Tu cliente lo abre del celular, sin cuenta ni contraseña.',
    filas: [
      {
        clave: 'no-vence',
        icono: 'link-2',
        titulo: 'No vence',
        texto:
          'Se lo pasás una vez y le sirve siempre. Deja de andar solo si lo das de baja o si das el trabajo por perdido.',
      },
      {
        clave: 'se-actualiza',
        icono: 'refresh-cw',
        titulo: 'Se actualiza sola',
        texto: 'Cada vez que la abre ve lo último que cargaste. No hay que avisarle nada.',
      },
      {
        clave: 'lo-mismo',
        icono: 'eye',
        titulo: 'Es lo que ves vos',
        texto: '«Ver cómo lo ve él» y el enlace muestran la misma pantalla, salida del mismo lado.',
      },
      {
        clave: 'silencio',
        icono: 'clock',
        titulo: 'Fechas, no cuentas',
        texto:
          'Le muestra el día de cada paso y qué sigue. Nunca cuánto hace que no pasa nada: eso lo pone a contar contra vos, y una obra lleva semanas sin nada que se vea.',
      },
    ],
  },
  {
    id: 'antes',
    titulo: 'Antes del presupuesto',
    filas: [
      {
        clave: 'estimativo',
        icono: 'send',
        titulo: HITO_DEL_ESTIMATIVO.etiqueta,
        texto:
          'Solo si le mandaste un estimativo: le aparece como un paso antes del presupuesto, con el día que tocaste «Mandé el estimativo». El número no lo ve nunca.',
      },
      {
        clave: 'relevamiento',
        icono: 'info',
        titulo: NOTA_DEL_RELEVAMIENTO.pendiente.titulo,
        texto:
          'Con el estimativo mandado y la visita pendiente, al lado del paso en curso le aparece una (i) que se lo explica, con el día de la visita si ya está agendada. Cuando tocás «Ya fui a relevar», le cuenta que el número sale de las medidas. Al aprobarlo, se va.',
      },
      {
        clave: 'sin-medir',
        icono: 'route',
        titulo: 'Si no hace falta medir',
        texto:
          'Pasalo a «A presupuestar» sin cargar la visita y la (i) no aparece. Mientras está en contacto o con el estimativo enviado, él lee que lo próximo es ir a medir.',
      },
      {
        clave: 'sin-nada',
        icono: 'message-circle',
        titulo: 'Sin nada mandado todavía',
        texto:
          'El enlace igual funciona: ve el trabajo y el camino entero, con el primer paso en curso.',
      },
    ],
  },
  {
    id: 'presupuesto',
    titulo: 'El presupuesto y la aprobación',
    filas: [
      {
        clave: 'paso-1',
        paso: 1,
        titulo: 'Presupuesto enviado',
        texto:
          'Es el primer paso de todo trabajo que no tuvo estimativo. La fecha aparece el día que ponés el contacto en «Presupuesto enviado».',
      },
      {
        clave: 'paso-2',
        paso: 2,
        titulo: 'Aprobado, seña cobrada',
        texto:
          'Se marca cuando pasás el trabajo a Proyectos. La seña que cargues ahí le aparece en «Lo que pagaste».',
      },
    ],
    pie: 'Si la fecha de inicio que cargaste al aprobar es de hoy o de antes, el camino salta derecho al paso 3.',
  },
  {
    id: 'taller',
    titulo: 'El taller y la entrega',
    filas: [
      {
        clave: 'paso-3',
        paso: 3,
        titulo: 'En fabricación',
        texto:
          'No se marca al aprobar: se marca el día de la fecha de inicio que cargaste. Hasta que llegue, él lee que está en la cola del taller.',
      },
      {
        clave: 'paso-4',
        paso: 4,
        titulo: 'Entregado',
        texto: 'Se marca cuando tocás «Ya lo entregué», con la fecha de ese día.',
      },
      {
        clave: 'pautada',
        icono: 'calendar-days',
        titulo: 'La fecha pautada',
        texto:
          'La entrega estimada que cargaste la lee como «Entrega pautada». Si la movés, la próxima vez que abra ve la nueva.',
      },
    ],
    pie: 'Sin fecha de inicio cargada, el paso 3 no se marca nunca, aunque el trabajo esté en curso.',
  },
  {
    id: 'saldo',
    titulo: 'Cuando queda saldado',
    filas: [
      {
        clave: 'paso-5',
        paso: 5,
        titulo: 'Pagado',
        texto:
          'Se marca cuando el mueble ya está entregado y no queda saldo, o cuando cerrás el trabajo con «Cobrar y repartir».',
      },
      {
        clave: 'foco',
        icono: 'hand-coins',
        titulo: 'Si te debe, el saldo manda',
        texto:
          'Entregado y con plata pendiente, la pantalla le pone el saldo arriba de todo y más grande que el estado.',
      },
      {
        clave: 'primero-la-entrega',
        icono: 'truck',
        titulo: 'Primero sale del taller',
        texto:
          'Aunque te pague todo antes, el paso 5 no se marca hasta que el mueble esté entregado.',
      },
      {
        clave: 'transferir',
        icono: 'copy',
        titulo: 'Cómo te transfiere',
        texto:
          'Si cargaste tus datos en Ajustes, los ve al lado del saldo, con un botón para copiar cada uno. Deja de verlos cuando queda todo pagado.',
      },
    ],
  },
  {
    id: 'atras',
    titulo: 'Volver atrás',
    entrada: 'Se puede, y no le rompe nada de lo que ya vio.',
    filas: [
      {
        clave: 'retrocede',
        icono: 'arrow-left-right',
        titulo: 'El camino retrocede',
        texto:
          'Si lo mandás para atrás, por ejemplo con «Volvió a presupuesto», él pasa a ver el paso donde está hoy.',
      },
      {
        clave: 'sin-rastro',
        icono: 'eye-off',
        titulo: 'No se entera',
        texto:
          'No le salta ningún aviso ni queda una línea en «Lo que fue pasando»: ve menos pasos marcados y nada más.',
      },
      {
        clave: 'fechas',
        icono: 'calendar-check',
        titulo: 'Las fechas quedan',
        texto: 'Lo ya anotado sigue guardado. Si volvés a avanzar, muestra las mismas de antes.',
      },
    ],
  },
  {
    id: 'nunca',
    titulo: 'Lo que nunca ve',
    filas: [
      {
        clave: 'tu-plata',
        icono: 'eye-off',
        titulo: 'Tu plata',
        texto:
          'Ni los costos, ni lo que te queda, ni el diezmo, ni el reparto, ni tus notas de obra, ni las opciones que no te aprobó.',
      },
      {
        clave: 'fotos',
        icono: 'image',
        titulo: 'Las fotos que no marcaste',
        texto:
          'Nacen apagadas, incluso las que ya tenías subidas. Solo ve las que prendés una por una en «Compartir».',
      },
      {
        clave: 'otros',
        icono: 'users',
        titulo: 'Otro trabajo',
        texto: 'El enlace abre ese mueble y nada más: ni otro trabajo suyo, ni otro cliente tuyo.',
      },
    ],
  },
];

function Marca({ fila }: { fila: Fila }) {
  if (fila.paso !== undefined) {
    return (
      <span
        aria-hidden
        className="flex size-7 flex-none items-center justify-center rounded-pill bg-ink text-label font-semibold text-paper tabular-nums"
      >
        {fila.paso}
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="flex size-7 flex-none items-center justify-center rounded-field bg-surface text-text-2"
    >
      <Icono nombre={fila.icono ?? 'circle'} tamano={16} />
    </span>
  );
}

function Carrusel({ alCerrar }: { alCerrar: () => void }) {
  const [indice, setIndice] = useState(0);
  const esLaPrimera = indice === 0;
  const esLaUltima = indice === LAMINAS.length - 1;

  function mover(cuanto: number): void {
    setIndice((actual) => Math.min(Math.max(actual + cuanto, 0), LAMINAS.length - 1));
  }

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      onKeyDown={(evento) => {
        if (evento.key === 'ArrowRight') mover(1);
        if (evento.key === 'ArrowLeft') mover(-1);
      }}
    >
      <div
        aria-live="polite"
        className="grid min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 md:px-6 md:py-5"
      >
        {LAMINAS.map((una, puesto) => (
          <div
            key={una.id}
            aria-hidden={puesto !== indice}
            className={`col-start-1 row-start-1 flex flex-col gap-3.5 self-start ${
              puesto === indice ? '' : 'invisible'
            }`}
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-meta font-medium text-text-3 tabular-nums">
                {puesto + 1} de {LAMINAS.length}
              </span>
              <h3 className="font-display text-lema leading-tight text-balance">{una.titulo}</h3>
              {una.entrada !== undefined && (
                <p className="mt-1 text-label leading-relaxed text-text-2">{una.entrada}</p>
              )}
            </div>

            <ul className="flex list-none flex-col gap-3.5">
              {una.filas.map((fila) => (
                <li key={fila.clave} className="flex gap-3">
                  <Marca fila={fila} />
                  <div className="min-w-0 flex-1">
                    <span className="block text-body-lg leading-snug font-semibold">
                      {fila.titulo}
                    </span>
                    <p className="mt-0.5 text-label leading-relaxed text-text-2">{fila.texto}</p>
                  </div>
                </li>
              ))}
            </ul>

            {una.pie !== undefined && (
              <p className="rounded-panel bg-surface-3 px-3.5 py-2.5 text-label leading-relaxed text-text-2">
                {una.pie}
              </p>
            )}
          </div>
        ))}
      </div>

      <footer className="flex flex-none items-center gap-3 border-t border-hairline px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:px-6 md:pb-3">
        <Button
          variant="secundario"
          disabled={esLaPrimera}
          onClick={() => {
            mover(-1);
          }}
        >
          <Icono nombre="chevron-left" tamano={16} />
          Atrás
        </Button>

        <span aria-hidden className="flex flex-1 items-center justify-center gap-1.5">
          {LAMINAS.map((una, puesto) => (
            <span
              key={una.id}
              className={`h-1.5 rounded-pill transition-[width,background-color] duration-(--dur-fast) ${
                puesto === indice ? 'w-5 bg-ink' : 'w-1.5 bg-border'
              }`}
            />
          ))}
        </span>

        {esLaUltima ? (
          <Button onClick={alCerrar}>Listo</Button>
        ) : (
          <Button
            onClick={() => {
              mover(1);
            }}
          >
            Siguiente
            <Icono nombre="chevron-right" tamano={16} />
          </Button>
        )}
      </footer>
    </div>
  );
}

export interface AyudaDeLaVistaProps {
  conTexto?: boolean;
}

export function AyudaDeLaVista({ conTexto = false }: AyudaDeLaVistaProps) {
  const [abierta, setAbierta] = useState(false);
  const enCelular = useAnchoDePantalla() === 'movil';

  function cerrar(): void {
    setAbierta(false);
  }

  return (
    <>
      <Button
        variant="secundario"
        size={conTexto ? 'normal' : 'chico'}
        aria-label="Cómo lo ve tu cliente"
        title="Cómo lo ve tu cliente"
        onClick={() => {
          setAbierta(true);
        }}
      >
        <Icono nombre="circle-help" tamano={conTexto ? 18 : 16} />
        {conTexto && 'Cómo lo ve tu cliente'}
      </Button>

      <ConSalida valor={abierta}>
        {() => (
          <Hoja
            titulo="Cómo lo ve tu cliente"
            ancho="amplio"
            desdeAbajo={enCelular}
            alCerrar={cerrar}
          >
            <Carrusel alCerrar={cerrar} />
          </Hoja>
        )}
      </ConSalida>
    </>
  );
}
