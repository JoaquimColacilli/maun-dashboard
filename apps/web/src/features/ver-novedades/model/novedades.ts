export interface Novedad {
  version: string;
  lineas: readonly string[];
}

export const NOVEDADES: readonly Novedad[] = [
  {
    version: '2026-09-15',
    lineas: [
      'Cada contacto y cada obra guarda fotos, capturas y PDF. Se suben desde su ficha, con señal, y las fotos se achican solas antes de subir.',
      'En Seguimiento hay un paso nuevo, «Estimativo enviado», y lo que sigue se sugiere según si cobraste la visita. Al presupuestar tildás diseñar, despiezar, cotizar y armar el PDF.',
      'El día del relevamiento se corrige desde la ficha, y de ese día sale el plazo del presupuesto. Si cerrás un formulario con algo escrito, te pregunta antes de borrarlo.',
      'Desde la ficha del cliente, el inicio y la agenda, tocar un trabajo o un cliente te lleva a su ficha. Estas novedades se vuelven a ver tocando la versión, al final de Ajustes.',
    ],
  },
];
