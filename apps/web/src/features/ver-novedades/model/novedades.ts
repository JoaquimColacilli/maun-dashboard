export interface Novedad {
  version: string;
  lineas: readonly string[];
}

export const NOVEDADES: readonly Novedad[] = [
  {
    version: '2026-09-25.4',
    lineas: [
      'La app ahora se llama NUMA y estrena logo e ícono. Tus clientes siguen viendo el nombre de tu taller.',
      'Para ver el ícono nuevo en el celular, desinstalá la app y volvé a instalarla desde el navegador, con señal y sin nada pendiente de guardar.',
      'Los botones se hunden un poco al tocarlos y los interruptores se deslizan. El menú del «+» se abre desde el botón.',
      'Lo que tildás en «Lo que hace falta» y en la agenda se tacha con una línea que corre, y los avisos entran desde abajo.',
    ],
  },
  {
    version: '2026-09-25.3',
    lineas: [
      'Tu sueldo ahora se cuenta por mes: los cobros lo van pagando hasta completar el que cargaste en Ajustes, y lo que sobra queda en el taller.',
      'Si el mes ya tiene el sueldo cubierto, el reparto de un cobro lo dice y no le manda nada al hogar.',
      'Lo que ya cobraste queda repartido como estaba.',
    ],
  },
  {
    version: '2026-09-25.2',
    lineas: [
      'Cuando terminás un mueble, tocá «Ya está listo» en su ficha: tu cliente lo ve y podés proponerle un día o pedirle que marque los días y horarios que le quedan bien.',
      'Si acepta el día, la entrega queda comprometida sola y su página le dice «¡Buenas noticias! Lo estamos entregando el …». Si te pasa sus días, confirmás uno.',
      'Mientras lo fabricás, tu cliente ve la fecha como estimada. La app guarda la primera de cada trabajo y la compara con el día en que lo entregaste.',
      'En el Analítico de entregas, desde Historial, ves qué tan preciso sos estimando y cuánto demorás por tipo de proyecto, que ahora le podés poner a cada trabajo.',
    ],
  },
  {
    version: '2026-09-25',
    lineas: [
      'La página de tu cliente ya no le muestra un mueble que no es el suyo: el dibujo cuenta en qué anda el trabajo, del número estimado al presupuesto, la seña, el taller y su casa.',
      'En su camino, cada paso se tilda con su día cuando pasa y queda en curso lo que falta: con el presupuesto mandado, que lo apruebe y deje la seña.',
      'Si ya te cubrió la seña antes de aprobar, la página no se la vuelve a pedir. Y con el trabajo saldado, ve el total pagado.',
      'Los dibujos quedan bien centrados, y al terminar la encuesta tu cliente ve una tarjeta de agradecimiento firmada.',
    ],
  },
  {
    version: '2026-09-24.2',
    lineas: [
      'La app cambió de cara. El fondo ahora es una mesa de trabajo y todo va en tarjetas apoyadas encima, con las puntas redondeadas.',
      'Inicio arranca con el corte del mes, un tablero dibujado que muestra qué parte de lo que cobraste fue al hogar, al taller y al diezmo, y cuánto se llevaron los gastos.',
      'En la ficha de cada trabajo, la ganancia se ve como un tablero, de trazos mientras es proyección y cortado en las piezas de cada tesoro cuando lo cobrás.',
      'Las pantallas vacías, los errores y la página de tu cliente tienen dibujos propios.',
    ],
  },
  {
    version: '2026-09-24',
    lineas: [
      'La página de tu cliente ya no le promete nada antes de que te apruebe: no ve la dirección ni las fechas de inicio y de entrega, y lo que te pagó figura como un pago, a cuenta de la seña.',
      'Mientras espera la seña, ve el presupuesto, la seña para arrancar, cuánto le falta y para cuándo podría estar listo si seña antes de que venza el presupuesto.',
      'Al marcar «Mandé el presupuesto», vale 15 días. La fecha la cambiás desde la ficha del contacto, y los días, en Ajustes.',
      'Si pasa la fecha, Consultas y la ficha te avisan que venció, y tu cliente lee que tiene que hablar con vos para actualizarlo.',
    ],
  },
  {
    version: '2026-09-23.2',
    lineas: [
      'En el celular, las pantallas se mueven como en una app: lo que abrís entra desde el costado, lo que cerrás vuelve por donde vino y un trabajo se abre desde su tarjeta.',
      'La flecha de volver y el botón de atrás del teléfono hacen lo mismo, y te dejan donde estabas, con la lista a la misma altura.',
      'Tocar una sección en la barra de abajo te lleva a su pantalla principal, y desde ahí atrás vuelve a Inicio.',
    ],
  },
  {
    version: '2026-09-23',
    lineas: [
      'Lo que antes era Seguimiento ahora se llama Consultas: son los trabajos que todavía no te aprobaron.',
      'Seguimiento es nuevo: ahí van los que te dijeron «por ahora no». Elegís el día para volver a escribirle, te aparece en la agenda y ese día anotás qué te contestó.',
      'Cada cobro queda con el día en que entró la plata: por defecto, el del último pago. Si es de antes de que empezaras con la app, marcás que esa plata ya estaba en tus saldos.',
      'Lo que cargás en la compu aparece solo en el celular en un segundo, y al revés. Las opiniones de tus clientes también llegan solas.',
    ],
  },
  {
    version: '2026-09-22.6',
    lineas: [
      'En la compu, todas las pantallas vuelven a ir centradas y con el mismo ancho, como antes: ya no queda un espacio vacío grande a la derecha.',
      'En la página de tu cliente, cómo pagar vuelve a estar arriba a la derecha, junto a los datos del trabajo, y lo acompaña mientras baja.',
      'Ajustes, el formulario de un trabajo, Compartir, Cobrar y Avisos usan todo el ancho: lo que va junto, como las fechas o el alias y el CVU, queda en el mismo renglón.',
    ],
  },
  {
    version: '2026-09-22.5',
    lineas: [
      'En la compu, Ajustes ya no deja una columna vacía: cada sección va en su renglón, con el título a la izquierda y lo que completás a la derecha.',
      'Las fichas de los trabajos y de los clientes, Finanzas, Diezmo y la página de tu cliente ponen los pagos y las notas de un lado y el resumen al costado, que te acompaña mientras bajás.',
      'En una pantalla grande todo arranca al lado del menú, sin la franja vacía en el medio.',
      'En la página de tu cliente, el logo de Mercado Pago acompaña los datos para transferir siempre que el pago sea por transferencia, aunque no hayas cargado el link.',
    ],
  },
  {
    version: '2026-09-22.4',
    lineas: [
      'En la página que ve tu cliente, un trabajo entregado y pagado muestra el camino completo, con todos los pasos tildados. Antes el último quedaba en amarillo, como si faltara algo.',
    ],
  },
  {
    version: '2026-09-22.3',
    lineas: [
      'El aviso de «Hay una versión nueva» ya no espera a que cierres la app del todo: aparece al volver a la app, al volver la señal y al tirar hacia abajo para actualizar.',
      'Si tirás hacia abajo mientras se baja una versión nueva, no la cortás: el aviso aparece apenas termina, aunque sigas tirando.',
      'En la compu, con la app abierta todo el día, se entera sola de las versiones nuevas, sin recargar la página.',
    ],
  },
  {
    version: '2026-09-22.2',
    lineas: [
      'En «Lo que hace falta» tocás la cantidad o el nombre de algo que ya cargaste y lo cambiás ahí mismo, sin borrarlo. Las herramientas ahora también pueden llevar cantidad.',
      'Hay una lista nueva, Materiales, antes de los herrajes: para los cortes de melamina, un tablón para la mesada, la pintura o un caño. Te sugiere los materiales que ya usaste.',
      'En el celular los montos ya no se salen de sus tarjetas: la letra se achica lo justo para que entren enteros, con los centavos.',
      'Los costos estimados que cargás sin señal ya no se pierden si cerrás la app antes de que vuelva.',
    ],
  },
  {
    version: '2026-09-22',
    lineas: [
      'En la página de tu cliente, el casillero del relevamiento pasó a ser una (i) al lado del paso en curso: le explica si el número todavía puede cambiar o si ya sale de las medidas.',
      'Debajo del título lo lee sin tocar nada: «Número estimado, falta ir a medir» o el día en que fuiste a medir.',
    ],
  },
  {
    version: '2026-09-21.2',
    lineas: [
      'Desde la ficha de un trabajo entregado le pedís la opinión al cliente por WhatsApp, con hasta tres preguntas propias: la contesta sin cuenta y, si no, se la recordás una vez.',
      'En Opiniones ves qué tan conformes quedaron y cada respuesta entera, y cambiás las preguntas. Si cargás en Ajustes tu enlace de reseñas de Google, se lo pedimos a todos por igual.',
      'Cuando llega una opinión que no leíste, te aparece en Inicio. En el celular, tocando tu foto abrís Opiniones, Diezmo, Agenda y Ajustes.',
      'Tu cliente ve en su página el estimativo que le mandaste, sin el número, y un casillero de relevamiento técnico: en blanco mientras falta medir, con el día si lo agendaste, y tildado cuando fuiste.',
    ],
  },
  {
    version: '2026-09-21',
    lineas: [
      'En Inicio, «Sueldo del mes» se mide contra el sueldo que cargaste, aunque en el mes hayas cobrado varios trabajos. Antes sumaba un sueldo por cada cobro.',
      'Si los trabajos del mes ya pagaron más que tu sueldo, la barra queda llena y te dice cuánto entró.',
    ],
  },
  {
    version: '2026-09-20.2',
    lineas: [
      'Arreglamos «Cómo lo ve tu cliente»: después de la última actualización, en los aparatos que ya venían usando la app esa pantalla se cortaba con un error.',
    ],
  },
  {
    version: '2026-09-20',
    lineas: [
      'En cada trabajo elegís cómo te paga la seña y cómo el saldo: por transferencia, en efectivo o de las dos formas.',
      'Tu cliente ve cuánto es el pago que le toca, con un botón para copiar el monto, y cuánto le va a quedar después. Si ese pago es en efectivo, no le mostramos tu cuenta: es en mano.',
      'Si cargás tu enlace de Mercado Pago en Ajustes, tu cliente ve un botón para pagarte desde ahí, debajo de tu alias. Ese cobro sí te descuenta comisión; transferirte al alias no.',
      'Al lado de «Mandárselo por WhatsApp» tenés un código QR con el mismo enlace, para mostrárselo en la mano. Anda sin señal, y darlo de baja lo apaga.',
    ],
  },
  {
    version: '2026-09-19.2',
    lineas: [
      'El enlace de un trabajo ahora te aparece en todos tus aparatos, no solo en el que lo creaste. Si lo generaste en la computadora, lo copiás igual desde el celular.',
      'Ya no tenés que crear uno nuevo para poder verlo, que era lo que le rompía a tu cliente el que ya tenía.',
      'Los enlaces que creaste antes de esta versión aparecen en los demás aparatos apenas abrís ese trabajo una vez desde la computadora donde lo hiciste.',
    ],
  },
  {
    version: '2026-09-19',
    lineas: [
      'La página que le compartís al cliente ahora se puede bajar hasta el final desde el celular. Antes quedaba clavada en la primera pantalla y las fotos no llegaban a verse.',
      'En Ajustes cargás una vez tu alias, tu CBU o CVU, el titular y el CUIT. Tu cliente los ve al lado de lo que le falta pagar, con un botón para copiar cada uno.',
      'En la ficha de cada trabajo ves cuántos archivos le estás mostrando, y te avisa cuando tenés archivos y no le compartiste ninguno.',
      'Al pegar el enlace en WhatsApp ahora aparece el nombre del trabajo en vez del nombre de la app, y la pantalla de compartir te muestra antes cómo se va a ver.',
    ],
  },
  {
    version: '2026-09-18.2',
    lineas: [
      'Desde la ficha de un trabajo podés mostrarle al cliente cuánto vale, cuánto pagó, cuánto falta y en qué anda. No ve tus costos, tu ganancia, el diezmo ni el despiece.',
      'Si querés que lo abra él, le pasás un enlace que anda sin cuenta ni contraseña. No vence y lo das de baja cuando quieras. El signo de pregunta de al lado te explica paso por paso cómo funciona.',
      'Decidís archivo por archivo cuál se ve. Los que subas nacen privados: el comprobante de lo que le pagaste al proveedor no se comparte porque te olvidaste de tildarlo.',
      'Al pasar un contacto a Proyectos ya podés cargar ahí mismo la seña que te dejó, con el porcentaje que tenés configurado. Lo que cobraste en la visita no se cuenta dos veces.',
    ],
  },
  {
    version: '2026-09-18',
    lineas: [
      'Al cotizar podés anotar cuánto calculás que vas a gastar en madera, herrajes, flete y ayudante. Cuando el trabajo tiene presupuesto, te dice cuánto te queda; si te pasaste, también.',
      'Cada trabajo tiene su lista de herrajes y su lista de herramientas, con cantidad cuando hace falta. Se tildan a medida que los vas consiguiendo y te sugieren los que ya usaste en otros trabajos.',
      'En la agenda arrastrás una cosa de un día a otro. Si movés una entrega o una visita, le cambia la fecha al trabajo. Lo que ya hiciste no se mueve, y todo se puede deshacer.',
      'Al tocar un día se abre hora por hora, con lo que no tiene hora en una franja arriba. La entrega y la visita ahora pueden llevar hora.',
    ],
  },
  {
    version: '2026-09-16',
    lineas: [
      'Un mismo trabajo puede tener varios presupuestos, cada uno con su importe y su detalle. Cuando el cliente elige, tildás el que aprobó y ese pasa a ser el presupuesto del trabajo.',
      'Los que no eligió quedan a la vista, así sabés qué le ofreciste. Mientras no tildes ninguno, el trabajo no muestra presupuesto en vez de inventar uno.',
      'La ficha te dice cuánto es la seña y cuánto falta para llegar, con la visita ya descontada. Sale del porcentaje que pongas en Ajustes, la mitad por defecto, y la podés cambiar en un trabajo.',
      'Con poca señal, cerrar sesión o entrar con otra cuenta apenas abrís la app ya no la deja trabada en «No pudimos leer tus datos»: te lleva directo a la pantalla para entrar.',
    ],
  },
  {
    version: '2026-09-15.2',
    lineas: [
      'Cuando marcás que entregaste un proyecto, la entrega queda tachada en su día de la agenda, abajo de lo pendiente. Si vuelve al taller, vuelve a estar pendiente.',
      'La visita que anotaste con «Ya fui a relevar» también queda tachada, aunque después cambies la etapa del contacto. Si te equivocaste, la destildás desde Editar el contacto.',
      'Las visitas, las entregas y los plazos de presupuesto se marcan como importantes con el mismo círculo que tus anotaciones, y el filtro Marcado también los muestra.',
      'Lo que ya hiciste no aparece como atrasado ni te llega en los avisos de la mañana.',
    ],
  },
  {
    version: '2026-09-15',
    lineas: [
      'Cada contacto y cada obra guarda fotos, capturas y PDF. Se suben desde su ficha, con señal, y las fotos se achican solas antes de subir.',
      'En Consultas hay un paso nuevo, «Estimativo enviado», y lo que sigue se sugiere según si cobraste la visita. Al presupuestar tildás diseñar, despiezar, cotizar y armar el PDF.',
      'El día del relevamiento se corrige desde la ficha, y de ese día sale el plazo del presupuesto. Si cerrás un formulario con algo escrito, te pregunta antes de borrarlo.',
      'Desde la ficha del cliente, el inicio y la agenda, tocar un trabajo o un cliente te lleva a su ficha. Estas novedades se vuelven a ver tocando la versión, al final de Ajustes.',
    ],
  },
];
