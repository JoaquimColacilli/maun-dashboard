import { abrirNovedades } from '../model/abiertas';
import { etiquetaDeLaVersion, versionActual } from '../model/version';

export interface VersionDeLaAppProps {
  className?: string;
  conInvitacion?: boolean;
}

export function VersionDeLaApp({ className = '', conInvitacion = false }: VersionDeLaAppProps) {
  return (
    <button
      type="button"
      onClick={() => {
        abrirNovedades();
      }}
      className={className}
    >
      <span>{etiquetaDeLaVersion(versionActual())}</span>
      {conInvitacion && (
        <span className="font-semibold text-ink underline underline-offset-3">
          Ver las novedades
        </span>
      )}
    </button>
  );
}
