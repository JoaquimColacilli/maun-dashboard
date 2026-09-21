import { EditorDeLaEncuesta } from '@/features/editar-la-encuesta';
import { Pagina } from '@/shared/ui';

import { EncabezadoDeOpiniones } from './EncabezadoDeOpiniones';

export function PreguntasPage() {
  return (
    <Pagina className="pb-11 [&>*]:max-w-[860px]">
      <EncabezadoDeOpiniones seccion="preguntas" />
      <EditorDeLaEncuesta />
    </Pagina>
  );
}
