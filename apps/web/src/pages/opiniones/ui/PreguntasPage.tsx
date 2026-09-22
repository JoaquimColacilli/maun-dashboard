import { EditorDeLaEncuesta } from '@/features/editar-la-encuesta';

import { PaginaDeOpiniones } from './EncabezadoDeOpiniones';

export function PreguntasPage() {
  return (
    <PaginaDeOpiniones seccion="preguntas">
      <EditorDeLaEncuesta />
    </PaginaDeOpiniones>
  );
}
