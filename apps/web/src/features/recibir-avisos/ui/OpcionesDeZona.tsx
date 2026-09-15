import { opcionesDeZona } from '../model/zonas';

export function OpcionesDeZona({ guardada }: { guardada: string | null }) {
  return (
    <>
      {opcionesDeZona(guardada, new Date()).map((opcion) => (
        <option key={opcion.id} value={opcion.id}>
          {opcion.etiqueta}
        </option>
      ))}
    </>
  );
}
